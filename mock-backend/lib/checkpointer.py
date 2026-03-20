import dotenv

dotenv.load_dotenv()

import os
from typing import cast

from langgraph_checkpoint_cosmosdb import CosmosDBSaver

from lib.application_config import (
    get_application_config,
    get_required_application_config_value,
)

application_config = get_application_config()
cosmos_endpoint = get_required_application_config_value(
    application_config, "cosmos.endpoint"
)
cosmos_key = get_required_application_config_value(application_config, "cosmos.key")
cosmos_database_name = get_required_application_config_value(
    application_config, "cosmos.database_name"
)

os.environ["COSMOSDB_ENDPOINT"] = cast(str, cosmos_endpoint)
os.environ["COSMOSDB_KEY"] = cast(str, cosmos_key)

# Global cached checkpointer instance
_checkpointer_instance = None


def checkpointer():
    """Get or create the cached checkpointer instance.

    This avoids creating a new SQLite connection on every request.
    """
    global _checkpointer_instance

    if _checkpointer_instance is not None:
        return _checkpointer_instance

    _checkpointer_instance = CosmosDBSaver(
        database_name=cast(str, cosmos_database_name),
        container_name="langgraph_checkpoints",
    )

    print("✅ Checkpointer initialized and cached")

    return _checkpointer_instance
