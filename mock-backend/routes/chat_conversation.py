import json
import os

from utils.uuid import generate_uuid
from langchain_core.load import dumps
from langchain_core.messages.human import HumanMessage
from lib.auth import get_authenticated_user
from utils.stream_protocol import generate_stream
from utils.message_conversion import from_assistant_ui_contents_to_langgraph_contents

from typing import Annotated
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from fastapi import APIRouter, Depends, Header, HTTPException
from openai import AzureOpenAI

from agent.graph import get_graph
from lib.database import db_manager

class ChatRequest(BaseModel):
    messages: list
    mode: str = "chat"  # "chat" or "image"

chat_conversation_route = APIRouter()

# Initialize Azure OpenAI client for DALL-E
def get_dalle_client():
    return AzureOpenAI(
        api_version=os.getenv("AZURE_OPENAI_API_VERSION", "2025-01-01-preview"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    )

async def generate_image_stream(prompt: str, conversation_id: str):
    """Generate image using DALL-E and return as stream format compatible with assistant-ui"""
    import uuid
    from langchain_core.messages import HumanMessage, AIMessage
    
    message_id = str(uuid.uuid4())
    
    try:
        # Send start message with conversation ID
        yield f"f:{json.dumps({'messageId': message_id, 'conversationId': conversation_id})}\n"
        
        client = get_dalle_client()
        deployment_name = os.getenv("AZURE_OPENAI_DALLE_DEPLOYMENT_NAME", "dall-e-3")
        
        # Generate image
        result = client.images.generate(
            model=deployment_name,
            prompt=prompt,
            size="1024x1024",
            quality="standard",
            style="vivid",
            n=1,
        )
        
        image_url = result.data[0].url
        revised_prompt = result.data[0].revised_prompt or prompt
        
        # Format response as markdown
        response_text = f"![Generated Image]({image_url})\n\n*Revised prompt: {revised_prompt}*"
        
        # Save to LangGraph state FIRST before streaming
        try:
            graph = await get_graph()
            await graph.aupdate_state(
                config={"configurable": {"thread_id": conversation_id}},
                values={
                    "messages": [
                        HumanMessage(content=prompt),
                        AIMessage(content=response_text)
                    ]
                }
            )
            print(f"✅ Saved image generation to LangGraph state: {conversation_id}")
        except Exception as e:
            print(f"❌ Failed to save to LangGraph state: {str(e)}")
        
        # Send text delta (0:) - content must be JSON string
        yield f"0:{json.dumps(response_text)}\n"
        
        # Send finish message (d:)
        yield f"d:{json.dumps({'finishReason': 'stop', 'usage': {'promptTokens': 0, 'completionTokens': 0}})}\n"
        
    except Exception as e:
        error_message = f"Failed to generate image: {str(e)}"
        yield f"3:{json.dumps(error_message)}\n"

@chat_conversation_route.post("/create-conversation")
def create_new_conversation(_: Annotated[str, Depends(get_authenticated_user)], userid: Annotated[str | None, Header()] = None):
    """Create a new conversation and return its ID."""
    
    if not userid:
        return {"error": "Missing userid header"}
    
    conversation_id = generate_uuid()
    db_manager.create_conversation(conversation_id, userid)
    
    return {
        "conversationId": conversation_id,
        "userId": userid
    }

@chat_conversation_route.post("/chat")
async def chat_completions(request: ChatRequest, _: Annotated[str, Depends(get_authenticated_user)], userid:  Annotated[str | None, Header()] = None):
    """Chat completions endpoint."""

    if not userid:
        return {"error": "Missing userid header"}

    conversation_id = generate_uuid()

    # Convert the input message 
    if type(request.messages) is not list or len(request.messages) == 0:
        return {"error": "Invalid messages format"}
    
    last_message = request.messages[-1] if request.messages else ""
    
    # Add user and the conversation id to the database
    db_manager.create_conversation(conversation_id, userid)
    
    # Route based on mode
    if request.mode == "image":
        # Extract text from message content
        message_content = last_message.get('content', '')
        if isinstance(message_content, list):
            # Extract text from content array
            prompt = ""
            for item in message_content:
                if isinstance(item, dict) and item.get('type') == 'text':
                    prompt = item.get('text', '')
                    break
        else:
            prompt = str(message_content)
        
        if not prompt:
            return {"error": "No prompt provided for image generation"}
        
        # Generate image using DALL-E
        return StreamingResponse(
            generate_image_stream(prompt, conversation_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Content-Type": "text/plain; charset=utf-8",
                "Connection": "keep-alive",
                "x-vercel-ai-data-stream": "v1",
                "x-vercel-ai-ui-message-stream": "v1"
            }
        )
    else:
        # Normal chat mode - use LangGraph
        last_message_langgraph_content = from_assistant_ui_contents_to_langgraph_contents(last_message['content'])
        input_message = [{
            "role": "user",
            "content": last_message_langgraph_content
        }]

        graph = await get_graph()

        return StreamingResponse(
            generate_stream(graph, input_message, conversation_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Content-Type": "text/plain; charset=utf-8",
                "Connection": "keep-alive",
                "x-vercel-ai-data-stream": "v1",
                "x-vercel-ai-ui-message-stream": "v1"
            }
        )


@chat_conversation_route.get("/last-conversation-id")
def get_last_conversation_id(_: Annotated[str, Depends(get_authenticated_user)], userid:  Annotated[str | None, Header()] = None):
    """Get last conversation ID endpoint."""
    if not userid:
        return {"error": "Missing userid header"}
    
    # Fetch the last conversation ID for the user from the database
    last_conversation_id = db_manager.get_last_conversation_id(userid)

    return {
        "userId": userid,
        "lastConversationId": last_conversation_id
    }

@chat_conversation_route.get("/conversations")
async def get_conversations(_: Annotated[str, Depends(get_authenticated_user)], userid:  Annotated[str | None, Header()] = None):
    """Get conversations endpoint."""
    if not userid:
        return {"error": "Missing userid header"}

    # Fetch list of conversations for the user from the database
    conversations = db_manager.get_user_conversations(userid)

    graph = await get_graph()
    
    # Convert to the expected API response format
    response = []
    for conv in conversations:
        # Get the first message from the conversation to use as title
        # For now, we'll use a default title since we don't store message content in metadata
        # In a real implementation, you might want to fetch the first message from LangGraph state
        conv_graph_val = (await graph.aget_state(config={"configurable": {"thread_id": conv.id}})).values
        conv_graph_messages = conv_graph_val.get("messages", []) if conv_graph_val else []
        title = f"Conversations {conv.id[:8]}..."

        if conv_graph_messages:
            first_message = conv_graph_messages[0]
            content = first_message.content

            if isinstance(content, list) and len(content) > 0 and content[0]['type'] == 'text':
                title = content[0]['text']
            elif type(content) is str:
                title = content

        response.append({
            "id": conv.id,
            "title": title,
            "created_at": conv.created_at,
            "is_pinned": conv.is_pinned
        })
    
    return response

@chat_conversation_route.get("/conversations/{conversation_id}")
async def get_chat_history(_: Annotated[str, Depends(get_authenticated_user)], userid:  Annotated[str | None, Header()] = None, conversation_id: str = ""):
    """Get chat history for a conversation."""
    if not userid:
        return {"error": "Missing userid header"}
    
    # Check if the conversation exists and belongs to the user
    if not db_manager.conversation_exists(conversation_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Fetch chat history for the conversation from LangGraph state
    try:
        graph = await get_graph()
        # Get the conversation state from the checkpointer
        states_generator = graph.aget_state_history(config={"configurable": {"thread_id": conversation_id}})
        states = [x async for x in states_generator]

        json_dumps = dumps(states)
        
        return json.loads(json_dumps)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch chat history: {str(e)}")

@chat_conversation_route.post("/conversations/{conversation_id}/chat")
async def chat_conversation(_: Annotated[str, Depends(get_authenticated_user)], userid: Annotated[str | None, Header()] = None, conversation_id: str = "", request: ChatRequest = None):
    """Chat in a specific conversation."""

    if not userid:
        return {"error": "Missing userid header"}
    
    if not request:
        return {"error": "Missing request body"}


    # Check if the conversation exists and belongs to the user
    if not db_manager.conversation_exists(conversation_id, userid):
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    # Convert the input message 
    if type(request.messages) is not list or len(request.messages) == 0:
        return {"error": "Invalid messages format"}
    
    last_message = request.messages[-1] if request.messages else ""
    
    # Route based on mode (same as /chat endpoint)
    if request.mode == "image":
        # Extract text from message content
        message_content = last_message.get('content', '')
        if isinstance(message_content, list):
            prompt = ""
            for item in message_content:
                if isinstance(item, dict) and item.get('type') == 'text':
                    prompt = item.get('text', '')
                    break
        else:
            prompt = str(message_content)
        
        if not prompt:
            return {"error": "No prompt provided for image generation"}
        
        # Generate image using DALL-E
        return StreamingResponse(
            generate_image_stream(prompt, conversation_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Content-Type": "text/plain; charset=utf-8",
                "Connection": "keep-alive",
                "x-vercel-ai-data-stream": "v1",
                "x-vercel-ai-ui-message-stream": "v1"
            }
        )
    else:
        # Normal chat mode - use LangGraph
        last_message_langgraph_content = from_assistant_ui_contents_to_langgraph_contents(last_message['content'])
        input_message = [{
            "role": "user",
            "content": last_message_langgraph_content
        }]

        graph = await get_graph()

        return StreamingResponse(
            generate_stream(graph, input_message, conversation_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Content-Type": "text/plain; charset=utf-8",
                "Connection": "keep-alive",
                "x-vercel-ai-data-stream": "v1",
                "x-vercel-ai-ui-message-stream": "v1"
            }
        )
@chat_conversation_route.delete("/conversations/{conversation_id}")
def delete_conversation(_: Annotated[str, Depends(get_authenticated_user)], userid: Annotated[str | None, Header()] = None, conversation_id: str = ""):
    """Delete a conversation."""

    if not userid:
        return {"error": "Missing userid header"}

    # Delete the conversation from the database
    deleted = db_manager.delete_conversation(conversation_id, userid)
    
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": "Conversation deleted successfully"}

@chat_conversation_route.post("/conversations/{conversation_id}/pin")
def pin_conversation(_: Annotated[str, Depends(get_authenticated_user)], userid: Annotated[str | None, Header()] = None, conversation_id: str = ""):
    """Pin or unpin a conversation."""

    if not userid:
        return {"error": "Missing userid header"}
    
    existing_data = db_manager.get_conversation(conversation_id, userid)
    if not existing_data:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Pin or unpin the conversation in the database
    updated = db_manager.pin_conversation(conversation_id, userid, not existing_data.is_pinned)
    
    if not updated:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    action = "pinned" if updated else "unpinned"
    return {"message": f"Conversation {action} successfully"}
