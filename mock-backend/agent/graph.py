"""LangGraph agent implementation."""

from typing import Annotated, Dict, List, Literal, TypedDict

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.messages.utils import count_tokens_approximately, trim_messages
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.types import interrupt

from lib.checkpointer import checkpointer

from .model import model
from .prompt import FALLBACK_SYSTEM_PROMPT, get_prompty_client
from .tools import AVAILABLE_TOOLS
from .utils import change_file_to_url, sanitize_and_validate_messages

# Tools that require human approval before execution
DANGEROUS_TOOL_NAMES = {"generate_image"}


class AgentState(TypedDict):
    """State for the agent graph."""

    messages: Annotated[List[BaseMessage], add_messages]


def should_continue(state: AgentState) -> Literal["approval", "tools", "end"]:
    """Determine whether to continue to approval, tools, or end.

    Args:
        state: Current agent state

    Returns:
        str: Next node to execute ("tools" or "end")
    """
    messages = state["messages"]
    last_message = messages[-1]

    tool_calls: List[dict] | None = None
    if isinstance(last_message, AIMessage):
        tool_calls = getattr(last_message, "tool_calls", None)

    # If the LLM makes a tool call, then we route to the "tools" node
    if tool_calls:
        # Debug: Print tool calls
        print(f"\n🔧 LLM Tool Calls ({len(tool_calls)}):")
        for i, tool_call in enumerate(tool_calls, 1):
            print(f"  {i}. {tool_call.get('name', 'unknown')}")
            print(f"     Args: {tool_call.get('args', {})}")
        if any(
            tc.get("name") in DANGEROUS_TOOL_NAMES for tc in tool_calls
        ):
            print("  ⚠️  Dangerous tool detected, routing to approval node")
            return "approval"
        return "tools"
    # Otherwise, we stop (reply to the user)
    return "end"


async def call_model(state: AgentState, config=None) -> Dict[str, List[BaseMessage]]:
    """Call the model with the current state.

    Args:
        state: Current agent state
        config: Configuration dictionary

    Returns:
        Dict containing the updated messages
    """
    messages = state["messages"]

    # Trim messages to fit within token limit
    messages = trim_messages(
        state["messages"],
        strategy="last",
        token_counter=count_tokens_approximately,
        max_tokens=120_000,
        start_on="human",
        end_on=("human", "tool"),
    )

    # Sanitize and validate messages to ensure proper tool call/response pairing
    messages = sanitize_and_validate_messages(messages)

    # Convert chatbot://{id} URLs to temporary blob URLs with SAS tokens
    messages = change_file_to_url(messages)

    prompt_value = None
    try:
        prompty = get_prompty_client()
        prompt_value = prompty.get_prompt("Main Chat Agent")
    except Exception:
        prompt_value = None

    prompt_text: str = prompt_value if isinstance(prompt_value, str) else ""
    if not prompt_text.strip():
        prompt_text = FALLBACK_SYSTEM_PROMPT

    system_msg = SystemMessage(content=prompt_text.strip())
    messages = [system_msg] + messages

    # Bind tools to the model
    model_with_tools = model.bind_tools(AVAILABLE_TOOLS)
    response = await model_with_tools.ainvoke(messages)

    # Return the response
    return {"messages": [response]}


def approval_node(state: AgentState) -> Dict[str, List[BaseMessage]]:
    """Gate dangerous tool calls behind human approval.

    Uses LangGraph's ``interrupt()`` to pause the graph and ask the user
    for approval. When resumed via ``Command(resume=...)``, the approval
    data determines which tool calls proceed and which are rejected.
    """
    last_message = state["messages"][-1]
    tool_calls: List[dict] | None = None
    if isinstance(last_message, AIMessage):
        tool_calls = getattr(last_message, "tool_calls", None)
    if not tool_calls:
        return {"messages": []}

    calls = tool_calls
    need_approval = [tc for tc in calls if tc.get("name") in DANGEROUS_TOOL_NAMES]

    if not need_approval:
        return {"messages": []}

    approval = interrupt(
        {
            "type": "tool_approval_required",
            "tool_calls": [
                {
                    "id": tc["id"],
                    "name": tc["name"],
                    "arguments": tc.get("args", {}),
                }
                for tc in need_approval
            ],
        }
    )

    decisions_raw = approval.get("decisions", [])
    decisions_by_id: dict[str, dict] = {}
    if isinstance(decisions_raw, list):
        for item in decisions_raw:
            if not isinstance(item, dict):
                continue
            tc_id = item.get("id")
            decision = item.get("decision")
            if not tc_id or decision not in ("approved", "rejected"):
                continue
            decisions_by_id[tc_id] = {
                "decision": decision,
                "arguments": item.get("arguments", None),
            }

    filtered_calls = []
    for tc in calls:
        name = tc.get("name")
        if name not in DANGEROUS_TOOL_NAMES:
            filtered_calls.append(tc)
            continue

        tc_id = tc.get("id")
        if not isinstance(tc_id, str) or not tc_id:
            continue

        decision_info = decisions_by_id.get(tc_id)
        if not decision_info or decision_info.get("decision") != "approved":
            continue

        override_args = decision_info.get("arguments", None)
        if override_args is None:
            override_args = tc.get("args", {})

        if not isinstance(override_args, dict):
            continue

        updated_tc = dict(tc)
        updated_tc["args"] = override_args
        filtered_calls.append(updated_tc)

    updated_message = AIMessage(
        content=last_message.content,
        tool_calls=filtered_calls,
        id=last_message.id,
    )

    return {"messages": [updated_message]}


def get_graph():
    """Get or create the graph instance.

    Graph is rebuilt on every call to ensure tool changes are picked up.
    This may add slight latency but ensures correctness during development.
    """
    # Create the graph fresh every time
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("agent", call_model)
    workflow.add_node("approval", approval_node)
    workflow.add_node("tools", ToolNode(AVAILABLE_TOOLS))

    # Set the entrypoint as agent
    workflow.set_entry_point("agent")

    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "approval": "approval",
            "tools": "tools",
            "end": END,
        },
    )

    workflow.add_edge("approval", "tools")

    # Add edge from tools back to agent
    workflow.add_edge("tools", "agent")

    checkpointer_ins = checkpointer()

    # Compile the graph
    graph = workflow.compile(checkpointer=checkpointer_ins)

    return graph
