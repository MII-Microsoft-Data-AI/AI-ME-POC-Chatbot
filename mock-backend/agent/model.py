"""Model configuration for Azure OpenAI integration."""

import os

import httpx
from dotenv import load_dotenv
from langchain_openai import ChatOpenAI
from pydantic import SecretStr

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

    base_url = f"{os.getenv('AZURE_OPENAI_ENDPOINT')}/openai/v1"
    # Add /openai/v1 for Azure Deployment
    if os.getenv("USE_OPENAI_CLIENT", "false") == "true":
        base_url = os.getenv("AZURE_OPENAI_ENDPOINT")

    return ChatOpenAI(
        base_url=base_url,
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", ""),
        api_key=SecretStr(os.getenv("AZURE_OPENAI_API_KEY", "")),
        # temperature=0.5,
        streaming=True,
        http_client=_create_http_client(verify_ssl=verify_ssl),
        **kwargs,
    )


# Default model instance
# To connect to unverified SSL certificates, set VERIFY_SSL=false in environment
verify_ssl = os.getenv("VERIFY_SSL", "true").lower() == "true"
model = create_openai_model(verify_ssl=verify_ssl)
