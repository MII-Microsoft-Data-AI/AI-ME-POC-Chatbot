import os
import uuid
import logging
from datetime import datetime, timedelta
from typing import Any, Annotated, List

from azure.core.credentials import AzureKeyCredential
from azure.search.documents.aio import SearchClient
from azure.storage.blob import BlobSasPermissions, generate_blob_sas
from azure.storage.blob.aio import BlobServiceClient
from fastapi import APIRouter, Depends, File, Header, HTTPException, UploadFile
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from pydantic import BaseModel

from lib.database import FileMetadata, db_manager
from orchestration import get_orchestrator


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

file_indexing_route = APIRouter()
security = HTTPBasic()


def require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


class FileUploadResponse(BaseModel):
    file_id: str
    filename: str
    status: str
    message: str


class FileListResponse(BaseModel):
    files: List[FileMetadata]


class FileDeleteResponse(BaseModel):
    file_id: str
    message: str
    success: bool


class ChunkDetailResponse(BaseModel):
    content: str
    metadata: dict
    file_url: str


def get_blob_service_client() -> BlobServiceClient:
    return BlobServiceClient.from_connection_string(
        require_env("AZURE_STORAGE_CONNECTION_STRING")
    )


def get_search_client() -> SearchClient:
    return SearchClient(
        endpoint=require_env("AZURE_SEARCH_ENDPOINT"),
        index_name=require_env("AZURE_SEARCH_INDEX_NAME"),
        credential=AzureKeyCredential(require_env("AZURE_SEARCH_API_KEY")),
    )


async def _upload_file_and_start_indexing(
    file_id: str,
    userid: str,
    filename: str,
    file_content: bytes,
) -> None:
    blob_name = f"{userid}/{file_id}_{filename}"
    container_name = require_env("AZURE_STORAGE_CONTAINER_NAME")

    async with get_blob_service_client() as blob_service:
        try:
            await blob_service.create_container(container_name)
        except Exception:
            pass

        blob_client = blob_service.get_blob_client(
            container=container_name, blob=blob_name
        )
        await blob_client.upload_blob(file_content, overwrite=True)

    await db_manager.create_file_async(
        file_id=file_id,
        userid=userid,
        filename=filename,
        blob_name=blob_name,
    )

    try:
        orchestrator = get_orchestrator()
        workflow_id = orchestrator.invoke_workflow(
            name="index_file_v1", file_id=file_id, userid=userid
        )
        await db_manager.update_file_workflow_id_async(file_id, userid, workflow_id)
        logger.info(
            f"Started indexing workflow for file {file_id}, workflow_id: {workflow_id}"
        )
    except Exception as e:
        logger.error(f"Failed to start indexing workflow: {str(e)}")
        await db_manager.update_file_status_async(
            file_id, userid, "failed", f"Failed to start indexing: {str(e)}"
        )


