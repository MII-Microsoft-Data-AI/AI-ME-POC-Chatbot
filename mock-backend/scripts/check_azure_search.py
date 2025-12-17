#!/usr/bin/env python3
"""
Diagnostic script to check Azure AI Search configuration and index status.
This helps identify issues with semantic search and vector search setup.
"""
import os
import sys
from dotenv import load_dotenv
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from azure.core.credentials import AzureKeyCredential

# Load environment variables
load_dotenv()

def check_env_vars():
    """Check if all required environment variables are set."""
    print("=" * 80)
    print("🔍 CHECKING ENVIRONMENT VARIABLES")
    print("=" * 80)
    
    required_vars = {
        "AZURE_SEARCH_ENDPOINT": os.getenv("AZURE_SEARCH_ENDPOINT"),
        "AZURE_SEARCH_API_KEY": os.getenv("AZURE_SEARCH_API_KEY"),
        "AZURE_SEARCH_INDEX_NAME": os.getenv("AZURE_SEARCH_INDEX_NAME"),
    }
    
    optional_vars = {
        "AZURE_SEARCH_SEMANTIC_CONFIG": os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG", "my-semantic-config"),
        "AZURE_SEARCH_VECTOR_FIELD": os.getenv("AZURE_SEARCH_VECTOR_FIELD", "content_vector"),
        "AZURE_OPENAI_ENDPOINT": os.getenv("AZURE_OPENAI_ENDPOINT"),
        "AZURE_OPENAI_API_KEY": os.getenv("AZURE_OPENAI_API_KEY"),
        "AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME": os.getenv("AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME", "text-embedding-ada-002"),
    }
    
    all_good = True
    for var, value in required_vars.items():
        if value:
            # Mask sensitive values
            display_value = value[:20] + "..." if len(value) > 20 else value
            if "KEY" in var or "SECRET" in var:
                display_value = "*" * 10
            print(f"✅ {var}: {display_value}")
        else:
            print(f"❌ {var}: NOT SET")
            all_good = False
    
    print("\nOptional variables:")
    for var, value in optional_vars.items():
        display_value = value[:20] + "..." if value and len(value) > 20 else value
        if value and ("KEY" in var or "SECRET" in var):
            display_value = "*" * 10
        status = "✅" if value else "⚠️"
        print(f"{status} {var}: {display_value or 'NOT SET (using default)'}")
    
    return all_good

def check_index_schema():
    """Check the index schema and configuration."""
    print("\n" + "=" * 80)
    print("🔍 CHECKING INDEX SCHEMA")
    print("=" * 80)
    
    try:
        endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
        api_key = os.getenv("AZURE_SEARCH_API_KEY")
        index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")
        
        index_client = SearchIndexClient(
            endpoint=endpoint,
            credential=AzureKeyCredential(api_key)
        )
        
        index = index_client.get_index(index_name)
        
        print(f"✅ Index '{index_name}' exists")
        print(f"\n📋 Fields ({len(index.fields)}):")
        for field in index.fields:
            print(f"  - {field.name} ({field.type})")
            if hasattr(field, 'searchable') and field.searchable:
                print(f"    ✓ Searchable")
            if hasattr(field, 'filterable') and field.filterable:
                print(f"    ✓ Filterable")
            if hasattr(field, 'vector_search_dimensions'):
                print(f"    ✓ Vector field (dimensions: {field.vector_search_dimensions})")
        
        # Check semantic configurations
        if hasattr(index, 'semantic_search') and index.semantic_search:
            print(f"\n🧠 Semantic Search Configurations:")
            if hasattr(index.semantic_search, 'configurations'):
                for config in index.semantic_search.configurations:
                    print(f"  ✅ {config.name}")
                    if hasattr(config, 'prioritized_fields'):
                        pf = config.prioritized_fields
                        if hasattr(pf, 'title_field') and pf.title_field:
                            print(f"    - Title field: {pf.title_field.field_name}")
                        if hasattr(pf, 'content_fields') and pf.content_fields:
                            print(f"    - Content fields: {[f.field_name for f in pf.content_fields]}")
            else:
                print("  ⚠️ No semantic configurations found")
        else:
            print("\n⚠️ Semantic search is not configured for this index")
        
        # Check vector search configuration
        if hasattr(index, 'vector_search') and index.vector_search:
            print(f"\n🔢 Vector Search Configuration:")
            if hasattr(index.vector_search, 'profiles'):
                for profile in index.vector_search.profiles:
                    print(f"  ✅ Profile: {profile.name}")
            if hasattr(index.vector_search, 'algorithms'):
                for algo in index.vector_search.algorithms:
                    print(f"  ✅ Algorithm: {algo.name}")
        else:
            print("\n⚠️ Vector search is not configured for this index")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking index schema: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return False

