"""Main FastAPI server with LangGraph integration."""
import sys
import os

sys.dont_write_bytecode = True

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

from typing import Annotated
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends

# Utils and modules
from lib.auth import get_authenticated_user

# Run orchestration
from orchestration import get_orchestrator
orchestrator = get_orchestrator()
orchestrator.start()

# Initialize FastAPI app
app = FastAPI(title="LangGraph Azure Inference API", version="1.0.0")

# Add CORS middleware to allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods
    allow_headers=["*"],  # Allow all headers
)

# Add timing middleware for debugging
import time
from fastapi import Request

@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add timing information to debug slow requests."""
    start_time = time.time()
    print(f"⏱️  [{request.method}] {request.url.path} - START")
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    print(f"⏱️  [{request.method}] {request.url.path} - DONE in {process_time:.3f}s")
    
    return response

@app.on_event("startup")
async def startup_event():
    """Initialize expensive resources at startup."""
    print("🚀 Initializing application...")
    
    # Initialize database connection pool
    from lib.db_connection import db_connection
    if db_connection.use_postgres:
        print("🐘 Initializing PostgreSQL connection pool...")
        await db_connection.init_postgres_pool()
    else:
        print("📁 Using SQLite database")
    
    # Run migrations
    print("🔄 Running database migrations...")
    from migrations.migrate import run_migrations
    await run_migrations()
    
    # Initialize LangGraph
    print("🤖 Initializing LangGraph...")
    from agent.graph import get_graph
    await get_graph()  # This will cache the graph
    
    print("✅ Server ready")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on shutdown."""
    from lib.db_connection import db_connection
    if db_connection.use_postgres:
        print("🔌 Closing PostgreSQL connection pool...")
        await db_connection.close_postgres_pool()

@app.get("/")
async def root(username: Annotated[str, Depends(get_authenticated_user)]):
    """Root endpoint."""
    return {"message": "LangGraph Azure Inference API is running", "authenticated_user": username}


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Add external routers
from routes.chat_conversation import chat_conversation_route
from routes.file_indexing import file_indexing_route
from routes.image_generation import image_generation_route

app.include_router(
    chat_conversation_route
)

app.include_router(
    file_indexing_route,
    prefix="/api/v1",
    tags=["file-indexing"]
)

app.include_router(
    image_generation_route,
    prefix="/api/v1",
    tags=["image-generation"]
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))