@file_indexing_route.post("/files", response_model=FileUploadResponse)
async def upload_file(
    file: UploadFile = File(...),
    userid: Annotated[str | None, Header()] = None,
    credentials: HTTPBasicCredentials = Depends(security),
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")
        if not file.filename:
            raise HTTPException(status_code=400, detail="No file provided")

        file_id = str(uuid.uuid4())
        file_content = await file.read()
        await _upload_file_and_start_indexing(
            file_id, userid, file.filename, file_content
        )

        return FileUploadResponse(
            file_id=file_id,
            filename=file.filename,
            status="pending",
            message="File uploaded successfully and indexing started",
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"File upload failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")


@file_indexing_route.get("/files", response_model=FileListResponse)
async def list_files(
    credentials: HTTPBasicCredentials = Depends(security),
    userid: Annotated[str | None, Header()] = None,
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")

        files = await db_manager.get_user_files_async(userid)
        updated_files = []
        for file_metadata in files:
            if file_metadata.workflow_id:
                try:
                    orchestrator = get_orchestrator()
                    workflow_status: dict[str, Any] = (
                        orchestrator.get_workflow_status(
                            workflow_id=file_metadata.workflow_id
                        )
                        or {}
                    )

                    new_status = file_metadata.status
                    new_error = file_metadata.error_message
                    workflow_state = workflow_status.get("status")
                    workflow_output = workflow_status.get("output")

                    if workflow_state in {"running", "processing"}:
                        new_status = "in_progress"
                    elif workflow_state == "failed":
                        new_status = "failed"
                        new_error = (
                            workflow_status.get("error_message")
                            or workflow_status.get("error")
                            or "Workflow failed"
                        )
                    elif (
                        workflow_state in {"completed", "done"}
                        and workflow_output is False
                    ):
                        new_status = "failed"
                        new_error = (
                            workflow_status.get("error_message")
                            or workflow_status.get("error")
                            or "Workflow completed with failure output"
                        )
                    elif workflow_state in {"completed", "done"}:
                        new_status = "completed"

                    if (
                        new_status != file_metadata.status
                        or new_error != file_metadata.error_message
                    ):
                        await db_manager.update_file_status_async(
                            file_metadata.file_id, userid, new_status, new_error
                        )
                        file_metadata.status = new_status
                        file_metadata.error_message = new_error
                except Exception as e:
                    logger.warning(
                        f"Failed to get workflow status for {file_metadata.file_id}: {str(e)}"
                    )

            updated_files.append(file_metadata)

        return FileListResponse(files=updated_files)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list files: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list files: {str(e)}")


@file_indexing_route.get("/files/{file_id}", response_model=FileMetadata)
async def get_file_status(
    file_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    userid: Annotated[str | None, Header()] = None,
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")

        file_metadata = await db_manager.get_file_async(file_id, userid)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        if file_metadata.userid != userid:
            raise HTTPException(status_code=403, detail="Access denied")

        if file_metadata.workflow_id:
            try:
                orchestrator = get_orchestrator()
                workflow_status: dict[str, Any] = (
                    orchestrator.get_workflow_status(
                        workflow_id=file_metadata.workflow_id
                    )
                    or {}
                )
                workflow_state = workflow_status.get("status")
                workflow_output = workflow_status.get("output")

                if workflow_state in {"running", "processing"}:
                    if file_metadata.status != "in_progress":
                        await db_manager.update_file_status_async(
                            file_id, userid, "in_progress"
                        )
                        file_metadata.status = "in_progress"
                elif workflow_state == "failed" or (
                    workflow_state in {"completed", "done"} and workflow_output is False
                ):
                    error_msg = (
                        workflow_status.get("error_message")
                        or workflow_status.get("error")
                        or "Workflow failed"
                    )
                    if (
                        file_metadata.status != "failed"
                        or file_metadata.error_message != error_msg
                    ):
                        await db_manager.update_file_status_async(
                            file_id, userid, "failed", error_msg
                        )
                        file_metadata.status = "failed"
                        file_metadata.error_message = error_msg
                elif workflow_state in {"completed", "done"}:
                    if file_metadata.status != "completed":
                        await db_manager.update_file_status_async(
                            file_id, userid, "completed"
                        )
                        file_metadata.status = "completed"
            except Exception as e:
                logger.warning(f"Failed to get workflow status for {file_id}: {str(e)}")

        return file_metadata
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get file status: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get file status: {str(e)}"
        )


@file_indexing_route.delete("/files/{file_id}", response_model=FileDeleteResponse)
async def delete_file(
    file_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    userid: Annotated[str | None, Header()] = None,
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")
        user_id = userid

        file_metadata = await db_manager.get_file_async(file_id, user_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        if file_metadata.userid != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        try:
            async with get_search_client() as search_client:
                results = await search_client.search(
                    search_text="*", filter=f"file_id eq '{file_id}'"
                )
                doc_ids = [doc["id"] async for doc in results]
                if doc_ids:
                    await search_client.delete_documents(
                        [{"id": doc_id} for doc_id in doc_ids]
                    )
                    logger.info(
                        f"Deleted {len(doc_ids)} chunks from search index for file {file_id}"
                    )
        except Exception as e:
            logger.warning(f"Failed to delete from search index: {str(e)}")

        try:
            container_name = require_env("AZURE_STORAGE_CONTAINER_NAME")
            async with get_blob_service_client() as blob_service:
                blob_client = blob_service.get_blob_client(
                    container=container_name, blob=file_metadata.blob_name
                )
                await blob_client.delete_blob()
                logger.info(f"Deleted blob {file_metadata.blob_name}")
        except Exception as e:
            logger.warning(f"Failed to delete blob: {str(e)}")

        success = await db_manager.delete_file_async(file_id, user_id)
        if success:
            return FileDeleteResponse(
                file_id=file_id,
                message="File and all associated data deleted successfully",
                success=True,
            )

        raise HTTPException(
            status_code=500, detail="Failed to delete file from database"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")


@file_indexing_route.post("/files/{file_id}/reindex")
async def reindex_file(
    file_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    userid: Annotated[str | None, Header()] = None,
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")
        user_id = userid

        file_metadata = await db_manager.get_file_async(file_id, user_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        if file_metadata.userid != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        await db_manager.update_file_status_async(file_id, user_id, "pending")

        orchestrator = get_orchestrator()
        workflow_id = orchestrator.invoke_workflow(
            name="index_file_v1", file_id=file_id, userid=user_id
        )
        await db_manager.update_file_workflow_id_async(file_id, user_id, workflow_id)
        logger.info(
            f"Started re-indexing workflow for file {file_id}, workflow_id: {workflow_id}"
        )

        return {
            "file_id": file_id,
            "workflow_id": workflow_id,
            "message": "Re-indexing started successfully",
            "status": "pending",
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to start re-indexing: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to start re-indexing: {str(e)}"
        )


@file_indexing_route.get("/files/{file_id}/workflow-status")
async def get_workflow_status(
    file_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    userid: Annotated[str | None, Header()] = None,
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")
        user_id = userid

        file_metadata = await db_manager.get_file_async(file_id, user_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        if file_metadata.userid != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        if not file_metadata.workflow_id:
            return {
                "file_id": file_id,
                "workflow_id": None,
                "status": "no_workflow",
                "message": "No workflow ID found for this file",
            }

        try:
            orchestrator = get_orchestrator()
            workflow_status: dict[str, Any] = (
                orchestrator.get_workflow_status(workflow_id=file_metadata.workflow_id)
                or {}
            )
            return {
                "file_id": file_id,
                "workflow_id": file_metadata.workflow_id,
                "status": workflow_status.get("status", "unknown"),
                "workflow_details": workflow_status,
            }
        except Exception as e:
            return {
                "file_id": file_id,
                "workflow_id": file_metadata.workflow_id,
                "status": "error",
                "error": str(e),
                "message": "Failed to get workflow status",
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get workflow status: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get workflow status: {str(e)}"
        )


@file_indexing_route.get("/chunk/{chunk_id}", response_model=ChunkDetailResponse)
async def get_chunk_detail(
    chunk_id: str,
    credentials: HTTPBasicCredentials = Depends(security),
    userid: Annotated[str | None, Header()] = None,
):
    try:
        if not userid:
            raise HTTPException(status_code=400, detail="Missing userid header")
        user_id = userid

        async with get_search_client() as search_client:
            results = await search_client.search(
                search_text="*", filter=f"id eq '{chunk_id}'", top=1
            )
            chunks = [doc async for doc in results]

        if not chunks:
            raise HTTPException(status_code=404, detail="Chunk not found")

        chunk = chunks[0]
        content = chunk["content"]
        metadata = dict(chunk)

        file_id = metadata.get("file_id")
        if not file_id:
            raise HTTPException(
                status_code=404, detail="File ID not found in chunk metadata"
            )

        file_metadata = await db_manager.get_file_async(file_id, user_id)
        if not file_metadata:
            raise HTTPException(status_code=404, detail="File not found")
        if file_metadata.userid != user_id:
            raise HTTPException(status_code=403, detail="Access denied")

        container_name = require_env("AZURE_STORAGE_CONTAINER_NAME")
        async with get_blob_service_client() as blob_service:
            account_name = blob_service.account_name
            if account_name is None:
                raise ValueError("Blob service account name is missing")

            sas_token = generate_blob_sas(
                account_name=account_name,
                container_name=container_name,
                blob_name=file_metadata.blob_name,
                account_key=blob_service.credential.account_key,
                permission=BlobSasPermissions(read=True),
                expiry=datetime.utcnow() + timedelta(hours=1),
            )

        file_url = (
            f"https://{account_name}.blob.core.windows.net/"
            f"{container_name}/{file_metadata.blob_name}?{sas_token}"
        )

        return ChunkDetailResponse(
            content=content, metadata=metadata, file_url=file_url
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get chunk detail: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to get chunk detail: {str(e)}"
        )
