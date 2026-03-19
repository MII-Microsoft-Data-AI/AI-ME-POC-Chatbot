"""Database models and operations for conversation and file metadata - Cosmos DB."""

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Union

from azure.cosmos.exceptions import CosmosResourceNotFoundError

from lib.db_connection import db_connection


@dataclass
class ConversationMetadata:
    """Conversation metadata model."""

    id: str
    userid: str
    is_pinned: bool
    title: Union[str, None]
    created_at: int


@dataclass
class FileMetadata:
    """File metadata model."""

    file_id: str
    userid: str
    filename: str
    blob_name: str
    status: str
    uploaded_at: int
    indexed_at: Optional[int] = None
    error_message: Optional[str] = None
    workflow_id: Optional[str] = None


@dataclass
class Attachment:
    """Attachment model. Abstraction layer over Azure Blob Storage for langgraph file ingestion in a chat conversation."""

    id: str
    userid: str
    filename: str
    blob_name: str
    type: str
    created_at: int
    metadata: Optional[Dict[str, Any]] = None


class DatabaseManager:
    """Database manager for conversation and file metadata using Cosmos DB."""

    async def rename_conversation_async(
        self, conversation_id: str, userid: str, new_title: str
    ) -> bool:
        return await asyncio.to_thread(
            self.rename_conversation, conversation_id, userid, new_title
        )

    def rename_conversation(
        self, conversation_id: str, userid: str, new_title: str
    ) -> bool:
        container = db_connection.get_conversations_container()

        try:
            item = container.read_item(item=conversation_id, partition_key=userid)
            item["title"] = new_title
            container.replace_item(item=conversation_id, body=item)
            return True
        except CosmosResourceNotFoundError:
            return False

    def create_conversation(
        self, conversation_id: str, title: str, userid: str
    ) -> ConversationMetadata:
        created_at = int(time.time())
        container = db_connection.get_conversations_container()

        document = {
            "id": conversation_id,
            "userid": userid,
            "is_pinned": False,
            "created_at": created_at,
            "title": title,
        }

        container.create_item(body=document)

        return ConversationMetadata(
            title=title,
            id=conversation_id,
            userid=userid,
            is_pinned=False,
            created_at=created_at,
        )

    async def create_conversation_async(
        self, conversation_id: str, title: str, userid: str
    ) -> ConversationMetadata:
        return await asyncio.to_thread(
            self.create_conversation, conversation_id, title, userid
        )

    def get_conversation(
        self, conversation_id: str, userid: str
    ) -> Optional[ConversationMetadata]:
        container = db_connection.get_conversations_container()

        try:
            item = container.read_item(item=conversation_id, partition_key=userid)
            return ConversationMetadata(
                id=item["id"],
                userid=item["userid"],
                is_pinned=item["is_pinned"],
                created_at=item["created_at"],
                title=item.get("title", None),
            )
        except CosmosResourceNotFoundError:
            return None

    async def get_conversation_async(
        self, conversation_id: str, userid: str
    ) -> Optional[ConversationMetadata]:
        return await asyncio.to_thread(self.get_conversation, conversation_id, userid)

    def get_user_conversations(self, userid: str) -> List[ConversationMetadata]:
        container = db_connection.get_conversations_container()

        query = "SELECT * FROM c WHERE c.userid = @userid ORDER BY c.created_at DESC"
        parameters = [{"name": "@userid", "value": userid}]

        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid,
        )

        conversations = []
        for item in items:
            conversations.append(
                ConversationMetadata(
                    id=item["id"],
                    userid=item["userid"],
                    is_pinned=item["is_pinned"],
                    created_at=item["created_at"],
                    title=item.get("title", None),
                )
            )

        return conversations

    async def get_user_conversations_async(
        self, userid: str
    ) -> List[ConversationMetadata]:
        return await asyncio.to_thread(self.get_user_conversations, userid)

    def get_last_conversation_id(self, userid: str) -> Optional[str]:
        container = db_connection.get_conversations_container()

        query = "SELECT TOP 1 c.id FROM c WHERE c.userid = @userid ORDER BY c.created_at DESC"
        parameters = [{"name": "@userid", "value": userid}]

        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid,
        )

        for item in items:
            return item["id"]

        return None

    async def get_last_conversation_id_async(self, userid: str) -> Optional[str]:
        return await asyncio.to_thread(self.get_last_conversation_id, userid)

    def pin_conversation(
        self, conversation_id: str, userid: str, is_pinned: bool = True
    ) -> bool:
        container = db_connection.get_conversations_container()

        try:
            item = container.read_item(item=conversation_id, partition_key=userid)
            item["is_pinned"] = is_pinned
            container.replace_item(item=conversation_id, body=item)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def pin_conversation_async(
        self, conversation_id: str, userid: str, is_pinned: bool = True
    ) -> bool:
        return await asyncio.to_thread(
            self.pin_conversation, conversation_id, userid, is_pinned
        )

    def delete_conversation(self, conversation_id: str, userid: str) -> bool:
        container = db_connection.get_conversations_container()

        try:
            container.delete_item(item=conversation_id, partition_key=userid)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def delete_conversation_async(
        self, conversation_id: str, userid: str
    ) -> bool:
        return await asyncio.to_thread(
            self.delete_conversation, conversation_id, userid
        )

    def conversation_exists(self, conversation_id: str, userid: str) -> bool:
        container = db_connection.get_conversations_container()

        try:
            container.read_item(item=conversation_id, partition_key=userid)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def conversation_exists_async(
        self, conversation_id: str, userid: str
    ) -> bool:
        return await asyncio.to_thread(
            self.conversation_exists, conversation_id, userid
        )

    def create_file(
        self,
        file_id: str,
        userid: str,
        filename: str,
        blob_name: str,
        workflow_id: Optional[str] = None,
    ) -> FileMetadata:
        uploaded_at = int(time.time())
        container = db_connection.get_files_container()

        document = {
            "id": file_id,
            "file_id": file_id,
            "userid": userid,
            "filename": filename,
            "blob_name": blob_name,
            "status": "pending",
            "uploaded_at": uploaded_at,
            "indexed_at": None,
            "error_message": None,
            "workflow_id": workflow_id,
        }

        container.create_item(body=document)

        return FileMetadata(
            file_id=file_id,
            userid=userid,
            filename=filename,
            blob_name=blob_name,
            status="pending",
            uploaded_at=uploaded_at,
            workflow_id=workflow_id,
        )

    async def create_file_async(
        self,
        file_id: str,
        userid: str,
        filename: str,
        blob_name: str,
        workflow_id: Optional[str] = None,
    ) -> FileMetadata:
        return await asyncio.to_thread(
            self.create_file,
            file_id,
            userid,
            filename,
            blob_name,
            workflow_id,
        )

    def get_file(self, file_id: str, userid: str) -> Optional[FileMetadata]:
        container = db_connection.get_files_container()

        try:
            item = container.read_item(item=file_id, partition_key=userid)
            return FileMetadata(
                file_id=item["file_id"],
                userid=item["userid"],
                filename=item["filename"],
                blob_name=item["blob_name"],
                status=item["status"],
                uploaded_at=item["uploaded_at"],
                indexed_at=item.get("indexed_at"),
                error_message=item.get("error_message"),
                workflow_id=item.get("workflow_id"),
            )
        except CosmosResourceNotFoundError:
            return None

    async def get_file_async(self, file_id: str, userid: str) -> Optional[FileMetadata]:
        return await asyncio.to_thread(self.get_file, file_id, userid)

    def get_user_files(self, userid: str) -> List[FileMetadata]:
        container = db_connection.get_files_container()

        query = "SELECT * FROM c WHERE c.userid = @userid ORDER BY c.uploaded_at DESC"
        parameters = [{"name": "@userid", "value": userid}]

        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid,
        )

        files = []
        for item in items:
            files.append(
                FileMetadata(
                    file_id=item["file_id"],
                    userid=item["userid"],
                    filename=item["filename"],
                    blob_name=item["blob_name"],
                    status=item["status"],
                    uploaded_at=item["uploaded_at"],
                    indexed_at=item.get("indexed_at"),
                    error_message=item.get("error_message"),
                    workflow_id=item.get("workflow_id"),
                )
            )

        return files

    async def get_user_files_async(self, userid: str) -> List[FileMetadata]:
        return await asyncio.to_thread(self.get_user_files, userid)

    def update_file_status(
        self,
        file_id: str,
        userid: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> bool:
        container = db_connection.get_files_container()

        try:
            item = container.read_item(item=file_id, partition_key=userid)
            item["status"] = status
            item["error_message"] = error_message
            if status == "completed":
                item["indexed_at"] = int(time.time())
            container.replace_item(item=file_id, body=item)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def update_file_status_async(
        self,
        file_id: str,
        userid: str,
        status: str,
        error_message: Optional[str] = None,
    ) -> bool:
        return await asyncio.to_thread(
            self.update_file_status, file_id, userid, status, error_message
        )

    def update_file_workflow_id(
        self, file_id: str, userid: str, workflow_id: str
    ) -> bool:
        container = db_connection.get_files_container()

        try:
            item = container.read_item(item=file_id, partition_key=userid)
            item["workflow_id"] = workflow_id
            container.replace_item(item=file_id, body=item)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def update_file_workflow_id_async(
        self, file_id: str, userid: str, workflow_id: str
    ) -> bool:
        return await asyncio.to_thread(
            self.update_file_workflow_id, file_id, userid, workflow_id
        )

    def delete_file(self, file_id: str, userid: str) -> bool:
        container = db_connection.get_files_container()

        try:
            container.delete_item(item=file_id, partition_key=userid)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def delete_file_async(self, file_id: str, userid: str) -> bool:
        return await asyncio.to_thread(self.delete_file, file_id, userid)

    def file_exists(self, file_id: str, userid: str) -> bool:
        container = db_connection.get_files_container()

        try:
            container.read_item(item=file_id, partition_key=userid)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def file_exists_async(self, file_id: str, userid: str) -> bool:
        return await asyncio.to_thread(self.file_exists, file_id, userid)

    def create_attachment(
        self,
        attachment_id: str,
        userid: str,
        filename: str,
        blob_name: str,
        attachment_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Attachment:
        created_at = int(time.time())
        container = db_connection.get_attachments_container()

        document = {
            "id": attachment_id,
            "userid": userid,
            "filename": filename,
            "blob_name": blob_name,
            "type": attachment_type,
            "created_at": created_at,
            "metadata": metadata,
        }

        container.create_item(body=document)

        return Attachment(
            id=attachment_id,
            userid=userid,
            filename=filename,
            blob_name=blob_name,
            type=attachment_type,
            created_at=created_at,
            metadata=metadata,
        )

    async def create_attachment_async(
        self,
        attachment_id: str,
        userid: str,
        filename: str,
        blob_name: str,
        attachment_type: str,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Attachment:
        return await asyncio.to_thread(
            self.create_attachment,
            attachment_id,
            userid,
            filename,
            blob_name,
            attachment_type,
            metadata,
        )

    def get_attachment(self, attachment_id: str) -> Optional[Attachment]:
        container = db_connection.get_attachments_container()

        try:
            query = "SELECT * FROM c WHERE c.id = @id"
            parameters = [{"name": "@id", "value": attachment_id}]

            items = list(
                container.query_items(
                    query=query,
                    parameters=parameters,
                    enable_cross_partition_query=True,
                )
            )

            for item in items:
                return Attachment(
                    id=item["id"],
                    userid=item["userid"],
                    filename=item["filename"],
                    blob_name=item["blob_name"],
                    type=item["type"],
                    created_at=item["created_at"],
                    metadata=item.get("metadata"),
                )

            return None
        except CosmosResourceNotFoundError:
            return None

    async def get_attachment_async(self, attachment_id: str) -> Optional[Attachment]:
        return await asyncio.to_thread(self.get_attachment, attachment_id)

    def get_user_attachments(self, userid: str) -> List[Attachment]:
        container = db_connection.get_attachments_container()

        query = "SELECT * FROM c WHERE c.userid = @userid ORDER BY c.created_at DESC"
        parameters = [{"name": "@userid", "value": userid}]

        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid,
        )

        attachments = []
        for item in items:
            attachments.append(
                Attachment(
                    id=item["id"],
                    userid=item["userid"],
                    filename=item["filename"],
                    blob_name=item["blob_name"],
                    type=item["type"],
                    created_at=item["created_at"],
                    metadata=item.get("metadata"),
                )
            )

        return attachments

    async def get_user_attachments_async(self, userid: str) -> List[Attachment]:
        return await asyncio.to_thread(self.get_user_attachments, userid)

    def update_attachment_metadata(
        self, attachment_id: str, userid: str, metadata: Optional[Dict[str, Any]]
    ) -> bool:
        container = db_connection.get_attachments_container()

        try:
            item = container.read_item(item=attachment_id, partition_key=userid)
            item["metadata"] = metadata
            container.replace_item(item=attachment_id, body=item)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def update_attachment_metadata_async(
        self, attachment_id: str, userid: str, metadata: Optional[Dict[str, Any]]
    ) -> bool:
        return await asyncio.to_thread(
            self.update_attachment_metadata, attachment_id, userid, metadata
        )

    def update_attachment_type(
        self, attachment_id: str, userid: str, attachment_type: str
    ) -> bool:
        container = db_connection.get_attachments_container()

        try:
            item = container.read_item(item=attachment_id, partition_key=userid)
            item["type"] = attachment_type
            container.replace_item(item=attachment_id, body=item)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def update_attachment_type_async(
        self, attachment_id: str, userid: str, attachment_type: str
    ) -> bool:
        return await asyncio.to_thread(
            self.update_attachment_type, attachment_id, userid, attachment_type
        )

    def delete_attachment(self, attachment_id: str, userid: str) -> bool:
        container = db_connection.get_attachments_container()

        try:
            container.delete_item(item=attachment_id, partition_key=userid)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def delete_attachment_async(self, attachment_id: str, userid: str) -> bool:
        return await asyncio.to_thread(self.delete_attachment, attachment_id, userid)

    def attachment_exists(self, attachment_id: str, userid: str) -> bool:
        container = db_connection.get_attachments_container()

        try:
            container.read_item(item=attachment_id, partition_key=userid)
            return True
        except CosmosResourceNotFoundError:
            return False

    async def attachment_exists_async(self, attachment_id: str, userid: str) -> bool:
        return await asyncio.to_thread(self.attachment_exists, attachment_id, userid)


db_manager = DatabaseManager()
