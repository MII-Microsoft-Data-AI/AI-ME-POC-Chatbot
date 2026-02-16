"""Assistant UI thread repository persistence.

Stores Assistant UI ExportedMessageRepository documents keyed by thread_id.

In this repo, thread_id is the same as conversation_id.
"""

import logging
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from lib.auth import get_authenticated_user
from lib.database import db_manager

logger = logging.getLogger(__name__)


thread_repo_routes = APIRouter()


class RepoPutRequest(BaseModel):
    repo: Dict[str, Any]


@thread_repo_routes.get("/threads/{thread_id}/repo")
async def get_thread_repo(
    thread_id: str,
    _: str = Depends(get_authenticated_user),
    userid: Optional[str] = Header(default=None),
):
    if not userid:
        raise HTTPException(status_code=400, detail="Missing userid header")

    if not db_manager.conversation_exists(thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    doc = db_manager.get_conversation_repo(thread_id, userid)
    if not doc:
        return {"thread_id": thread_id, "repo": None}
    return {"thread_id": thread_id, "repo": doc.get("repo")}


@thread_repo_routes.put("/threads/{thread_id}/repo")
async def put_thread_repo(
    thread_id: str,
    payload: RepoPutRequest,
    _: str = Depends(get_authenticated_user),
    userid: Optional[str] = Header(default=None),
):
    if not userid:
        raise HTTPException(status_code=400, detail="Missing userid header")

    if not thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")

    if not db_manager.conversation_exists(thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    doc = db_manager.put_conversation_repo(thread_id, userid, payload.repo)
    logger.info(f"Upserted thread repo for thread_id={thread_id}")
    return {"thread_id": thread_id, "updated_at": doc.get("updated_at")}
