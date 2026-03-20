"""Tools for the LangGraph agent.

This module provides various tools that can be used by the LangGraph agent:

1. get_current_time: Get current date and time
2. SessionsPythonREPLTool: Execute Python code when enabled in config
3. web_search: Perform web search using SearxNG when enabled in config
4. Azure AI Search tools (configured via AGENT_CONFIG_JSON_BASE64):
   - azure_search_documents: Text-based search
   - azure_search_semantic: Semantic search with AI ranking
   - azure_search_filter: Search with OData filters
   - azure_search_vector: Vector similarity search (requires OpenAI-compatible embeddings)

"""

import base64
import os
import uuid
from datetime import datetime
from typing import Any, Literal, Optional, cast

import requests
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.models import VectorizedQuery
from azure.storage.blob import BlobServiceClient, ContentSettings
from dotenv import load_dotenv
from langchain_azure_dynamic_sessions import SessionsPythonREPLTool
from langchain_community.utilities import SearxSearchWrapper
from langchain_core.tools import tool
from openai import OpenAI
from pydantic import BaseModel, Field

from .config import (
    get_agent_config,
    get_bool_config_value,
    get_config_value,
    get_required_config_value,
)

# Load environment variables from .env file if present
load_dotenv()

AGENT_CONFIG = get_agent_config()


def _tool_enabled(path: str) -> bool:
    return get_bool_config_value(AGENT_CONFIG, path, False)


def _tool_value(path: str, default=None):
    return get_config_value(AGENT_CONFIG, path, default)


def _tool_str(path: str) -> str:
    return cast(str, get_required_config_value(AGENT_CONFIG, path))


def _decode_base64_image(data: Any, source: str) -> bytes:
    if not isinstance(data, str) or not data:
        raise ValueError(f"Missing base64 image data from {source}")
    return base64.b64decode(data)


ImageSize = Literal[
    "1024x1024",
    "1536x1024",
    "1024x1536",
    "256x256",
    "512x512",
    "1792x1024",
    "1024x1792",
    "auto",
]

ImageStyle = Literal["vivid", "natural"]


# Pydantic models for tool arguments
class WebSearchInput(BaseModel):
    """Input schema for web_search tool."""

    query: str = Field(..., description="The search query string to look up on the web")


class AzureSearchInput(BaseModel):
    """Input schema for Azure Search tools."""

    query: str = Field(..., description="The search query string")
    top: int = Field(
        5, description="Number of results to return (default: 5, max: 50)", ge=1, le=50
    )


class AzureSearchFilterInput(BaseModel):
    """Input schema for Azure Search filter tool."""

    query: str = Field(..., description="The search query string")
    filter_expression: str = Field(
        ..., description="OData filter expression (e.g., \"userid eq 'mock-user-1'\")"
    )
    top: int = Field(
        5, description="Number of results to return (default: 5, max: 50)", ge=1, le=50
    )


tool_generator = []


# Initialize OpenAI-compatible client for DALL-E
def get_dalle_client():
    base_url = _tool_str("tools.generate_image.dalle.base_url")
    api_key = _tool_str("tools.generate_image.dalle.api_key")
    assert isinstance(base_url, str)
    assert isinstance(api_key, str)
    return OpenAI(base_url=base_url, api_key=api_key)


def get_blob_service_client():
    connection_string = _tool_str("tools.generate_image.storage.connection_string")
    assert isinstance(connection_string, str)
    return BlobServiceClient.from_connection_string(connection_string)


@tool
def get_current_time() -> str:
    """Get the current date and time.

    Returns:
        str: Current date and time in ISO format
    """
    return datetime.now().isoformat()


tool_generator.append(get_current_time)


if _tool_enabled("tools.azure_session_pool.enabled"):
    session_pool_endpoint = _tool_str("tools.azure_session_pool.endpoint")
    assert isinstance(session_pool_endpoint, str)
    code_tool = SessionsPythonREPLTool(
        name="python",
        pool_management_endpoint=session_pool_endpoint,
    )
    tool_generator.append(code_tool)

