"""Attachment routes for multimodal chat input."""

import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Header, HTTPException, UploadFile, status
from pydantic import BaseModel

from lib.blob import (
    delete_file_async,
    get_file_temporary_link_async,
    upload_file_to_blob_async,
)
from lib.database import db_manager


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

attachment_routes = APIRouter()


class AttachmentUploadResponse(BaseModel):
    """Response model for attachment upload."""

    url: str
    filename: str
    message: str
    type: str = "unknown"
    metadata: Optional[Dict[str, Any]] = None


class AttachmentDetailResponse(BaseModel):
    """Response model for attachment details."""

    id: str
    filename: str
    blob_url: str
    userid: str
    type: str
    metadata: Optional[Dict[str, Any]] = None


@attachment_routes.post("", response_model=AttachmentUploadResponse)
async def upload_attachment(
    file: UploadFile = File(...),
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="userid header is required",
        )

    try:
        attachment_id = str(uuid.uuid4())
        blob_name = f"attachments/{userid}/{attachment_id}_{file.filename}"
        file_type = file.content_type or "unknown"

        logger.info(
            f"Uploading attachment: {file.filename} for user {userid} with type {file_type}"
        )

        file_content = await file.read()
        await upload_file_to_blob_async(file_content, blob_name)
        await db_manager.create_attachment_async(
            attachment_id=attachment_id,
            userid=userid,
            filename=file.filename or "unknown",
            blob_name=blob_name,
            attachment_type=file_type,
        )

        logger.info(f"Attachment uploaded successfully: {attachment_id}")

        return AttachmentUploadResponse(
            url=f"chatbot://{attachment_id}",
            filename=file.filename or "unknown",
            message="Attachment uploaded successfully",
            type=file_type,
        )
    except Exception as e:
        logger.error(f"Error uploading attachment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload attachment: {str(e)}",
        )


@attachment_routes.get("/{attachment_id}", response_model=AttachmentDetailResponse)
async def get_attachment_by_id(
    attachment_id: str,
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="userid header is required",
        )

    try:
        attachment = await db_manager.get_attachment_async(attachment_id)
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attachment not found: {attachment_id}",
            )

        blob_url = await get_file_temporary_link_async(
            attachment.blob_name, expiry=3600
        )

        return AttachmentDetailResponse(
            id=attachment.id,
            filename=attachment.filename,
            blob_url=blob_url,
            userid=attachment.userid,
            type=attachment.type,
            metadata=attachment.metadata,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error retrieving attachment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve attachment: {str(e)}",
        )


@attachment_routes.get("")
async def get_all_attachments(userid: str | None = Header(None)):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="userid header is required",
        )

    try:
        attachments = await db_manager.get_user_attachments_async(userid)
        return {
            "userid": userid,
            "count": len(attachments),
            "attachments": [
                {
                    "id": att.id,
                    "filename": att.filename,
                    "created_at": att.created_at,
                    "type": att.type,
                    "metadata": att.metadata,
                    "url": f"chatbot://{att.id}",
                }
                for att in attachments
            ],
        }
    except Exception as e:
        logger.error(f"Error retrieving all attachments for user {userid}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve attachments: {str(e)}",
        )


@attachment_routes.patch("/{attachment_id}/metadata")
async def update_attachment_metadata(
    attachment_id: str,
    metadata: Dict[str, Any],
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="userid header is required",
        )

    try:
        attachment = await db_manager.get_attachment_async(attachment_id)
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attachment not found: {attachment_id}",
            )

        await db_manager.update_attachment_metadata_async(
            attachment_id, userid, metadata
        )
        updated_attachment = await db_manager.get_attachment_async(attachment_id)
        if not updated_attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attachment not found: {attachment_id}",
            )

        blob_url = await get_file_temporary_link_async(
            updated_attachment.blob_name, expiry=3600
        )

        logger.info(f"Attachment metadata updated: {attachment_id}")

        return {
            "id": updated_attachment.id,
            "filename": updated_attachment.filename,
            "blob_url": blob_url,
            "userid": updated_attachment.userid,
            "type": updated_attachment.type,
            "metadata": updated_attachment.metadata,
            "created_at": updated_attachment.created_at,
            "message": "Metadata updated successfully",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating attachment metadata: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update metadata: {str(e)}",
        )


@attachment_routes.delete("/{attachment_id}")
async def delete_attachment(
    attachment_id: str,
    userid: str | None = Header(None),
):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="userid header is required",
        )

    try:
        attachment = await db_manager.get_attachment_async(attachment_id)
        if not attachment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Attachment not found: {attachment_id}",
            )

        await delete_file_async(attachment.blob_name)
        await db_manager.delete_attachment_async(attachment_id, userid)

        logger.info(f"Attachment deleted successfully: {attachment_id}")

        return {
            "message": "Attachment deleted successfully",
            "attachment_id": attachment_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting attachment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete attachment: {str(e)}",
        )


@attachment_routes.get("/user")
async def get_user_attachments(userid: str | None = Header(None)):
    if not userid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="userid header is required",
        )

    try:
        attachments = await db_manager.get_user_attachments_async(userid)
        return {
            "userid": userid,
            "attachments": [
                {
                    "id": att.id,
                    "filename": att.filename,
                    "created_at": att.created_at,
                    "type": att.type,
                    "metadata": att.metadata,
                    "url": f"chatbot://{att.id}",
                }
                for att in attachments
            ],
        }
    except Exception as e:
        logger.error(f"Error retrieving user attachments: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve attachments: {str(e)}",
        )
