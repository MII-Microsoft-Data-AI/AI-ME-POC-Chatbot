"""LangGraph agent implementation."""
from typing import Dict, List, Literal, TypedDict, Annotated
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from lib.checkpointer import checkpointer

from langchain_core.messages.utils import (
    trim_messages,
    count_tokens_approximately
)

from .tools import AVAILABLE_TOOLS
from .model import model

class AgentState(TypedDict):
    """State for the agent graph."""
    messages: Annotated[List[BaseMessage], add_messages]


def should_continue(state: AgentState) -> Literal["tools", "end"]:
    """Determine whether to continue to tools or end the conversation.
    
    Args:
        state: Current agent state
        
    Returns:
        str: Next node to execute ("tools" or "end")
    """
    messages = state["messages"]
    last_message = messages[-1]
    
    # If the LLM makes a tool call, then we route to the "tools" node
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        # Debug: Print tool calls
        print(f"\n🔧 LLM Tool Calls ({len(last_message.tool_calls)}):")
        for i, tool_call in enumerate(last_message.tool_calls, 1):
            print(f"  {i}. {tool_call.get('name', 'unknown')}")
            print(f"     Args: {tool_call.get('args', {})}")
        return "tools"
    # Otherwise, we stop (reply to the user)
    return "end"



def call_model(state: AgentState, config = None) -> Dict[str, List[BaseMessage]]:
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

    system_prompt = """
# Your Role
You are a helpful AI assistant. Use tools when needed to provide accurate, well-researched answers.

# Tool Usage Guidelines

## Information Search
When the user asks for information you don't have or need to verify:
- Use search tools to find relevant information
- You may use 1-3 different search tools depending on the query complexity
- Prefer web_search for general/current information
- Use Azure Search tools for internal documents/knowledge base

Available search tools:
- `web_search` - For general web information and current events
- `azure_search_documents` - For internal document search
- `azure_search_semantic` - For semantic/AI-powered search
- `azure_search_filter` - For filtered search with specific criteria
- `azure_search_vector` - For similarity-based search

**IMPORTANT**: After using 2-3 search tools, synthesize the results and provide an answer. Do NOT keep searching indefinitely.

## Mathematics & Code
Use `Python_REPL` for:
- Mathematical calculations and equations
- Data analysis and processing
- Code execution and testing
- File handling or data visualization

When using math, show calculations step-by-step and format with LaTeX (`$...$` for inline, `$$...$$` for display).

# Referencing Rules
When citing information from tools:
- Azure Search: Use `[doc-(id)]` format
- Web Search: Use `[link-(url)]` format
- Multiple sources: `[doc-(id1)] [doc-(id2)] [link-(url)]`

Example:
"Azure OpenAI provides access to GPT models [link-(https://azure.microsoft.com/...)] through Microsoft's cloud platform [doc-(abc123)]."

# Completion Rules
Provide a final answer when:
1. You have gathered sufficient information (1-3 tool calls is usually enough)
2. You have synthesized the information into a coherent response
3. You have added proper references where applicable

**Do NOT**:
- Keep searching after you have enough information
- Use more than 3-4 tools for a single query unless absolutely necessary
- Make up information - if no results found, say so clearly
"""

    system_msg = SystemMessage(content=system_prompt.strip())
    messages = [system_msg] + state["messages"]
        
    # Bind tools to the model
    model_with_tools = model.bind_tools(AVAILABLE_TOOLS)
    response = model_with_tools.invoke(messages)
    
    # Return the response
    return {"messages": [response]}


async def get_graph():
    """Get or create the graph instance.
    
    Graph is rebuilt on every call to ensure tool changes are picked up.
    This may add slight latency but ensures correctness during development.
    """
    # Create the graph fresh every time
    workflow = StateGraph(AgentState)

    # Add nodes
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", ToolNode(AVAILABLE_TOOLS))

    # Set the entrypoint as agent
    workflow.set_entry_point("agent")

    # Add conditional edges
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )

    # Add edge from tools back to agent
    workflow.add_edge("tools", "agent")

    checkpointer_ins = await checkpointer()

    # Compile the graph
    graph = workflow.compile(checkpointer=checkpointer_ins)
    
    return graph