"""
A workflow to index and chunk a file using Azure services.
"""

import os
import logging
from typing import List, Dict, Any, Optional
from py_orchestrate import activity, workflow
from azure.storage.blob import BlobServiceClient
from azure.ai.documentintelligence import DocumentIntelligenceClient
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.search.documents.models import VectorizedQuery
from azure.search.documents.indexes.models import (
    SearchIndex,
    SearchField,
    SearchFieldDataType,
    VectorSearch,
    HnswAlgorithmConfiguration,
    VectorSearchProfile,
    SemanticConfiguration,
    SemanticSearch,
    SemanticPrioritizedFields,
    SemanticField,
    SearchableField,
    SimpleField,
    AzureOpenAIVectorizer,
    AzureOpenAIVectorizerParameters,
)
from azure.ai.documentintelligence.models import AnalyzeDocumentRequest, AnalyzeResult
from openai import AzureOpenAI
from langchain_text_splitters import RecursiveCharacterTextSplitter
from lib.database import db_manager

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def require_env(name: str) -> str:
    value = os.getenv(name)
    if value is None:
        raise ValueError(f"Missing required environment variable: {name}")
    return value


# Azure clients initialization
def get_azure_clients():
    """Initialize Azure service clients."""
    # Blob Storage
    blob_service = BlobServiceClient.from_connection_string(
        require_env("AZURE_STORAGE_CONNECTION_STRING")
    )

    # Document Intelligence
    doc_intelligence = DocumentIntelligenceClient(
        endpoint=require_env("AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT"),
        credential=AzureKeyCredential(
            require_env("AZURE_DOCUMENT_INTELLIGENCE_API_KEY")
        ),
    )

    # Azure OpenAI
    openai_client = AzureOpenAI(
        azure_endpoint=require_env("AZURE_OPENAI_ENDPOINT"),
        api_key=require_env("AZURE_OPENAI_API_KEY"),
        api_version=require_env("AZURE_OPENAI_API_VERSION"),
    )

    # Azure AI Search
    search_client = SearchClient(
        endpoint=require_env("AZURE_SEARCH_ENDPOINT"),
        index_name=require_env("AZURE_SEARCH_INDEX_NAME"),
        credential=AzureKeyCredential(require_env("AZURE_SEARCH_API_KEY")),
    )

    search_index_client = SearchIndexClient(
        endpoint=require_env("AZURE_SEARCH_ENDPOINT"),
        credential=AzureKeyCredential(require_env("AZURE_SEARCH_API_KEY")),
    )

    return (
        blob_service,
        doc_intelligence,
        openai_client,
        search_client,
        search_index_client,
    )


@activity("ensure_search_index_v1")
def ensure_search_index_v1() -> bool:
    """Ensure the Azure AI Search index exists with proper schema."""
    try:
        _, _, _, _, search_index_client = get_azure_clients()
        index_name = require_env("AZURE_SEARCH_INDEX_NAME")

        # Check if index exists
        try:
            search_index_client.get_index(index_name)
            logger.info(f"Search index '{index_name}' already exists")
            return True
        except Exception:
            logger.info(f"Creating search index '{index_name}'")

        # Define the search index schema
        fields = [
            SimpleField(
                name="id", type=SearchFieldDataType.String, key=True, filterable=True
            ),
            SearchableField(name="content", type=SearchFieldDataType.String),
            SearchableField(
                name="file_id", type=SearchFieldDataType.String, filterable=True
            ),
            SearchableField(
                name="filename", type=SearchFieldDataType.String, filterable=True
            ),
            SimpleField(
                name="userid", type=SearchFieldDataType.String, filterable=True
            ),
            SimpleField(
                name="chunk_index", type=SearchFieldDataType.Int32, filterable=True
            ),
            SearchField(
                name="content_vector",
                type=SearchFieldDataType.Collection(SearchFieldDataType.Single),
                searchable=True,
                vector_search_dimensions=1536,  # Ada-002 embedding dimension
                vector_search_profile_name="main-vector-config",
            ),
        ]

        # Configure vector search
        vector_search = VectorSearch(
            algorithms=[HnswAlgorithmConfiguration(name="main-hnsw")],
            vectorizers=[
                # AzureOpenAIVectorizer(
                #     vectorizer_name="openai-vectorizer",
                #     kind="azureOpenAI",
                #     parameters=AzureOpenAIVectorizerParameters(
                #         resource_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
                #         deployment_name=os.getenv("AZURE_OPENAI_API_KEY"),
                #         model_name="text-embedding-3-small"
                #     ),
                # ),
            ],  #
            profiles=[
                VectorSearchProfile(
                    name="main-vector-config",
                    algorithm_configuration_name="main-hnsw",
                    # vectorizer_name="openai-vectorizer",
                )
            ],
        )

        # Configure semantic search
        semantic_config = SemanticConfiguration(
            name="main-semantic-config",
            prioritized_fields=SemanticPrioritizedFields(
                content_fields=[SemanticField(field_name="content")]
            ),
        )

        semantic_search = SemanticSearch(configurations=[semantic_config])

        # Create the search index
        index = SearchIndex(
            name=index_name,
            fields=fields,
            vector_search=vector_search,
            semantic_search=semantic_search,
        )

        search_index_client.create_index(index)
        logger.info(f"Successfully created search index '{index_name}'")
        return True

    except Exception as e:
        logger.error(f"Failed to ensure search index: {str(e)}")
        return False


