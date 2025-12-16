"""Database connection factory - supports both SQLite and PostgreSQL."""
import os
from typing import Any, Optional
from contextlib import asynccontextmanager
import asyncpg
import aiosqlite

class DatabaseConnection:
    """Async database connection manager."""
    
    def __init__(self):
        self.use_postgres = os.getenv("USE_POSTGRES", "false").lower() == "true"
        self.postgres_url = os.getenv("POSTGRES_URL")
        self.sqlite_path = os.getenv("DB_PATH_CHATBOT", "mock.db")
        
        # Connection pool for PostgreSQL
        self._pg_pool: Optional[asyncpg.Pool] = None
    
    async def init_postgres_pool(self):
        """Initialize PostgreSQL connection pool."""
        if self.use_postgres and not self._pg_pool:
            self._pg_pool = await asyncpg.create_pool(
                self.postgres_url,
                min_size=2,
                max_size=10,
                command_timeout=60
            )
            print("✅ PostgreSQL connection pool initialized")
    
    async def close_postgres_pool(self):
        """Close PostgreSQL connection pool."""
        if self._pg_pool:
            await self._pg_pool.close()
            print("🔌 PostgreSQL connection pool closed")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection (PostgreSQL or SQLite)."""
        if self.use_postgres:
            if not self._pg_pool:
                await self.init_postgres_pool()
            
            async with self._pg_pool.acquire() as conn:
                yield conn
        else:
            # SQLite connection
            async with aiosqlite.connect(self.sqlite_path) as conn:
                conn.row_factory = aiosqlite.Row
                yield conn

# Global database connection instance
db_connection = DatabaseConnection()
