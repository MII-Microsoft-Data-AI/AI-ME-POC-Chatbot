"""Main FastAPI server with LangGraph integration."""

import sys

sys.dont_write_bytecode = True

# Load environment variables
from dotenv import load_dotenv

load_dotenv()

# Disable Azure Cosmos DB HTTP logging
import logging

logging.getLogger("azure.cosmos._cosmos_http_logging_policy").setLevel(logging.WARNING)

from typing import Annotated
from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, Depends
from fastapi.concurrency import run_in_threadpool
from lib.application_config import (
    get_application_config,
    get_int_application_config_value,
    get_required_application_config_value,
)

# Utils and modules
from lib.auth import get_authenticated_user

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
from lib.auth import verify_credentials


@app.middleware("http")
async def add_timing_header(request: Request, call_next):
    """Add timing information to debug slow requests."""
    start_time = time.time()
    print(f"⏱️  [{request.method}] {request.url.path} - START")
    try:
        response = await call_next(request)
    except Exception as e:
        print(f"❌ Error processing request: {e}")
        raise e
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    print(f"⏱️  [{request.method}] {request.url.path} - DONE in {process_time:.3f}s")
    return response


@app.on_event("startup")
async def startup_event():
    """Initialize expensive resources at startup."""
    print("🚀 Initializing application...")

    # Initialize Cosmos DB client
    from lib.db_connection import db_connection

    print("🌐 Initializing Cosmos DB client...")
    await db_connection.init_cosmos_client()

    # Start orchestration engine
    print("🧩 Starting orchestrator...")
    from orchestration import get_orchestrator

    orchestrator = await run_in_threadpool(get_orchestrator)
    await run_in_threadpool(orchestrator.start)
    app.state.orchestrator = orchestrator

    # Initialize LangGraph
    print("🤖 Initializing LangGraph...")
    from agent.graph import get_graph

    await run_in_threadpool(get_graph)

    print("✅ Server ready")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup resources on shutdown."""
    orchestrator = getattr(app.state, "orchestrator", None)
    if orchestrator is not None:
        print("🛑 Stopping orchestrator...")
        await run_in_threadpool(orchestrator.stop)

    from lib.db_connection import db_connection

    print("🔌 Closing Cosmos DB client...")
    await db_connection.close_cosmos_client()


@app.get("/")
async def root(username: Annotated[str, Depends(get_authenticated_user)]):
    """Root endpoint."""
    return {
        "message": "LangGraph Azure Inference API is running",
        "authenticated_user": username,
    }


@app.get("/health")
async def health():
    """Health check endpoint."""
    return {"status": "healthy"}


# Add external routers
from routes.chat_conversation import chat_conversation_route
from routes.file_indexing import file_indexing_route

# from routes.image_generation import image_generation_route
from routes.attachment import attachment_routes

app.include_router(chat_conversation_route)

app.include_router(file_indexing_route, prefix="/api/v1", tags=["file-indexing"])

# app.include_router(
#     image_generation_route,
#     prefix="/api/v1",
#     tags=["image-generation"]
# )

app.include_router(
    attachment_routes,
    prefix="/api/v1/attachments",
    tags=["attachments"],
    dependencies=[Depends(verify_credentials)],
)

if __name__ == "__main__":
    import uvicorn

    application_config = get_application_config()
    uvicorn.run(
        app,
        host=get_required_application_config_value(application_config, "server.host"),
        port=get_int_application_config_value(application_config, "server.port"),
    )
