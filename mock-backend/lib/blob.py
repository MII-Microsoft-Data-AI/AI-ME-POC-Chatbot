"""Azure Blob Storage operations."""

import base64
import mimetypes
import os
from datetime import datetime, timedelta
from typing import BinaryIO, Union

import filetype
from azure.storage.blob import BlobSasPermissions, BlobServiceClient, generate_blob_sas
from azure.storage.blob.aio import BlobServiceClient as AsyncBlobServiceClient


def _get_required_env(var_name: str) -> str:
    value = os.getenv(var_name)
    if not value:
        raise EnvironmentError(f"Missing required environment variable: {var_name}")
    return value


def get_blob_service_client() -> BlobServiceClient:
    """Get Azure Blob Service client."""
    return BlobServiceClient.from_connection_string(
        _get_required_env("AZURE_STORAGE_CONNECTION_STRING")
    )


def get_async_blob_service_client() -> AsyncBlobServiceClient:
    """Get async Azure Blob Service client."""
    return AsyncBlobServiceClient.from_connection_string(
        _get_required_env("AZURE_STORAGE_CONNECTION_STRING")
    )


async def upload_file_to_blob_async(
    file: Union[BinaryIO, bytes], blob_name: str
) -> str:
    blob_service_client = get_async_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")
    async with blob_service_client:
        try:
            await blob_service_client.create_container(container_name)
        except Exception:
            pass
        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_name
        )
        await blob_client.upload_blob(file, overwrite=True)
    return blob_name


def upload_file_to_blob(file: Union[BinaryIO, bytes], blob_name: str) -> str:
    blob_service_client = get_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")

    try:
        blob_service_client.create_container(container_name)
    except Exception:
        pass

    blob_client = blob_service_client.get_blob_client(
        container=container_name, blob=blob_name
    )
    blob_client.upload_blob(file, overwrite=True)

    return blob_name


async def get_file_link_async(blob_name: str) -> str:
    blob_service_client = get_async_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")
    async with blob_service_client:
        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_name
        )
        return blob_client.url


def get_file_link(blob_name: str) -> str:
    blob_service_client = get_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")

    blob_client = blob_service_client.get_blob_client(
        container=container_name, blob=blob_name
    )

    return blob_client.url


async def get_file_temporary_link_async(blob_name: str, expiry: int = 3600) -> str:
    blob_service_client = get_async_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")
    async with blob_service_client:
        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_name
        )
        account_name = blob_service_client.account_name
        account_key = getattr(blob_service_client.credential, "account_key", None)
        if not account_name or not account_key:
            raise EnvironmentError(
                "Azure Blob Storage account name or key is unavailable for SAS generation"
            )

        sas_token = generate_blob_sas(
            account_name=account_name,
            container_name=container_name,
            blob_name=blob_name,
            account_key=account_key,
            permission=BlobSasPermissions(read=True),
            expiry=datetime.utcnow() + timedelta(seconds=expiry),
        )

        return f"{blob_client.url}?{sas_token}"


def get_file_temporary_link(blob_name: str, expiry: int = 3600) -> str:
    blob_service_client = get_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")

    blob_client = blob_service_client.get_blob_client(
        container=container_name, blob=blob_name
    )

    account_name = blob_service_client.account_name
    account_key = getattr(blob_service_client.credential, "account_key", None)
    if not account_name or not account_key:
        raise EnvironmentError(
            "Azure Blob Storage account name or key is unavailable for SAS generation"
        )

    sas_token = generate_blob_sas(
        account_name=account_name,
        container_name=container_name,
        blob_name=blob_name,
        account_key=account_key,
        permission=BlobSasPermissions(read=True),
        expiry=datetime.utcnow() + timedelta(seconds=expiry),
    )

    return f"{blob_client.url}?{sas_token}"


async def get_file_base64_async(blob_name: str) -> tuple[str, str]:
    blob_service_client = get_async_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")
    async with blob_service_client:
        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_name
        )
        downloader = await blob_client.download_blob()
        blob_bytes = await downloader.readall()
        kind = filetype.guess(blob_bytes)
        mime_type = kind.mime if kind else ""
        if not mime_type:
            properties = await blob_client.get_blob_properties()
            mime_type = properties.content_settings.content_type or ""
        if not mime_type or mime_type == "application/octet-stream":
            guessed_type, _ = mimetypes.guess_type(blob_name)
            mime_type = guessed_type or "application/octet-stream"

        return mime_type, base64.b64encode(blob_bytes).decode("ascii")


def get_file_base64(blob_name: str) -> tuple[str, str]:
    blob_service_client = get_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")

    blob_client = blob_service_client.get_blob_client(
        container=container_name, blob=blob_name
    )

    blob_bytes = blob_client.download_blob().readall()
    kind = filetype.guess(blob_bytes)
    mime_type = kind.mime if kind else ""
    if not mime_type:
        properties = blob_client.get_blob_properties()
        mime_type = properties.content_settings.content_type or ""
    if not mime_type or mime_type == "application/octet-stream":
        guessed_type, _ = mimetypes.guess_type(blob_name)
        mime_type = guessed_type or "application/octet-stream"

    return mime_type, base64.b64encode(blob_bytes).decode("ascii")


async def delete_file_async(blob_name: str) -> bool:
    blob_service_client = get_async_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")
    async with blob_service_client:
        blob_client = blob_service_client.get_blob_client(
            container=container_name, blob=blob_name
        )
        await blob_client.delete_blob()
    return True


def delete_file(blob_name: str) -> bool:
    blob_service_client = get_blob_service_client()
    container_name = _get_required_env("AZURE_STORAGE_CONTAINER_NAME")

    blob_client = blob_service_client.get_blob_client(
        container=container_name, blob=blob_name
    )
    blob_client.delete_blob()

    return True