if _tool_enabled("tools.searxng.enabled"):
    searxng_url = _tool_str("tools.searxng.base_url")
    assert isinstance(searxng_url, str)
    print(f"🌐 Initializing SearxNG with URL: {searxng_url}")

    try:
        search = SearxSearchWrapper(searx_host=searxng_url)

        @tool(args_schema=WebSearchInput)
        def web_search(query: str) -> str:
            """Perform a web search using SearxNG to find information on the internet.

            Use this tool when you need to search for current information, news, articles,
            or any content available on the web that is not in the Azure Search index.

            Args:
                query: The search query string. Be specific and descriptive.

            Returns:
                str: Search results with titles, URLs, and snippets from the web
            """
            try:
                print(f"🔍 Web search: query='{query}', num_results=5")

                results = search.results(
                    query,
                    num_results=5,
                )

                if not results:
                    print(f"  ⚠️ No results returned from SearxNG")
                    return f"No web search results found for query: '{query}'"

                print(f"  ✅ Found {len(results)} results")

                final_results = (
                    f"Found {len(results)} web search results for '{query}':\n\n"
                )
                for i, result in enumerate(results, 1):
                    title = result.get("title", "No title")
                    link = result.get("link", "No link")
                    snippet = result.get("snippet", "No snippet")

                    final_results += f"## Result {i}: {title}\n"
                    final_results += f"**URL**: {link}\n"
                    final_results += f"{snippet}\n\n"
                    final_results += "---\n\n"

                return final_results

            except Exception as e:
                error_msg = f"Error performing web search: {str(e)}"
                print(f"  ❌ {error_msg}")
                import traceback

                print(traceback.format_exc())
                return error_msg

        tool_generator.append(web_search)
        print(f"  ✅ web_search tool loaded successfully")

    except Exception as e:
        print(f"  ❌ Failed to initialize SearxNG: {str(e)}")
        import traceback

        print(traceback.format_exc())
else:
    print("  ⚠️ tools.searxng is disabled, web_search tool will not be available")