def extract_markdown_from_result(result: AnalyzeResult) -> str:
    """Extract markdown from Document Intelligence result using prebuilt-layout."""
    markdown_parts = []
    for page in result.pages or []:
        page_content = []
        # Add paragraphs
        for para in getattr(page, "paragraphs", []) or []:
            page_content.append(para.content)
        # Add tables as markdown
        for table in getattr(page, "tables", []) or []:
            if table.row_count > 0 and table.column_count > 0:
                cells = {
                    (cell.row_index, cell.column_index): cell.content or ""
                    for cell in table.cells
                }
                table_md = []
                for r in range(table.row_count):
                    row = [cells.get((r, c), "") for c in range(table.column_count)]
                    row_md = "| " + " | ".join(row) + " |"
                    table_md.append(row_md)
                    if r == 0:
                        sep = "| " + " | ".join(["---"] * table.column_count) + " |"
                        table_md.insert(1, sep)
                page_content.append("\n".join(table_md))
        if page_content:
            markdown_parts.append("\n\n".join(page_content))
    return "\n\n".join(markdown_parts)


def fail_indexing_workflow(file_id: str, userid: str, message: str) -> None:
    """Persist a failed indexing status and raise an exception."""
    update_indexing_status_v1(file_id, userid, "failed", message)
    raise RuntimeError(message)


@activity("ocr_file_v1")
def ocr_file_v1(file_id: str, userid: str) -> str:
    """Extract content from file using Azure Document Intelligence."""
    try:
        blob_service, doc_intelligence, _, _, _ = get_azure_clients()

        # Get file metadata
        file_metadata = db_manager.get_file(file_id, userid)
        if not file_metadata:
            raise ValueError(f"File {file_id} not found in database")

        # Download file from blob storage
        container_name = require_env("AZURE_STORAGE_CONTAINER_NAME")
        blob_client = blob_service.get_blob_client(
            container=container_name, blob=file_metadata.blob_name
        )

        file_content = blob_client.download_blob().readall()

        logger.info(
            f"Downloaded file {file_id} from blob storage, size: {len(file_content)} bytes"
        )

        # Use Document Intelligence to extract content
        poller = doc_intelligence.begin_analyze_document(
            "prebuilt-layout",  # Use prebuilt layout model for structured extraction
            AnalyzeDocumentRequest(bytes_source=file_content),
            output_content_format="markdown",
        )

        result = poller.result()

        # Extract markdown content
        content = result.content

        logger.info(
            f"Successfully extracted content from file {file_id}, length: {len(content)}"
        )
        return content

    except Exception as e:
        logger.error(f"Failed to extract content from file {file_id}: {str(e)}")
        raise


