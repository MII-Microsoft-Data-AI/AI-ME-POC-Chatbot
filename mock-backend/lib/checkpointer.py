import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

# Global cached checkpointer instance
_checkpointer_instance = None

async def checkpointer():
    """Get or create the cached checkpointer instance.
    
    This avoids creating a new SQLite connection on every request.
    """
    global _checkpointer_instance
    
    if _checkpointer_instance is not None:
        return _checkpointer_instance
    
    db = await aiosqlite.connect("./mock.db")
    _checkpointer_instance = AsyncSqliteSaver(db)
    
    print("✅ Checkpointer initialized and cached")
    
    return _checkpointer_instance