# Azure AI Search tools
if _tool_enabled("tools.ai_search.enabled"):
    search_endpoint = _tool_str("tools.ai_search.endpoint")
    search_index_name = _tool_str("tools.ai_search.index_name")
    search_api_key = _tool_str("tools.ai_search.api_key")
    assert isinstance(search_endpoint, str)
    assert isinstance(search_index_name, str)
    assert isinstance(search_api_key, str)
    search_client = SearchClient(
        endpoint=search_endpoint,
        index_name=search_index_name,
        credential=AzureKeyCredential(search_api_key),
    )

    @tool(args_schema=AzureSearchInput)
    def document_search(query: str, top: int = 5) -> str:
        """Search documents in Azure AI Search using semantic search capabilities.

        Args:
            query: Search query string
            top: Number of results to return (default: 5, max: 50)

        Returns:
            str: Formatted semantic search results with relevance scores
        """
        try:
            top = min(max(1, top), 50)  # Ensure top is between 1 and 50

            # Get semantic configuration from config or use default
            semantic_config = _tool_value(
                "tools.ai_search.semantic_config", "main-semantic-config"
            )
            print(
                f"🔍 Semantic search: query='{query}', top={top}, config='{semantic_config}'"
            )

            results = search_client.search(
                search_text=query,
                top=top,
                query_type="semantic",
                semantic_configuration_name=semantic_config,
                query_caption="extractive",
                query_answer="extractive",
                include_total_count=True,
            )

            formatted_results = []
            result_count = 0
            for result in results:
                result_count += 1
                score = getattr(result, "@search.score", "N/A")
                print(f"  📄 Result {result_count}: score={score}")

                # Get semantic captions if available
                captions = getattr(result, "@search.captions", [])
                caption_text = (
                    captions[0].text
                    if captions
                    else result.get("content", "No content")[:300]
                )

                formatted_result = {
                    "score": score,
                    "caption": caption_text,
                    "content": result.get("content", "No content"),
                    "metadata": {
                        k: v
                        for k, v in result.items()
                        if not k.startswith("@") and k not in ["content"]
                    },
                }
                formatted_results.append(formatted_result)

            print(f"  ✅ Total results found: {result_count}")

            if not formatted_results:
                return f"No semantic results found for query: '{query}'\n\nℹ️ Possible reasons:\n- Semantic configuration '{semantic_config}' doesn't exist in index\n- Query doesn't match any documents\n- Try using regular text search instead"

            # Format results as readable text
            output = (
                f"Found {len(formatted_results)} semantic results for '{query}':\n\n"
            )
            for i, result in enumerate(formatted_results, 1):
                filename = result["metadata"].get("filename", "Unknown")
                chunk_index = result["metadata"].get("chunk_index", 0)
                id_ = result["metadata"].get("id", "Unknown")
                content = result["content"]
                score = result["score"]

                output += f"## Result {i} (Score: {score})\n"
                output += f"**File**: {filename} | **Chunk**: {chunk_index} | **ID**: `{id_}`\n\n"
                output += f"{content}\n\n"
                output += "---\n\n"

            return output

        except Exception as e:
            error_msg = f"Error performing semantic search: {str(e)}"
            print(f"  ❌ {error_msg}")
            import traceback

            print(traceback.format_exc())
            return error_msg

    tool_generator.append(document_search)

    @tool(args_schema=AzureSearchFilterInput)
    def azure_search_filter(query: str, filter_expression: str, top: int = 5) -> str:
        """Search documents in Azure AI Search with OData filter expressions.

        Args:
            query: Search query string
            filter_expression: OData filter expression (e.g., "userid eq 'mock-user-1'")
            top: Number of results to return (default: 5, max: 50)

        Returns:
            str: Formatted filtered search results
        """
        try:
            top = min(max(1, top), 50)  # Ensure top is between 1 and 50
            print(
                f"🔍 Filtered search: query='{query}', filter='{filter_expression}', top={top}"
            )

            results = search_client.search(
                search_text=query,
                filter=filter_expression,
                top=top,
                include_total_count=True,
            )

            formatted_results = []
            result_count = 0
            for result in results:
                result_count += 1
                print(
                    f"  📄 Result {result_count}: score={getattr(result, '@search.score', 'N/A')}"
                )

                formatted_result = {
                    "score": getattr(result, "@search.score", "N/A"),
                    "content": result.get("content", "No content"),
                    "metadata": {
                        k: v
                        for k, v in result.items()
                        if not k.startswith("@") and k not in ["content"]
                    },
                }
                formatted_results.append(formatted_result)

            print(f"  ✅ Total results found: {result_count}")

            if not formatted_results:
                return f"No results found for query: '{query}' with filter: '{filter_expression}'"

            # Format results as readable text
            output = f"Found {len(formatted_results)} filtered results for '{query}' (Filter: {filter_expression}):\n\n"
            for i, result in enumerate(formatted_results, 1):
                filename = result["metadata"].get("filename", "Unknown")
                chunk_index = result["metadata"].get("chunk_index", 0)
                id_ = result["metadata"].get("id", "Unknown")
                content = result["content"]
                score = result["score"]

                output += f"## Result {i} (Score: {score:.4f})\n"
                output += f"**File**: {filename} | **Chunk**: {chunk_index} | **ID**: `{id_}`\n\n"
                output += f"{content}\n\n"
                output += "---\n\n"

            return output

        except Exception as e:
            error_msg = f"Error performing filtered search: {str(e)}"
            print(f"  ❌ {error_msg}")
            import traceback

            print(traceback.format_exc())
            return error_msg

    tool_generator.append(azure_search_filter)

    # Vector search tool (requires vector embeddings)
    if _tool_enabled("tools.ai_search.openai_embedding.enabled"):
        try:
            embedding_base_url = _tool_str("tools.ai_search.openai_embedding.base_url")
            embedding_api_key = _tool_str("tools.ai_search.openai_embedding.api_key")
            assert isinstance(embedding_base_url, str)
            assert isinstance(embedding_api_key, str)
            openai_client = OpenAI(
                base_url=embedding_base_url,
                api_key=embedding_api_key,
            )

            @tool(args_schema=AzureSearchInput)
            def azure_search_vector(query: str, top: int = 5) -> str:
                """Search documents in Azure AI Search using vector similarity.

                Args:
                    query: Search query string to convert to vector
                    top: Number of results to return (default: 5, max: 50)

                Returns:
                    str: Formatted vector search results with similarity scores
                """
                try:
                    top = min(max(1, top), 50)  # Ensure top is between 1 and 50

                    # Generate embedding for the query
                    embedding_model = _tool_str(
                        "tools.ai_search.openai_embedding.model_id"
                    )
                    assert isinstance(embedding_model, str)
                    print(
                        f"🔍 Vector search: query='{query}', top={top}, embedding_model='{embedding_model}'"
                    )

                    response = openai_client.embeddings.create(
                        input=query, model=embedding_model
                    )
                    query_vector = response.data[0].embedding
                    print(f"  ✅ Generated embedding vector (dim={len(query_vector)})")

                    # Perform vector search
                    vector_field = cast(
                        str,
                        _tool_value("tools.ai_search.vector_field", "content_vector"),
                    )
                    print(f"  🔍 Searching vector field: '{vector_field}'")

                    vector_query = VectorizedQuery(
                        vector=query_vector,
                        k_nearest_neighbors=top,
                        fields=vector_field,
                    )

                    results = search_client.search(
                        search_text=None, vector_queries=[vector_query], top=top
                    )

                    formatted_results = []
                    result_count = 0
                    for result in results:
                        result_count += 1
                        print(f"  📄 Result {result_count}: {list(result.keys())}")

                        formatted_result = {
                            "title": result.get("title", "No title"),
                            "content": result.get("content", "No content"),
                            "metadata": {
                                k: v
                                for k, v in result.items()
                                if not k.startswith("@")
                                and k not in ["title", "content", vector_field]
                            },
                        }
                        formatted_results.append(formatted_result)

                    print(f"  ✅ Total results found: {result_count}")

                    if not formatted_results:
                        return f"No vector results found for query: '{query}'\n\nℹ️ Possible reasons:\n- Index is empty\n- Vector field '{vector_field}' doesn't exist\n- No documents have embeddings\n- Embedding dimension mismatch"

                    # Format results as readable text
                    output = f"Found {len(formatted_results)} vector similarity results for '{query}':\n\n"
                    for result in formatted_results:
                        filename = result["metadata"].get("filename", "Unknown")
                        chunk_index = result["metadata"].get("chunk_index", 0)
                        id_ = result["metadata"].get("id", "Unknown")
                        content = result["content"]
                        output += f"# File: {filename} Chunk [{chunk_index}]\n"
                        output += f"**chunk_id/id**: {id_}\n"
                        output += "Content:\n```\n"
                        output += f"{content}\n"
                        output += "```\n\n"

                    return output

                except Exception as e:
                    error_msg = f"Error performing vector search: {str(e)}"
                    print(f"  ❌ {error_msg}")
                    import traceback

                    print(traceback.format_exc())
                    return error_msg

            tool_generator.append(azure_search_vector)

        except ImportError:
            pass  # OpenAI client not available


