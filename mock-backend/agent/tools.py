"""Tools for the LangGraph agent.

This module provides various tools that can be used by the LangGraph agent:

1. get_current_time: Get current date and time
2. SessionsPythonREPLTool: Execute Python code (requires AZURE_SESSIONPOOL_ENDPOINT)
3. web_search: Perform web search using SearxNG (requires SEARXNG_URL)
4. Azure AI Search tools (require AZURE_SEARCH_* environment variables):
   - azure_search_documents: Text-based search
   - azure_search_semantic: Semantic search with AI ranking
   - azure_search_filter: Search with OData filters
   - azure_search_vector: Vector similarity search (requires Azure OpenAI)

Environment Variables Required:
- AZURE_SEARCH_ENDPOINT: Your Azure AI Search service endpoint
- AZURE_SEARCH_KEY: Your Azure AI Search admin key
- AZURE_SEARCH_INDEX_NAME: The search index to query
- AZURE_SEARCH_SEMANTIC_CONFIG: Semantic configuration name (optional, defaults to 'default')
- AZURE_SEARCH_VECTOR_FIELD: Vector field name (optional, defaults to 'content_vector')
- AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint (for vector search)
- AZURE_OPENAI_KEY: Azure OpenAI key (for vector search)
- AZURE_OPENAI_EMBEDDING_MODEL: Embedding model name (optional, defaults to 'text-embedding-ada-002')
"""
import os
import base64
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
from langchain_core.tools import tool
from langchain_azure_dynamic_sessions import SessionsPythonREPLTool
from langchain_community.utilities import SearxSearchWrapper
from azure.search.documents import SearchClient
from azure.storage.blob import BlobServiceClient, ContentSettings
from azure.search.documents.models import VectorizedQuery
from azure.core.credentials import AzureKeyCredential
from openai import AzureOpenAI
import requests
from dotenv import load_dotenv
# Load environment variables from .env file if present
load_dotenv()

# Pydantic models for tool arguments
class WebSearchInput(BaseModel):
    """Input schema for web_search tool."""
    query: str = Field(..., description="The search query string to look up on the web")

class AzureSearchInput(BaseModel):
    """Input schema for Azure Search tools."""
    query: str = Field(..., description="The search query string")
    top: int = Field(5, description="Number of results to return (default: 5, max: 50)", ge=1, le=50)

class AzureSearchFilterInput(BaseModel):
    """Input schema for Azure Search filter tool."""
    query: str = Field(..., description="The search query string")
    filter_expression: str = Field(..., description="OData filter expression (e.g., \"userid eq 'mock-user-1'\")")
    top: int = Field(5, description="Number of results to return (default: 5, max: 50)", ge=1, le=50)



tool_generator = []

# Initialize Azure OpenAI client for DALL-E
def get_dalle_client():
    return AzureOpenAI(
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    )
def get_blob_service_client():
    return BlobServiceClient.from_connection_string(
        os.getenv("AZURE_STORAGE_CONNECTION_STRING")
    )

@tool
def get_current_time() -> str:
    """Get the current date and time.
    
    Returns:
        str: Current date and time in ISO format
    """
    return datetime.now().isoformat()
tool_generator.append(get_current_time)


if os.getenv("AZURE_SESSIONPOOL_ENDPOINT"):
    code_tool = SessionsPythonREPLTool(
        name="python",
        pool_management_endpoint=os.getenv("AZURE_SESSIONPOOL_ENDPOINT")
    )
    tool_generator.append(code_tool)

if os.getenv("SEARXNG_URL"):
    searxng_url = os.getenv("SEARXNG_URL")
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
                
                final_results = f"Found {len(results)} web search results for '{query}':\n\n"
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
    print("  ⚠️ SEARXNG_URL not set, web_search tool will not be available")

