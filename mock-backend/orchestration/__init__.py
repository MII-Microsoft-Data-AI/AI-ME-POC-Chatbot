# Run orchestrator

from py_orchestrate.decorators import workflow
from lib.application_config import (
    get_application_config,
    get_required_application_config_value,
)
from .file_indexing import (
    index_file_v1,
    embed_chunks_v1,
    chunk_file_v1,
    ensure_search_index_v1,
    ocr_file_v1,
    store_embeddings_v1,
    update_indexing_status_v1,
)

from py_orchestrate import Orchestrator, CosmosDatabaseManager

_application_config = get_application_config()
_cosmos_envs = {
    "endpoint": get_required_application_config_value(
        _application_config, "cosmos.endpoint"
    ),
    "key": get_required_application_config_value(_application_config, "cosmos.key"),
    "database": get_required_application_config_value(
        _application_config, "cosmos.database_name"
    ),
    "workflow_container_id": "py_orchestrate_workflow_container",
    "activity_container_id": "py_orchestrate_activity_container_id",
}

not_present_envs = []
for x in _cosmos_envs:
    if _cosmos_envs[x] is None:
        not_present_envs.append(x)

if len(not_present_envs) > 0:
    raise ValueError(f"{','.join(not_present_envs)} config value is not present")

global orchestrator
orchestrator = None


def get_orchestrator():
    global orchestrator
    if orchestrator is None:
        db_manager = CosmosDatabaseManager(
            endpoint=_cosmos_envs["endpoint"],
            credential=_cosmos_envs["key"],
            database_id=_cosmos_envs["database"],
            workflow_container_id=_cosmos_envs["workflow_container_id"],
            activity_container_id=_cosmos_envs["activity_container_id"],
        )
        orchestrator = Orchestrator(db_manager=db_manager)

        # Register workflows
        orchestrator.registry.register_workflow("index_file_v1", index_file_v1)
        orchestrator.registry.register_activity("chunk_file_v1", chunk_file_v1)
        orchestrator.registry.register_activity("embed_chunks_v1", embed_chunks_v1)
        orchestrator.registry.register_activity(
            "ensure_search_index_v1", ensure_search_index_v1
        )
        orchestrator.registry.register_activity("ocr_file_v1", ocr_file_v1)
        orchestrator.registry.register_activity(
            "store_embeddings_v1", store_embeddings_v1
        )
        orchestrator.registry.register_activity(
            "update_indexing_status_v1", update_indexing_status_v1
        )

    return orchestrator