def _generate_image_flux(prompt: str, size: str) -> bytes:
    """Generate an image using FLUX model via Azure AI Foundry.

    Args:
        prompt: Prompt for image generation
        size: Size of the generated image

    Returns:
        bytes: Generated image bytes
    """
    flux_endpoint = _tool_str("tools.generate_image.flux.endpoint")
    api_key = _tool_str("tools.generate_image.flux.api_key")
    model_id = _tool_str("tools.generate_image.flux.model_id")
    api_version = cast(
        str, _tool_value("tools.generate_image.flux.api_version", "preview")
    )
    assert isinstance(flux_endpoint, str)
    assert isinstance(api_key, str)
    assert isinstance(model_id, str)
    assert isinstance(api_version, str)

    url = f"{flux_endpoint.rstrip('/')}/{model_id}?api-version={api_version}"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "prompt": prompt,
        "size": size,
        "n": 1,
        "model": model_id,
    }

    print(f"  🌐 Calling FLUX API: {url}")
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()

    result = response.json()
    data = result.get("data")
    if not isinstance(data, list) or not data:
        raise ValueError("FLUX response did not include image data")
    first_item = data[0]
    if not isinstance(first_item, dict):
        raise ValueError("FLUX response contained invalid image payload")
    return _decode_base64_image(first_item.get("b64_json"), "FLUX response")


def _generate_image_dalle(prompt: str, size: str, style: str) -> bytes:
    """Generate an image using DALL-E model.

    Args:
        prompt: Prompt for image generation
        size: Size of the generated image
        style: Style of the generated image

    Returns:
        bytes: Generated image bytes
    """
    client = get_dalle_client()
    model_id = _tool_str("tools.generate_image.dalle.model_id")
    assert isinstance(model_id, str)

    result = client.images.generate(
        model=model_id,
        prompt=prompt,
        size=cast(Any, size),
        quality="standard",
        style=cast(Any, style),
        n=1,
        response_format="b64_json",
    )

    if not result.data:
        raise ValueError("DALL-E response did not include image data")
    first_item = cast(Any, result.data[0])
    b64_data = first_item.b64_json
    return _decode_base64_image(b64_data, "DALL-E response")