# Azure AI Search tools
if (os.getenv("AZURE_SEARCH_ENDPOINT") and 
    os.getenv("AZURE_SEARCH_API_KEY") and 
    os.getenv("AZURE_SEARCH_INDEX_NAME")):
    
    search_client = SearchClient(
        endpoint=os.getenv("AZURE_SEARCH_ENDPOINT"),
        index_name=os.getenv("AZURE_SEARCH_INDEX_NAME"),
        credential=AzureKeyCredential(os.getenv("AZURE_SEARCH_API_KEY"))
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
            
            # Get semantic configuration from env or use default
            semantic_config = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG", "my-semantic-config")
            print(f"🔍 Semantic search: query='{query}', top={top}, config='{semantic_config}'")
            
            results = search_client.search(
                search_text=query,
                top=top,
                query_type="semantic",
                semantic_configuration_name=semantic_config,
                query_caption="extractive",
                query_answer="extractive",
                include_total_count=True
            )
            
            formatted_results = []
            result_count = 0
            for result in results:
                result_count += 1
                score = getattr(result, "@search.score", "N/A")
                print(f"  📄 Result {result_count}: score={score}")
                
                # Get semantic captions if available
                captions = getattr(result, "@search.captions", [])
                caption_text = captions[0].text if captions else result.get("content", "No content")[:300]
                
                formatted_result = {
                    "score": score,
                    "caption": caption_text,
                    "content": result.get("content", "No content"),
                    "metadata": {k: v for k, v in result.items() if not k.startswith("@") and k not in ["content"]}
                }
                formatted_results.append(formatted_result)
            
            print(f"  ✅ Total results found: {result_count}")
            
            if not formatted_results:
                return f"No semantic results found for query: '{query}'\n\nℹ️ Possible reasons:\n- Semantic configuration '{semantic_config}' doesn't exist in index\n- Query doesn't match any documents\n- Try using regular text search instead"
            
            # Format results as readable text
            output = f"Found {len(formatted_results)} semantic results for '{query}':\n\n"
            for i, result in enumerate(formatted_results, 1):
                filename = result['metadata'].get('filename', 'Unknown')
                chunk_index = result['metadata'].get('chunk_index', 0)
                id_ = result['metadata'].get('id', 'Unknown')
                content = result['content']
                score = result['score']
                
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

    def _generate_image_flux(prompt: str, size: str) -> bytes:
        """Generate an image using FLUX model via Azure AI Foundry.
        
        Args:
            prompt: Prompt for image generation
            size: Size of the generated image
            
        Returns:
            bytes: Generated image bytes
        """
        # Get base endpoint and derive FLUX endpoint
        openai_endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        deployment_name = os.getenv("AZURE_OPENAI_DALLE_DEPLOYMENT_NAME", "flux.2-pro")
        
        if not openai_endpoint:
            raise EnvironmentError("AZURE_OPENAI_ENDPOINT environment variable is not set")
        if not api_key:
            raise EnvironmentError("AZURE_OPENAI_API_KEY environment variable is not set for FLUX model")
        
        # Transform endpoint from openai.azure.com to services.ai.azure.com
        # e.g., https://foundry-poc-chatbot.openai.azure.com -> https://foundry-poc-chatbot.services.ai.azure.com
        flux_endpoint = openai_endpoint.replace(".openai.azure.com", ".services.ai.azure.com")
        
        # Transform flux endpoint model name to match FLUX naming convention
        # e.g. "FLUX.2-PRO" -> "flux-2-pro"
        endpoint_model_name = deployment_name.replace(".", "-").lower()

        # Build the full URL with the model path
        url = f"{flux_endpoint.rstrip('/')}/providers/blackforestlabs/v1/{endpoint_model_name}?api-version=preview"
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}"
        }
        
        payload = {
            "prompt": prompt,
            "size": size,
            "n": 1,
            "model": deployment_name.lower()
        }
        
        print(f"  🌐 Calling FLUX API: {url}")
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
        
        result = response.json()
        b64_data = result["data"][0]["b64_json"]
        return base64.b64decode(b64_data)

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
        deployment_name = os.getenv("AZURE_OPENAI_DALLE_DEPLOYMENT_NAME", "dall-e-3")
        
        result = client.images.generate(
            model=deployment_name,
            prompt=prompt,
            size=size,
            quality="standard",
            style=style,
            n=1,
            response_format="b64_json"
        )
        
        b64_data = result.data[0].b64_json
        return base64.b64decode(b64_data)

    @tool
    def generate_image(prompt: str, size: str, style: str) -> str:
        """Generate an image using DALL-E or FLUX model.
        
        The model is automatically selected based on the AZURE_OPENAI_DALLE_DEPLOYMENT_NAME 
        environment variable. If it contains 'flux', the FLUX model is used; otherwise DALL-E.
        
        Args:
            prompt: Prompt for image generation
            size: Size of the generated image. Pick one: ['1024x1024', '1792x1024', '1024x1792']
            style: Style of the generated image. Pick one: ['vivid', 'natural'] (only used for DALL-E)
            
        Returns:
            str: Generated image URL
        """
        try:
            # Validate environment variables
            storage_connection_string = os.getenv("AZURE_STORAGE_CONNECTION_STRING")
            container_name = os.getenv("AZURE_STORAGE_CONTAINER_NAME")
            
            if not storage_connection_string:
                raise EnvironmentError("AZURE_STORAGE_CONNECTION_STRING environment variable is not set")
            if not container_name:
                raise EnvironmentError("AZURE_STORAGE_CONTAINER_NAME environment variable is not set")
            
            deployment_name = os.getenv("AZURE_OPENAI_DALLE_DEPLOYMENT_NAME", "dall-e-3")
            is_flux = "flux" in deployment_name.lower()
            
            print(f"🔍 Image generation: prompt='{prompt}', model={'FLUX' if is_flux else 'DALL-E'}")
            
            # Generate image based on model type
            if is_flux:
                image_bytes = _generate_image_flux(prompt, size)
            else:
                image_bytes = _generate_image_dalle(prompt, size, style)
            
            print(f"  ✅ Image generated (size: {len(image_bytes)} bytes)")
            
            # Upload to Blob Storage
            blob_service = get_blob_service_client()
            blob_name = f"images/{uuid.uuid4()}.png"
            
            # Get blob client and upload with public content type
            blob_client = blob_service.get_blob_client(
                container=container_name,
                blob=blob_name
            )
            blob_client.upload_blob(image_bytes, overwrite=True, content_settings=ContentSettings(content_type="image/png"))
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

    tool_generator.append(generate_image)

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
            print(f"🔍 Filtered search: query='{query}', filter='{filter_expression}', top={top}")
            
            results = search_client.search(
                search_text=query,
                filter=filter_expression,
                top=top,
                include_total_count=True
            )
            
            formatted_results = []
            result_count = 0
            for result in results:
                result_count += 1
                print(f"  📄 Result {result_count}: score={getattr(result, '@search.score', 'N/A')}")
                
                formatted_result = {
                    "score": getattr(result, "@search.score", "N/A"),
                    "content": result.get("content", "No content"),
                    "metadata": {k: v for k, v in result.items() if not k.startswith("@") and k not in ["content"]}
                }
                formatted_results.append(formatted_result)
            
            print(f"  ✅ Total results found: {result_count}")
            
            if not formatted_results:
                return f"No results found for query: '{query}' with filter: '{filter_expression}'"
            
            # Format results as readable text
            output = f"Found {len(formatted_results)} filtered results for '{query}' (Filter: {filter_expression}):\n\n"
            for i, result in enumerate(formatted_results, 1):
                filename = result['metadata'].get('filename', 'Unknown')
                chunk_index = result['metadata'].get('chunk_index', 0)
                id_ = result['metadata'].get('id', 'Unknown')
                content = result['content']
                score = result['score']
                
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
    if os.getenv("AZURE_OPENAI_ENDPOINT") and os.getenv("AZURE_OPENAI_API_KEY"):
        try:
            from openai import AzureOpenAI
            
            openai_client = AzureOpenAI(
                api_key=os.getenv("AZURE_OPENAI_API_KEY"),
                api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2024-02-01"),
                azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
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
                    embedding_model = os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME", "text-embedding-ada-002")
                    print(f"🔍 Vector search: query='{query}', top={top}, embedding_model='{embedding_model}'")
                    
                    response = openai_client.embeddings.create(
                        input=query,
                        model=embedding_model
                    )
                    query_vector = response.data[0].embedding
                    print(f"  ✅ Generated embedding vector (dim={len(query_vector)})")
                    
                    # Perform vector search
                    vector_field = os.getenv("AZURE_SEARCH_VECTOR_FIELD", "content_vector")
                    print(f"  🔍 Searching vector field: '{vector_field}'")
                    
                    vector_query = VectorizedQuery(
                        vector=query_vector,
                        k_nearest_neighbors=top,
                        fields=vector_field
                    )
                    
                    results = search_client.search(
                        search_text=None,
                        vector_queries=[vector_query],
                        top=top
                    )
                    
                    formatted_results = []
                    result_count = 0
                    for result in results:
                        result_count += 1
                        print(f"  📄 Result {result_count}: {list(result.keys())}")
                        
                        formatted_result = {
                            "title": result.get("title", "No title"),
                            "content": result.get("content", "No content"),
                            "metadata": {k: v for k, v in result.items() if not k.startswith("@") and k not in ["title", "content", vector_field]}
                        }
                        formatted_results.append(formatted_result)
                    
                    print(f"  ✅ Total results found: {result_count}")
                    
                    if not formatted_results:
                        return f"No vector results found for query: '{query}'\n\nℹ️ Possible reasons:\n- Index is empty\n- Vector field '{vector_field}' doesn't exist\n- No documents have embeddings\n- Embedding dimension mismatch"
                    
                    # Format results as readable text
                    output = f"Found {len(formatted_results)} vector similarity results for '{query}':\n\n"
                    for result in formatted_results:
                        filename = result['metadata'].get('filename', 'Unknown')
                        chunk_index = result['metadata'].get('chunk_index', 0)
                        id_ = result['metadata'].get('id', 'Unknown')
                        content = result['content']
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


print(f"✓ Tools loaded. Tools available: {[tool.name for tool in tool_generator]}")
# List of available tools
AVAILABLE_TOOLS = tool_generator