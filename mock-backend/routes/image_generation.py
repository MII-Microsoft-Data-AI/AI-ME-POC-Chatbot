import os
from typing import Annotated
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Header, HTTPException
from openai import AzureOpenAI
from lib.auth import get_authenticated_user

class ImageGenerationRequest(BaseModel):
    prompt: str
    size: str = "1024x1024"  # Options: 1024x1024, 1024x1792, 1792x1024
    quality: str = "standard"  # Options: standard, hd
    style: str = "vivid"  # Options: vivid, natural

class ImageGenerationResponse(BaseModel):
    url: str
    revised_prompt: str

image_generation_route = APIRouter()

# Initialize Azure OpenAI client for DALL-E
def get_dalle_client():
    return AzureOpenAI(
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    )

@image_generation_route.post("/generate-image", response_model=ImageGenerationResponse)
async def generate_image(
    request: ImageGenerationRequest,
    _: Annotated[str, Depends(get_authenticated_user)],
    userid: Annotated[str | None, Header()] = None
):
    """Generate an image using DALL-E 3."""
    
    if not userid:
        raise HTTPException(status_code=400, detail="Missing userid header")
    
    try:
        client = get_dalle_client()
        deployment_name = os.getenv("AZURE_OPENAI_DALLE_DEPLOYMENT_NAME", "dall-e-3")
        
        # Generate image using DALL-E 3
        result = client.images.generate(
            model=deployment_name,
            prompt=request.prompt,
            size=request.size,
            quality=request.quality,
            style=request.style,
            n=1,
        )
        
        # Extract the image URL and revised prompt
        image_url = result.data[0].url
        revised_prompt = result.data[0].revised_prompt or request.prompt
        
        return ImageGenerationResponse(
            url=image_url,
            revised_prompt=revised_prompt
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate image: {str(e)}"
        )
