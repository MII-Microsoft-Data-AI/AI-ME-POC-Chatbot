# Run orchestrator

import os
from .file_indexing import (
    index_file_v1,
    embed_chunks_v1,
    chunk_file_v1,
    ensure_search_index_v1,
    ocr_file_v1,
    store_embeddings_v1,
    update_indexing_status_v1,
)

from py_orchestrate import Orchestrator

global orchestrator
orchestrator = None
def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        orchestrator = Orchestrator(db_path=os.getenv("DB_PATH_ORCHESTRATOR", "mock.db"))

        # Register workflows
        orchestrator.registry.register_workflow("index_file_v1", index_file_v1)
        orchestrator.registry.register_activity("chunk_file_v1", chunk_file_v1)
        orchestrator.registry.register_activity("embed_chunks_v1", embed_chunks_v1)
        orchestrator.registry.register_activity("ensure_search_index_v1", ensure_search_index_v1)
        orchestrator.registry.register_activity("ocr_file_v1", ocr_file_v1)
        orchestrator.registry.register_activity("store_embeddings_v1", store_embeddings_v1)
        orchestrator.registry.register_activity("update_indexing_status_v1", update_indexing_status_v1)

    return orchestrator