@activity("chunk_file_v1")
def chunk_file_v1(content: str) -> List[str]:
    """Chunk the file content into smaller pieces for embedding using LangChain RecursiveCharacterTextSplitter."""
    try:
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            separators=["\n\n", "\n", ".", " ", ""],
        )
        chunks = splitter.split_text(content)
        logger.info(f"Successfully chunked content into {len(chunks)} pieces")
        return [chunk.strip() for chunk in chunks if chunk.strip()]
    except Exception as e:
        logger.error(f"Failed to chunk content: {str(e)}")
        raise


@activity("embed_chunks_v1")
def embed_chunks_v1(
    chunks: List[str], file_id: str, userid: str
) -> List[Dict[str, Any]]:
    """Generate embeddings for chunks using Azure OpenAI."""
    try:
        _, _, openai_client, _, _ = get_azure_clients()

        # Get file metadata for additional context
        file_metadata = db_manager.get_file(file_id, userid)
        if not file_metadata:
            raise ValueError(f"File {file_id} not found in database")

        embeddings = []
        deployment_name = require_env("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME")

        for i, chunk in enumerate(chunks):
            # Generate embedding
            response = openai_client.embeddings.create(
                input=chunk, model=deployment_name
            )

            embedding_vector = response.data[0].embedding

            # Create document for search index
            document = {
                "id": f"{file_id}_{i}",
                "content": chunk,
                "file_id": file_id,
                "filename": file_metadata.filename,
                "userid": file_metadata.userid,
                "chunk_index": i,
                "content_vector": embedding_vector,
            }

            embeddings.append(document)

        logger.info(f"Successfully generated embeddings for {len(chunks)} chunks")
        return embeddings

    except Exception as e:
        logger.error(f"Failed to generate embeddings: {str(e)}")
        raise


@activity("store_embeddings_v1")
def store_embeddings_v1(embeddings: List[Dict[str, Any]]) -> bool:
    """Store embeddings in Azure AI Search."""
    try:
        _, _, _, search_client, _ = get_azure_clients()

        # Upload documents to search index
        result = search_client.upload_documents(documents=embeddings)

        # Check if all documents were successfully uploaded
        success_count = sum(1 for r in result if r.succeeded)
        total_count = len(embeddings)

        if success_count == total_count:
            logger.info(
                f"Successfully stored {success_count} embeddings in search index"
            )
            return True
        else:
            logger.error(
                f"Only {success_count}/{total_count} embeddings were stored successfully"
            )
            return False

    except Exception as e:
        logger.error(f"Failed to store embeddings: {str(e)}")
        return False


@activity("update_indexing_status_v1")
def update_indexing_status_v1(
    file_id: str, userid: str, status: str, error_message: Optional[str] = None
) -> bool:
    """Update the indexing status of the file in the database."""
    try:
        success = db_manager.update_file_status(file_id, userid, status, error_message)
        if success:
            logger.info(f"Updated file {file_id} status to {status}")
        else:
            logger.error(f"Failed to update file {file_id} status to {status}")
        return success

    except Exception as e:
        logger.error(f"Failed to update status for file {file_id}: {str(e)}")
        return False


@workflow("index_file_v1")
def index_file_v1(file_id: str, userid: str) -> bool:
    """Complete workflow to index a file."""
    try:
        # Ensure search index exists
        if not ensure_search_index_v1():
            fail_indexing_workflow(file_id, userid, "Failed to create search index")

        # Update status to in_progress
        update_indexing_status_v1(file_id, userid, "in_progress")

        # Extract content from file
        content = ocr_file_v1(file_id, userid)

        # Chunk the content
        chunks = chunk_file_v1(content)

        # Generate embeddings
        embeddings = embed_chunks_v1(chunks, file_id, userid)

        # Store embeddings
        result = store_embeddings_v1(embeddings)

        # Update final status
        if result:
            update_indexing_status_v1(file_id, userid, "completed")
            return True

        fail_indexing_workflow(file_id, userid, "Failed to store embeddings")

    except Exception as e:
        error_message = str(e)
        if not error_message.startswith("Indexing workflow failed:"):
            error_message = f"Indexing workflow failed: {error_message}"
        logger.error(error_message)
        update_indexing_status_v1(file_id, userid, "failed", error_message)
        raise RuntimeError(error_message) from e
