"""Database models and operations for conversation metadata."""
import os
import time
from typing import List, Optional
from dataclasses import dataclass
from lib.db_connection import db_connection


@dataclass
class ConversationMetadata:
    """Conversation metadata model."""
    id: str
    userid: str
    is_pinned: bool
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
    """Async database manager for conversation metadata."""
    
    def __init__(self):
        self.use_postgres = db_connection.use_postgres
    
    async def create_conversation(self, conversation_id: str, userid: str) -> ConversationMetadata:
        """Create a new conversation metadata entry."""
        created_at = int(time.time())
        
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                await conn.execute("""
                    INSERT INTO conversations (id, userid, is_pinned, created_at)
                    VALUES ($1, $2, $3, $4)
                """, conversation_id, userid, False, created_at)
            else:
                await conn.execute("""
                    INSERT INTO conversations (id, userid, is_pinned, created_at)
                    VALUES (?, ?, ?, ?)
                """, (conversation_id, userid, False, created_at))
                await conn.commit()
        
        return ConversationMetadata(
            id=conversation_id,
            userid=userid,
            is_pinned=False,
            created_at=created_at
        )
    
    async def get_conversation(self, conversation_id: str, userid: str) -> Optional[ConversationMetadata]:
        """Get conversation metadata by ID and userid."""
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                row = await conn.fetchrow("""
                    SELECT id, userid, is_pinned, created_at 
                    FROM conversations 
                    WHERE id = $1 AND userid = $2
                """, conversation_id, userid)
            else:
                cursor = await conn.execute("""
                    SELECT id, userid, is_pinned, created_at 
                    FROM conversations 
                    WHERE id = ? AND userid = ?
                """, (conversation_id, userid))
                row = await cursor.fetchone()
            
            if row:
                return ConversationMetadata(
                    id=row['id'] if self.use_postgres else row[0],
                    userid=row['userid'] if self.use_postgres else row[1],
                    is_pinned=bool(row['is_pinned'] if self.use_postgres else row[2]),
                    created_at=row['created_at'] if self.use_postgres else row[3]
                )
        return None
    
    async def get_user_conversations(self, userid: str) -> List[ConversationMetadata]:
        """Get all conversations for a user, ordered by created_at descending."""
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                rows = await conn.fetch("""
                    SELECT id, userid, is_pinned, created_at 
                    FROM conversations 
                    WHERE userid = $1 
                    ORDER BY created_at DESC
                """, userid)
            else:
                cursor = await conn.execute("""
                    SELECT id, userid, is_pinned, created_at 
                    FROM conversations 
                    WHERE userid = ? 
                    ORDER BY created_at DESC
                """, (userid,))
                rows = await cursor.fetchall()
            
            if self.use_postgres:
                return [
                    ConversationMetadata(
                        id=row['id'],
                        userid=row['userid'],
                        is_pinned=bool(row['is_pinned']),
                        created_at=row['created_at']
                    )
                    for row in rows
                ]
            else:
                return [
                    ConversationMetadata(
                        id=row[0],
                        userid=row[1],
                        is_pinned=bool(row[2]),
                        created_at=row[3]
                    )
                    for row in rows
                ]
    
    async def get_last_conversation_id(self, userid: str) -> Optional[str]:
        """Get the last conversation ID for a user."""
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                row = await conn.fetchrow("""
                    SELECT id 
                    FROM conversations 
                    WHERE userid = $1 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """, userid)
            else:
                cursor = await conn.execute("""
                    SELECT id 
                    FROM conversations 
                    WHERE userid = ? 
                    ORDER BY created_at DESC 
                    LIMIT 1
                """, (userid,))
                row = await cursor.fetchone()
            
            return row['id'] if (self.use_postgres and row) else (row[0] if row else None)
    
    async def pin_conversation(self, conversation_id: str, userid: str, is_pinned: bool = True) -> bool:
        """Pin or unpin a conversation."""
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                result = await conn.execute("""
                    UPDATE conversations 
                    SET is_pinned = $1 
                    WHERE id = $2 AND userid = $3
                """, is_pinned, conversation_id, userid)
                return result != "UPDATE 0"
            else:
                cursor = await conn.execute("""
                    UPDATE conversations 
                    SET is_pinned = ? 
                    WHERE id = ? AND userid = ?
                """, (is_pinned, conversation_id, userid))
                await conn.commit()
                return cursor.rowcount > 0
    
    async def delete_conversation(self, conversation_id: str, userid: str) -> bool:
        """Delete a conversation."""
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                result = await conn.execute("""
                    DELETE FROM conversations 
                    WHERE id = $1 AND userid = $2
                """, conversation_id, userid)
                return result != "DELETE 0"
            else:
                cursor = await conn.execute("""
                    DELETE FROM conversations 
                    WHERE id = ? AND userid = ?
                """, (conversation_id, userid))
                await conn.commit()
                return cursor.rowcount > 0
    
    async def conversation_exists(self, conversation_id: str, userid: str) -> bool:
        """Check if a conversation exists for a user."""
        async with db_connection.get_connection() as conn:
            if self.use_postgres:
                row = await conn.fetchrow("""
                    SELECT 1 FROM conversations 
                    WHERE id = $1 AND userid = $2
                """, conversation_id, userid)
            else:
                cursor = await conn.execute("""
                    SELECT 1 FROM conversations 
                    WHERE id = ? AND userid = ?
                """, (conversation_id, userid))
                row = await cursor.fetchone()
            
            return row is not None

    def create_file(self, file_id: str, userid: str, filename: str, blob_name: str, workflow_id: Optional[str] = None) -> FileMetadata:
        """Create a new file metadata entry."""
        uploaded_at = int(time.time())
        
        with self.get_connection() as conn:
            conn.execute("""
                INSERT INTO files (file_id, userid, filename, blob_name, status, uploaded_at, workflow_id)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (file_id, userid, filename, blob_name, "pending", uploaded_at, workflow_id))
            conn.commit()
        
        return FileMetadata(
            file_id=file_id,
            userid=userid,
            filename=filename,
            blob_name=blob_name,
            status="pending",
            uploaded_at=uploaded_at,
            workflow_id=workflow_id
        )
    
    def get_file(self, file_id: str) -> Optional[FileMetadata]:
        """Get file metadata by ID."""
        with self.get_connection() as conn:
            row = conn.execute("""
                SELECT file_id, userid, filename, blob_name, status, uploaded_at, indexed_at, error_message, workflow_id
                FROM files 
                WHERE file_id = ?
            """, (file_id,)).fetchone()
            
            if row:
                return FileMetadata(
                    file_id=row['file_id'],
                    userid=row['userid'],
                    filename=row['filename'],
                    blob_name=row['blob_name'],
                    status=row['status'],
                    uploaded_at=row['uploaded_at'],
                    indexed_at=row['indexed_at'],
                    error_message=row['error_message'],
                    workflow_id=row['workflow_id']
                )
        return None
    
    def get_user_files(self, userid: str) -> List[FileMetadata]:
        """Get all files for a user, ordered by uploaded_at descending."""
        with self.get_connection() as conn:
            rows = conn.execute("""
                SELECT file_id, userid, filename, blob_name, status, uploaded_at, indexed_at, error_message, workflow_id
                FROM files 
                WHERE userid = ? 
                ORDER BY uploaded_at DESC
            """, (userid,)).fetchall()
            
            return [
                FileMetadata(
                    file_id=row['file_id'],
                    userid=row['userid'],
                    filename=row['filename'],
                    blob_name=row['blob_name'],
                    status=row['status'],
                    uploaded_at=row['uploaded_at'],
                    indexed_at=row['indexed_at'],
                    error_message=row['error_message'],
                    workflow_id=row['workflow_id']
                )
                for row in rows
            ]
    
    def update_file_status(self, file_id: str, status: str, error_message: Optional[str] = None) -> bool:
        """Update file indexing status."""
        indexed_at = int(time.time()) if status == "completed" else None
        
        with self.get_connection() as conn:
            cursor = conn.execute("""
                UPDATE files 
                SET status = ?, indexed_at = ?, error_message = ?
                WHERE file_id = ?
            """, (status, indexed_at, error_message, file_id))
            conn.commit()
            
            return cursor.rowcount > 0
    
    def update_file_workflow_id(self, file_id: str, workflow_id: str) -> bool:
        """Update file workflow ID."""
        with self.get_connection() as conn:
            cursor = conn.execute("""
                UPDATE files 
                SET workflow_id = ?
                WHERE file_id = ?
            """, (workflow_id, file_id))
            conn.commit()
            
            return cursor.rowcount > 0
    
    def delete_file(self, file_id: str, userid: str) -> bool:
        """Delete a file metadata entry."""
        with self.get_connection() as conn:
            cursor = conn.execute("""
                DELETE FROM files 
                WHERE file_id = ? AND userid = ?
            """, (file_id, userid))
            conn.commit()
            
            return cursor.rowcount > 0
    
    def file_exists(self, file_id: str) -> bool:
        """Check if a file exists."""
        with self.get_connection() as conn:
            row = conn.execute("""
                SELECT 1 FROM files 
                WHERE file_id = ?
            """, (file_id,)).fetchone()
            
            return row is not None
# Global database manager instance
db_manager = DatabaseManager()