def check_document_count():
    """Check how many documents are in the index."""
    print("\n" + "=" * 80)
    print("🔍 CHECKING DOCUMENT COUNT")
    print("=" * 80)
    
    try:
        endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
        api_key = os.getenv("AZURE_SEARCH_API_KEY")
        index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")
        
        search_client = SearchClient(
            endpoint=endpoint,
            index_name=index_name,
            credential=AzureKeyCredential(api_key)
        )
        
        # Get total count
        results = search_client.search(
            search_text="*",
            include_total_count=True,
            top=0
        )
        
        total_count = results.get_count()
        print(f"📊 Total documents in index: {total_count}")
        
        if total_count == 0:
            print("⚠️ Index is empty! You need to upload documents first.")
            return False
        
        # Get a sample document
        print("\n📄 Sample document (first result):")
        sample_results = search_client.search(
            search_text="*",
            top=1
        )
        
        for doc in sample_results:
            print(f"\nDocument keys: {list(doc.keys())}")
            for key, value in doc.items():
                if not key.startswith("@"):
                    # Truncate long values
                    str_value = str(value)
                    if len(str_value) > 100:
                        str_value = str_value[:100] + "..."
                    print(f"  - {key}: {str_value}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking document count: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return False

def test_semantic_search():
    """Test a simple semantic search."""
    print("\n" + "=" * 80)
    print("🔍 TESTING SEMANTIC SEARCH")
    print("=" * 80)
    
    try:
        endpoint = os.getenv("AZURE_SEARCH_ENDPOINT")
        api_key = os.getenv("AZURE_SEARCH_API_KEY")
        index_name = os.getenv("AZURE_SEARCH_INDEX_NAME")
        semantic_config = os.getenv("AZURE_SEARCH_SEMANTIC_CONFIG", "my-semantic-config")
        
        search_client = SearchClient(
            endpoint=endpoint,
            index_name=index_name,
            credential=AzureKeyCredential(api_key)
        )
        
        test_query = "test"
        print(f"Query: '{test_query}'")
        print(f"Semantic config: '{semantic_config}'")
        
        results = search_client.search(
            search_text=test_query,
            top=3,
            query_type="semantic",
            semantic_configuration_name=semantic_config,
            include_total_count=True
        )
        
        count = 0
        for result in results:
            count += 1
            print(f"\n  Result {count}:")
            print(f"    Score: {getattr(result, '@search.score', 'N/A')}")
            print(f"    Keys: {list(result.keys())}")
        
        if count == 0:
            print("⚠️ No results found. This could mean:")
            print("  - Index is empty")
            print(f"  - Semantic config '{semantic_config}' doesn't exist")
            print("  - Query doesn't match any documents")
        else:
            print(f"\n✅ Semantic search is working! Found {count} results.")
        
        return count > 0
        
    except Exception as e:
        print(f"❌ Error testing semantic search: {str(e)}")
        import traceback
        print(traceback.format_exc())
        return False

def main():
    """Run all diagnostic checks."""
    print("\n🔧 Azure AI Search Diagnostic Tool")
    print("=" * 80)
    
    # Check environment variables
    if not check_env_vars():
        print("\n❌ Missing required environment variables. Please check your .env file.")
        sys.exit(1)
    
    # Check index schema
    if not check_index_schema():
        print("\n❌ Failed to check index schema.")
        sys.exit(1)
    
    # Check document count
    has_docs = check_document_count()
    
    # Test semantic search
    if has_docs:
        test_semantic_search()
    
    print("\n" + "=" * 80)
    print("✅ Diagnostic check complete!")
    print("=" * 80)

if __name__ == "__main__":
    main()
