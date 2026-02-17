"""Thread repository persistence routes.

Persists Assistant UI ExportedMessageRepository keyed by thread_id + userid.
Repo payloads are stored in Azure Blob Storage; pointer metadata is stored
on the existing conversation document.
"""

import gzip
import hashlib
import json
import logging
import time
from typing import Any, Dict
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from lib.auth import get_authenticated_user
from lib.blob import download_blob_to_bytes, upload_bytes_to_blob
from lib.database import db_manager

logger = logging.getLogger(__name__)

thread_repo_routes = APIRouter()

REPO_BLOB_PREFIX = "thread_repos"
REPO_ENCODING_GZIP = "gzip"
REPO_SCHEMA_VERSION = 1


class RepoPutRequest(BaseModel):
    repo: Dict[str, Any]


def _gzip_repo(repo: Dict[str, Any]) -> tuple[bytes, bytes, str]:
    repo_json = json.dumps(repo, separators=(",", ":"), ensure_ascii=True).encode(
        "utf-8"
    )
    gzipped = gzip.compress(repo_json)
    sha256_hex = hashlib.sha256(repo_json).hexdigest()
    return repo_json, gzipped, sha256_hex


def _read_repo_from_ref(repo_ref: Dict[str, Any]) -> Dict[str, Any] | None:
    blob_name = repo_ref.get("blob")
    if not isinstance(blob_name, str) or not blob_name:
        return None

    data = download_blob_to_bytes(blob_name)
    encoding = repo_ref.get("encoding")
    if encoding == REPO_ENCODING_GZIP:
        data = gzip.decompress(data)

    decoded = data.decode("utf-8")
    repo = json.loads(decoded)
    if not isinstance(repo, dict):
        raise ValueError("Repo payload must be a JSON object")
    return repo


@thread_repo_routes.get("/{thread_id}/repo")
async def get_thread_repo(
    thread_id: str,
    _: str = Depends(get_authenticated_user),
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="userid header is required"
        )

    if not db_manager.conversation_exists(thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    conversation = db_manager.get_conversation(thread_id, userid)
    repo_ref = conversation.repo_ref if conversation else None
    if not repo_ref:
        return {"thread_id": thread_id, "repo": None}

    try:
        repo = _read_repo_from_ref(repo_ref)
    except Exception as exc:
        logger.error(f"Failed to load thread repo for thread_id={thread_id}: {exc}")
        raise HTTPException(status_code=500, detail="Failed to load thread repo")

    return {"thread_id": thread_id, "repo": repo}


@thread_repo_routes.put("/{thread_id}/repo")
async def put_thread_repo(
    thread_id: str,
    payload: RepoPutRequest,
    _: str = Depends(get_authenticated_user),
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="userid header is required"
        )

    if not thread_id:
        raise HTTPException(status_code=400, detail="thread_id is required")

    if not db_manager.conversation_exists(thread_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")

    repo_json, gzipped, sha256_hex = _gzip_repo(payload.repo)
    now = int(time.time())

    blob_name = f"{REPO_BLOB_PREFIX}/{thread_id}/{uuid4().hex}.json.gz"
    upload_bytes_to_blob(
        gzipped,
        blob_name,
        content_type="application/json",
        content_encoding=REPO_ENCODING_GZIP,
    )

    repo_ref = {
        "blob": blob_name,
        "sha256": sha256_hex,
        "updated_at": now,
        "encoding": REPO_ENCODING_GZIP,
        "schema_version": REPO_SCHEMA_VERSION,
        "repo_bytes": len(repo_json),
        "repo_gzip_bytes": len(gzipped),
    }

    updated = db_manager.update_conversation_repo_ref(thread_id, userid, repo_ref)
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")

    repo_version = db_manager.bump_repo_version(thread_id, userid)
    if repo_version is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    logger.info(
        "Upserted thread repo for thread_id=%s repo_bytes=%s repo_gzip_bytes=%s",
        thread_id,
        len(repo_json),
        len(gzipped),
    )

    return {
        "thread_id": thread_id,
        "updated_at": now,
        "repo_version": repo_version,
    }
