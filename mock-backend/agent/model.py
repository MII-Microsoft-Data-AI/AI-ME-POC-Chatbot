"""Model configuration for OpenAI-compatible agent integration."""

import httpx
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import SecretStr
from typing import cast

from .config import get_agent_config, get_bool_config_value, get_required_config_value

# Load environment variables
load_dotenv()


# Create HTTP clients with SSL verification disabled for unverified certificates
def _create_http_client(verify_ssl: bool = True) -> httpx.Client:
    """Create an httpx client with configurable SSL verification.

    Args:
        verify_ssl: Whether to verify SSL certificates. Default True.

    Returns:
        httpx.Client: Configured HTTP client
    """
    return httpx.Client(verify=verify_ssl)


def _create_async_http_client(verify_ssl: bool = True) -> httpx.AsyncClient:
    """Create an async httpx client with configurable SSL verification.

    Args:
        verify_ssl: Whether to verify SSL certificates. Default True.

    Returns:
        httpx.AsyncClient: Configured async HTTP client
    """
    return httpx.AsyncClient(verify=verify_ssl)


def create_openai_model(verify_ssl: bool = True, **kwargs) -> ChatOpenAI:
    """Create an OpenAI model instance with optional SSL verification.

    Args:
        verify_ssl: Whether to verify SSL certificates. Default True.
        **kwargs: Additional parameters for the model

    Returns:
        ChatOpenAI: Configured OpenAI model
    """

    config = get_agent_config()
    base_url: str = cast(str, get_required_config_value(config, "llm.base_url"))
    model_id: str = cast(str, get_required_config_value(config, "llm.model_id"))
    api_key: str = cast(str, get_required_config_value(config, "llm.api_key"))
    verify_ssl = get_bool_config_value(config, "llm.verify_ssl", verify_ssl)

    return ChatOpenAI(
        base_url=base_url,
        model=model_id,
        api_key=SecretStr(api_key),
        # temperature=0.5,
        streaming=True,
        http_client=_create_http_client(verify_ssl=verify_ssl),
        **kwargs,
    )


config = get_agent_config()
verify_ssl = get_bool_config_value(config, "llm.verify_ssl", True)
model = create_openai_model(verify_ssl=verify_ssl)
