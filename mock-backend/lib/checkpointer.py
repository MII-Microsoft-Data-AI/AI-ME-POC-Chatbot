import aiosqlite
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

async def checkpointer():
    db = aiosqlite.connect("./mock.db", )
    checkpointer = AsyncSqliteSaver(db)
    return checkpointer