"""Model configuration for Azure OpenAI integration."""
import os
from typing import Any, Dict
from langchain_openai import AzureChatOpenAI, ChatOpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


def create_azure_model(**kwargs) -> AzureChatOpenAI:
    """Create an Azure OpenAI model instance.
    
    Args:
        **kwargs: Additional parameters for the model
        
    Returns:
        AzureChatOpenAI: Configured Azure OpenAI model
    """
    return AzureChatOpenAI(
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        azure_deployment=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        # temperature=0.5,
        streaming=True,
        **kwargs
    )

def create_openai_model(**kwargs) -> AzureChatOpenAI:
    """Create an Azure OpenAI model instance.
    
    Args:
        **kwargs: Additional parameters for the model
        
    Returns:
        AzureChatOpenAI: Configured Azure OpenAI model
    """
    return ChatOpenAI(
        base_url=os.getenv("AZURE_OPENAI_ENDPOINT"),
        model=os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
        # temperature=0.5,
        streaming=True,
        **kwargs
    )


# Default model instance
model = create_azure_model()
if os.getenv("USE_OPENAI_CLIENT", "true").lower() == "true":
    model = create_openai_model()