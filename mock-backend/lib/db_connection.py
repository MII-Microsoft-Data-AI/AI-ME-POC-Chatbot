"""Database connection factory - Azure Cosmos DB."""

import asyncio
import threading
from typing import Any, Optional

from azure.cosmos import CosmosClient, PartitionKey

from lib.application_config import (
    get_application_config,
    get_required_application_config_value,
)


class CosmosDBConnection:
    """Cosmos DB connection manager."""

    def __init__(self):
        application_config = get_application_config()

        self.endpoint = get_required_application_config_value(
            application_config, "cosmos.endpoint"
        )
        self.key = get_required_application_config_value(
            application_config, "cosmos.key"
        )
        self.database_name = get_required_application_config_value(
            application_config, "cosmos.database_name"
        )

        self.conversations_container = "conversations"
        self.files_container = "files"
        self.attachments_container = "attachments"

        self._client: Optional[Any] = None
        self._database: Optional[Any] = None
        self._conversations_container: Optional[Any] = None
        self._files_container: Optional[Any] = None
        self._attachments_container: Optional[Any] = None
        self._lock = threading.Lock()

    async def init_cosmos_client(self):
        await asyncio.to_thread(self._init_cosmos_client_sync)

    def _init_cosmos_client_sync(self):
        with self._lock:
            if self._client:
                return

            if not self.endpoint or not self.key:
                raise ValueError("cosmos.endpoint and cosmos.key must be configured")

            self._client = CosmosClient(self.endpoint, credential=self.key)
            self._database = self._client.create_database_if_not_exists(
                id=self.database_name
            )
            database = self._database
            if database is None:
                raise RuntimeError("Failed to initialize Cosmos DB database client")

            self._conversations_container = database.create_container_if_not_exists(
                id=self.conversations_container,
                partition_key=PartitionKey(path="/userid"),
            )
            self._files_container = database.create_container_if_not_exists(
                id=self.files_container,
                partition_key=PartitionKey(path="/userid"),
            )
            self._attachments_container = database.create_container_if_not_exists(
                id=self.attachments_container,
                partition_key=PartitionKey(path="/userid"),
            )

            print("✅ Cosmos DB client initialized")
            print(f"   Database: {self.database_name}")
            print(
                f"   Containers: {self.conversations_container}, {self.files_container}, {self.attachments_container}"
            )

    async def close_cosmos_client(self):
        await asyncio.to_thread(self._close_cosmos_client_sync)

    def _close_cosmos_client_sync(self):
        with self._lock:
            if self._client:
                exit_method = getattr(self._client, "__exit__", None)
                if callable(exit_method):
                    exit_method(None, None, None)
                self._client = None
                self._database = None
                self._conversations_container = None
                self._files_container = None
                self._attachments_container = None
                print("🔌 Cosmos DB client closed")

    def get_conversations_container(self):
        if not self._conversations_container:
            raise RuntimeError(
                "Cosmos DB client not initialized. Call init_cosmos_client() first."
            )
        return self._conversations_container

    def get_files_container(self):
        if not self._files_container:
            raise RuntimeError(
                "Cosmos DB client not initialized. Call init_cosmos_client() first."
            )
        return self._files_container

    def get_attachments_container(self):
        if not self._attachments_container:
            raise RuntimeError(
                "Cosmos DB client not initialized. Call init_cosmos_client() first."
            )
        return self._attachments_container


db_connection = CosmosDBConnection()
