"""First-message /chat endpoint for the New Chat page.

The frontend's first chat flow uses a data-stream runtime pointing to POST /chat.
Historically this endpoint was removed in favor of /conversations/{conversation_id}/chat,
but the New Chat page still expects it.

We keep this endpoint as a thin compatibility layer:
- Creates a new conversation (UUID) for the authenticated user
- Runs LangGraph with the provided last user message
- Streams Vercel AI SDK data-stream chunks using existing generate_stream()
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse

from pydantic import BaseModel

from agent.graph import get_graph

from lib.auth import get_authenticated_user
from lib.database import db_manager
from utils.stream_protocol import generate_stream
from utils.uuid import generate_uuid


class ChatRequest(BaseModel):
    messages: list


chat_first_route = APIRouter()


@chat_first_route.post("/chat")
async def chat_first_message(
    request: ChatRequest,
    _: Annotated[str, Depends(get_authenticated_user)],
    userid: Annotated[str | None, Header()] = None,
):
    if not userid:
        return {"error": "Missing userid header"}

    if not request or type(request.messages) is not list or len(request.messages) == 0:
        return {"error": "Invalid messages format"}

    last_message = request.messages[-1]
    content = last_message.get("content", "") if isinstance(last_message, dict) else ""
    if not isinstance(content, str) or not content.strip():
        return {"error": "Invalid message content"}

    conversation_id = generate_uuid()
    db_manager.create_conversation(conversation_id, content.strip(), userid)

    graph = get_graph()

    # Legacy stream_protocol expects a list of message dicts
    # (it type-annotates HumanMessage but uses dict access downstream).
    input_message = [{"role": "user", "content": content}]

    return StreamingResponse(
        generate_stream(graph, input_message, conversation_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Content-Type": "text/plain; charset=utf-8",
            "Connection": "keep-alive",
            "x-vercel-ai-data-stream": "v1",
            "x-vercel-ai-ui-message-stream": "v1",
            # Let the UI know which conversation was created.
            "x-conversation-id": conversation_id,
        },
    )
