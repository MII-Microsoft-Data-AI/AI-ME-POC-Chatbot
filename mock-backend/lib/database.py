"""Database models and operations for conversation and file metadata - Cosmos DB."""
import time
from typing import List, Optional, Union
from dataclasses import dataclass, asdict
from lib.db_connection import db_connection
from azure.cosmos.exceptions import CosmosResourceNotFoundError


@dataclass
class ConversationMetadata:
    """Conversation metadata model."""
    id: str
    userid: str
    is_pinned: bool
    title: Union[str, None]
    created_at: int  # epoch timestamp


@dataclass
class FileMetadata:
    """File metadata model."""
    file_id: str
    userid: str
    filename: str
    blob_name: str
    status: str  # "pending", "in_progress", "completed", "failed"
    uploaded_at: int  # epoch timestamp
    indexed_at: Optional[int] = None  # epoch timestamp when indexing completed
    error_message: Optional[str] = None
    workflow_id: Optional[str] = None  # orchestration workflow ID


class DatabaseManager:
    """Async database manager for conversation and file metadata using Cosmos DB."""
    
    def __init__(self):
        pass

    async def rename_conversation(self, conversation_id: str, userid: str, new_title: str) -> bool:
        """Rename a conversation."""
        container = db_connection.get_conversations_container()
        
        try:
            # Read the item first
            item = await container.read_item(
                item=conversation_id,
                partition_key=userid
            )
            
            # Update the title field
            item['title'] = new_title

            # Replace the item
            await container.replace_item(
                item=conversation_id,
                body=item
            )
            
            return True
        except CosmosResourceNotFoundError:
            return False
    
    async def create_conversation(self, conversation_id: str, title: str, userid: str) -> ConversationMetadata:
        """Create a new conversation metadata entry."""
        created_at = int(time.time())
        
        container = db_connection.get_conversations_container()
        
        document = {
            "id": conversation_id,
            "userid": userid,
            "is_pinned": False,
            "created_at": created_at,
            "title": title 
        }
        
        await container.create_item(body=document)
        
        return ConversationMetadata(
            title=title,
            id=conversation_id,
            userid=userid,
            is_pinned=False,
            created_at=created_at
        )
    
    async def get_conversation(self, conversation_id: str, userid: str) -> Optional[ConversationMetadata]:
        """Get conversation metadata by ID and userid."""
        container = db_connection.get_conversations_container()
        
        try:
            item = await container.read_item(
                item=conversation_id,
                partition_key=userid
            )
            
            return ConversationMetadata(
                id=item['id'],
                userid=item['userid'],
                is_pinned=item['is_pinned'],
                created_at=item['created_at'],
                title=item.get('title', None)
            )
        except CosmosResourceNotFoundError:
            return None
    
    async def get_user_conversations(self, userid: str) -> List[ConversationMetadata]:
        """Get all conversations for a user, ordered by created_at descending."""
        container = db_connection.get_conversations_container()
        
        query = "SELECT * FROM c WHERE c.userid = @userid ORDER BY c.created_at DESC"
        parameters = [{"name": "@userid", "value": userid}]
        
        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid
        )
        
        conversations = []
        async for item in items:
            conversations.append(ConversationMetadata(
                id=item['id'],
                userid=item['userid'],
                is_pinned=item['is_pinned'],
                created_at=item['created_at'],
                title=item.get('title', None)
            ))
        
        return conversations
    
    async def get_last_conversation_id(self, userid: str) -> Optional[str]:
        """Get the last conversation ID for a user."""
        container = db_connection.get_conversations_container()
        
        query = "SELECT TOP 1 c.id FROM c WHERE c.userid = @userid ORDER BY c.created_at DESC"
        parameters = [{"name": "@userid", "value": userid}]
        
        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid
        )
        
        async for item in items:
            return item['id']
        
        return None
    
    async def pin_conversation(self, conversation_id: str, userid: str, is_pinned: bool = True) -> bool:
        """Pin or unpin a conversation."""
        container = db_connection.get_conversations_container()
        
        try:
            # Read the item first
            item = await container.read_item(
                item=conversation_id,
                partition_key=userid
            )
            
            # Update the is_pinned field
            item['is_pinned'] = is_pinned
            
            # Replace the item
            await container.replace_item(
                item=conversation_id,
                body=item
            )
            
            return True
        except CosmosResourceNotFoundError:
            return False
    
    async def delete_conversation(self, conversation_id: str, userid: str) -> bool:
        """Delete a conversation."""
        container = db_connection.get_conversations_container()
        
        try:
            await container.delete_item(
                item=conversation_id,
                partition_key=userid
            )
            return True
        except CosmosResourceNotFoundError:
            return False
    
    async def conversation_exists(self, conversation_id: str, userid: str) -> bool:
        """Check if a conversation exists for a user."""
        container = db_connection.get_conversations_container()
        
        try:
            await container.read_item(
                item=conversation_id,
                partition_key=userid
            )
            return True
        except CosmosResourceNotFoundError:
            return False
    
    # File operations
    async def create_file(self, file_id: str, userid: str, filename: str, blob_name: str, workflow_id: Optional[str] = None) -> FileMetadata:
        """Create a new file metadata entry."""
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
            "workflow_id": workflow_id
        }
        
        await container.create_item(body=document)
        
        return FileMetadata(
            file_id=file_id,
            userid=userid,
            filename=filename,
            blob_name=blob_name,
            status="pending",
            uploaded_at=uploaded_at,
            workflow_id=workflow_id
        )
    
    async def get_file(self, file_id: str, userid: str) -> Optional[FileMetadata]:
        """Get file metadata by ID."""
        container = db_connection.get_files_container()
        
        try:
            item = await container.read_item(
                item=file_id,
                partition_key=userid
            )
            
            return FileMetadata(
                file_id=item['file_id'],
                userid=item['userid'],
                filename=item['filename'],
                blob_name=item['blob_name'],
                status=item['status'],
                uploaded_at=item['uploaded_at'],
                indexed_at=item.get('indexed_at'),
                error_message=item.get('error_message'),
                workflow_id=item.get('workflow_id')
            )
        except CosmosResourceNotFoundError:
            return None
    
    async def get_user_files(self, userid: str) -> List[FileMetadata]:
        """Get all files for a user, ordered by uploaded_at descending."""
        container = db_connection.get_files_container()
        
        query = "SELECT * FROM c WHERE c.userid = @userid ORDER BY c.uploaded_at DESC"
        parameters = [{"name": "@userid", "value": userid}]
        
        items = container.query_items(
            query=query,
            parameters=parameters,
            partition_key=userid
        )
        
        files = []
        async for item in items:
            files.append(FileMetadata(
                file_id=item['file_id'],
                userid=item['userid'],
                filename=item['filename'],
                blob_name=item['blob_name'],
                status=item['status'],
                uploaded_at=item['uploaded_at'],
                indexed_at=item.get('indexed_at'),
                error_message=item.get('error_message'),
                workflow_id=item.get('workflow_id')
            ))
        
        return files
    
    async def update_file_status(self, file_id: str, userid: str, status: str, error_message: Optional[str] = None) -> bool:
        """Update file indexing status."""
        container = db_connection.get_files_container()
        
        try:
            # Read the item first
            item = await container.read_item(
                item=file_id,
                partition_key=userid
            )
            
            # Update fields
            item['status'] = status
            item['error_message'] = error_message
            if status == "completed":
                item['indexed_at'] = int(time.time())
            
            # Replace the item
            await container.replace_item(
                item=file_id,
                body=item
            )
            
            return True
        except CosmosResourceNotFoundError:
            return False
    
    async def update_file_workflow_id(self, file_id: str, userid: str, workflow_id: str) -> bool:
        """Update file workflow ID."""
        container = db_connection.get_files_container()
        
        try:
            # Read the item first
            item = await container.read_item(
                item=file_id,
                partition_key=userid
            )
            
            # Update workflow_id
            item['workflow_id'] = workflow_id
            
            # Replace the item
            await container.replace_item(
                item=file_id,
                body=item
            )
            
            return True
        except CosmosResourceNotFoundError:
            return False
    
    async def delete_file(self, file_id: str, userid: str) -> bool:
        """Delete a file metadata entry."""
        container = db_connection.get_files_container()
        
        try:
            await container.delete_item(
                item=file_id,
                partition_key=userid
            )
            return True
        except CosmosResourceNotFoundError:
            return False
    
    async def file_exists(self, file_id: str, userid: str) -> bool:
        """Check if a file exists."""
        container = db_connection.get_files_container()
        
        try:
            await container.read_item(
                item=file_id,
                partition_key=userid
            )
            return True
        except CosmosResourceNotFoundError:
            return False

# Global database manager instance
db_manager = DatabaseManager()