def _generate_image_gpt_image(prompt: str, size: str) -> bytes:
    """Generate an image using GPT-Image model via Azure AI Foundry.

    Args:
        prompt: Prompt for image generation
        size: Size of the generated image

    Returns:
        bytes: Generated image bytes
    """
    gpt_image_endpoint = _tool_str("tools.generate_image.gpt_image.endpoint")
    api_key = _tool_str("tools.generate_image.gpt_image.api_key")
    api_version = cast(
        str, _tool_value("tools.generate_image.gpt_image.api_version", "2024-02-01")
    )
    model_id = _tool_str("tools.generate_image.gpt_image.model_id")
    assert isinstance(gpt_image_endpoint, str)
    assert isinstance(api_key, str)
    assert isinstance(api_version, str)
    assert isinstance(model_id, str)

    url = f"{gpt_image_endpoint.rstrip('/')}?api-version={api_version}"

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
    }

    payload = {
        "prompt": prompt,
        "size": size,
        "quality": "medium",
        "output_compression": 100,
        "output_format": "png",
        "model": model_id,
        "n": 1,
    }

    print(f"  🌐 Calling GPT-Image API: {url}")
    response = requests.post(url, headers=headers, json=payload, timeout=120)
    response.raise_for_status()

    result = response.json()
    data = result.get("data")
    if not isinstance(data, list) or not data:
        raise ValueError("GPT-Image response did not include image data")
    first_item = data[0]
    if not isinstance(first_item, dict):
        raise ValueError("GPT-Image response contained invalid image payload")
    return _decode_base64_image(first_item.get("b64_json"), "GPT-Image response")


@tool
def generate_image(
    prompt: str,
    size: ImageSize = "1024x1024",
    style: ImageStyle = "vivid",
) -> str:
    """Generate an image using DALL-E, FLUX, or GPT-Image model.

    The model is automatically selected based on tools.generate_image.provider.

    Args:
        prompt: Prompt for image generation
        size: Size of the generated image. Pick one: ['1024x1024', '1792x1024', '1024x1792']
        style: Style of the generated image. Pick one: ['vivid', 'natural'] (only used for DALL-E)

    Returns:
        str: Generated image URL
    """
    try:
        storage_connection_string = _tool_str(
            "tools.generate_image.storage.connection_string"
        )
        container_name = _tool_str("tools.generate_image.storage.container_name")
        provider = _tool_str("tools.generate_image.provider").lower()
        assert isinstance(storage_connection_string, str)
        assert isinstance(container_name, str)
        assert isinstance(provider, str)

        if provider not in {"dalle", "flux", "gpt_image"}:
            raise EnvironmentError("Invalid tools.generate_image.provider value")

        model_name = (
            "GPT-Image"
            if provider == "gpt_image"
            else ("FLUX" if provider == "flux" else "DALL-E")
        )
        print(f"🔍 Image generation: prompt='{prompt}', model='{model_name}'")

        # Generate image based on model type
        image_size = cast(str, size)
        image_style = cast(str, style)

        if provider == "gpt_image":
            image_bytes = _generate_image_gpt_image(prompt, image_size)
        elif provider == "flux":
            image_bytes = _generate_image_flux(prompt, image_size)
        else:
            image_bytes = _generate_image_dalle(prompt, image_size, image_style)

        print(f"  ✅ Image generated (size: {len(image_bytes)} bytes)")

        # Upload to Blob Storage
        blob_service = get_blob_service_client()
        blob_name = f"images/{uuid.uuid4()}.png"

        # Get blob client and upload with public content type
        blob_client = blob_service.get_blob_client(
            container=container_name, blob=blob_name
        )
        blob_client.upload_blob(
            image_bytes,
            overwrite=True,
            content_settings=ContentSettings(content_type="image/png"),
        )
        print(f"  ✅ Image uploaded to blob: {blob_name}")

        # Return the public URL
        image_url = blob_client.url
        print(f"  ✅ Image URL: {image_url}")
        return image_url

    except EnvironmentError as e:
        error_msg = f"Environment error: {str(e)}"
        print(f"  ❌ {error_msg}")
        import traceback

        print(traceback.format_exc())
        return error_msg
    except Exception as e:
        error_msg = f"Error generating image: {str(e)}"
        print(f"  ❌ {error_msg}")
        import traceback

        print(traceback.format_exc())
        return error_msg


if _tool_enabled("tools.generate_image.enabled"):
    tool_generator.append(generate_image)

print(f"✓ Tools loaded. Tools available: {[tool.name for tool in tool_generator]}")
# List of available tools
AVAILABLE_TOOLS = tool_generator
