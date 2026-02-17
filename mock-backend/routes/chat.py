"""Chat streaming routes for LangGraph integration.

Provides SSE-based streaming endpoints for chat and HITL (human-in-the-loop)
feedback. Both endpoints share the same LangGraph-to-SSE event converter.
"""

import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional, cast

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse
from langchain_core.runnables.config import RunnableConfig
from langgraph.types import Command
from pydantic import BaseModel

from agent.graph import get_graph
from lib.auth import get_authenticated_user
from lib.database import db_manager
from utils.message_conversion import from_assistant_ui_contents_to_langgraph_contents

logger = logging.getLogger(__name__)

chat_routes = APIRouter()


def _checkpoint_id_from_state(state: Any) -> Optional[str]:
    """Extract checkpoint_id from a LangGraph state object."""
    try:
        cfg = getattr(state, "config", None) or {}
        configurable = cfg.get("configurable", {}) if isinstance(cfg, dict) else {}
        cp_id = configurable.get("checkpoint_id")
        if isinstance(cp_id, str) and cp_id:
            return cp_id
    except Exception:
        return None
    return None


def _first_interrupt_payload_from_state(state: Any) -> Optional[dict]:
    """Return the first interrupt payload if the graph is paused."""
    if not state or not getattr(state, "next", None):
        return None
    tasks = getattr(state, "tasks", [])
    for task in tasks:
        if hasattr(task, "interrupts") and task.interrupts:
            intr = task.interrupts[0]
            if hasattr(intr, "value") and isinstance(intr.value, dict):
                return intr.value
            if hasattr(intr, "value"):
                return {"value": intr.value}
    return None


class Message(BaseModel):
    """A single chat message."""

    role: str
    content: Any



class StreamRequest(BaseModel):
    """Request body for the /stream endpoint."""

    thread_id: str = "default"
    checkpoint_id: Optional[str] = None
    message: Optional[Message] = None
    messages: Optional[List[Message]] = None


class FeedbackRequest(BaseModel):
    """Request body for the /feedback endpoint (HITL resume)."""

    thread_id: str
    checkpoint_id: Optional[str] = None
    approval_data: Dict[str, Any]


def sse(data: dict) -> str:
    """Encode a Python dict as an SSE ``data:`` line."""
    encoded = jsonable_encoder(data)
    return f"data: {json.dumps(encoded)}\n\n"


def _normalize_message_content(content: Any) -> Any:
    if isinstance(content, list):
        return from_assistant_ui_contents_to_langgraph_contents(content)
    return content


def _normalize_messages(messages: List[Message]) -> List[dict]:
    normalized = []
    for msg in messages:
        normalized.append(
            {
                "role": msg.role,
                "content": _normalize_message_content(msg.content),
            }
        )
    return normalized


async def langgraph_events_to_sse(
    events: Any,
    req: Request,
    graph: Any,
    config: Any,
) -> AsyncIterator[str]:
    """Convert LangGraph v2 streaming events to SSE events."""

    try:
        async for event in events:
            if await req.is_disconnected():
                logger.info("Client disconnected, stopping SSE stream")
                break

            ev = event.get("event")

            if ev == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                content = getattr(chunk, "content", None)
                if content:
                    yield sse({"type": "token", "content": content})

            elif ev == "on_chat_model_end":
                output = event["data"]["output"]
                tool_calls = getattr(output, "tool_calls", None)
                if tool_calls:
                    for tc in tool_calls:
                        args = tc["args"]
                        if not isinstance(args, dict):
                            args = json.loads(args)
                        yield sse(
                            {
                                "type": "tool_call",
                                "id": tc["id"],
                                "name": tc["name"],
                                "arguments": args,
                            }
                        )

            elif ev == "on_tool_end":
                output = event["data"].get("output")
                if output is not None:
                    data = event.get("data", {})
                    tool_call_id = ""
                    if isinstance(data, dict):
                        tool_call_id = data.get("tool_call_id", "") or data.get(
                            "call_id", ""
                        )
                        input_data = data.get("input")
                        if not tool_call_id and isinstance(input_data, dict):
                            tool_call_id = input_data.get(
                                "tool_call_id", ""
                            ) or input_data.get("id", "")
                    if not tool_call_id:
                        if hasattr(output, "tool_call_id"):
                            tool_call_id = getattr(output, "tool_call_id")
                        elif isinstance(output, dict):
                            tool_call_id = output.get("tool_call_id", "")
                    if not tool_call_id:
                        tool_call_id = event.get("run_id", "")

                    name = event.get("name", "")
                    if hasattr(output, "content"):
                        content = getattr(output, "content")
                    elif isinstance(output, dict) and "content" in output:
                        content = output.get("content")
                    else:
                        content = str(output)
                    yield sse(
                        {
                            "type": "tool_result",
                            "id": tool_call_id,
                            "tool_call_id": tool_call_id,
                            "name": name,
                            "content": content,
                        }
                    )

        state = None
        try:
            thread_id = None
            if isinstance(config, dict):
                configurable = config.get("configurable")
                if isinstance(configurable, dict):
                    thread_id = configurable.get("thread_id")

            state_config = (
                cast(RunnableConfig, {"configurable": {"thread_id": thread_id}})
                if thread_id
                else config
            )

            state = await graph.aget_state(state_config)
        except Exception as exc:
            logger.warning(f"Could not check graph state: {exc}")

        cp_id = _checkpoint_id_from_state(state) if state else None

        if state and getattr(state, "next", None):
            interrupts = getattr(state, "tasks", [])
            for task in interrupts:
                if hasattr(task, "interrupts") and task.interrupts:
                    if cp_id:
                        yield sse(
                            {
                                "type": "meta",
                                "phase": "interrupt",
                                "checkpoint_id": cp_id,
                            }
                        )
                    for intr in task.interrupts:
                        yield sse(
                            {
                                "type": "interrupt",
                                "payload": intr.value,
                            }
                        )
                    return

        if cp_id:
            yield sse({"type": "meta", "phase": "complete", "checkpoint_id": cp_id})
        yield sse({"type": "done"})
        yield "data: [DONE]\n\n"

    except Exception as exc:
        logger.error(f"Error in langgraph_events_to_sse: {exc}")
        yield sse({"type": "error", "error": str(exc)})


@chat_routes.post("/stream")
async def stream_endpoint(
    payload: StreamRequest,
    req: Request,
    _: str = Depends(get_authenticated_user),
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="userid header is required"
        )

    if not payload.thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")

    if not db_manager.conversation_exists(payload.thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    graph = get_graph()

    input_messages: List[dict] = []
    if payload.message is not None:
        input_messages = _normalize_messages([payload.message])
    elif payload.messages is not None:
        input_messages = _normalize_messages(payload.messages)

    graph_input = {"messages": input_messages}

    configurable: Dict[str, Any] = {"thread_id": payload.thread_id}
    if payload.checkpoint_id:
        configurable["checkpoint_id"] = payload.checkpoint_id
    config = cast(RunnableConfig, {"configurable": configurable})

    logger.info(
        "Starting stream for thread_id=%s checkpoint_id=%s input_messages=%s",
        payload.thread_id,
        payload.checkpoint_id or "",
        len(input_messages),
    )

    async def event_gen():
        yield sse(
            {
                "type": "meta",
                "phase": "start",
                "thread_id": payload.thread_id,
                "checkpoint_id": payload.checkpoint_id,
            }
        )
        events = graph.astream_events(graph_input, config=config, version="v2")
        async for chunk in langgraph_events_to_sse(events, req, graph, config):
            yield chunk

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@chat_routes.post("/feedback")
async def feedback_endpoint(
    payload: FeedbackRequest,
    req: Request,
    _: str = Depends(get_authenticated_user),
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="userid header is required"
        )

    if not payload.thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")

    if not db_manager.conversation_exists(payload.thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    graph = get_graph()

    configurable: Dict[str, Any] = {"thread_id": payload.thread_id}
    if payload.checkpoint_id:
        configurable["checkpoint_id"] = payload.checkpoint_id
    config = cast(RunnableConfig, {"configurable": configurable})

    logger.info(
        "Resuming graph for thread_id=%s checkpoint_id=%s",
        payload.thread_id,
        payload.checkpoint_id or "",
    )

    async def event_gen():
        yield sse(
            {
                "type": "meta",
                "phase": "start",
                "thread_id": payload.thread_id,
                "checkpoint_id": payload.checkpoint_id,
            }
        )
        command = Command(resume=payload.approval_data)
        events = graph.astream_events(command, config=config, version="v2")
        async for chunk in langgraph_events_to_sse(events, req, graph, config):
            yield chunk

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@chat_routes.get("/interrupt")
async def interrupt_status(
    thread_id: str = Query(..., description="LangGraph thread id"),
    checkpoint_id: Optional[str] = Query(
        None, description="Optional checkpoint_id to time travel / fork from"
    ),
    _: str = Depends(get_authenticated_user),
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="userid header is required"
        )

    if not db_manager.conversation_exists(thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    graph = get_graph()

    configurable: Dict[str, Any] = {"thread_id": thread_id}
    if checkpoint_id:
        configurable["checkpoint_id"] = checkpoint_id
    config = cast(RunnableConfig, {"configurable": configurable})

    state = await graph.aget_state(config)
    cp_id = _checkpoint_id_from_state(state)
    payload = _first_interrupt_payload_from_state(state)
    if payload:
        return {
            "thread_id": thread_id,
            "interrupted": True,
            "checkpoint_id": cp_id,
            "payload": payload,
        }
    return {
        "thread_id": thread_id,
        "interrupted": False,
        "checkpoint_id": cp_id,
    }
