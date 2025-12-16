# Mock Backend - AI Chat & Image Generation API

A real-time AI inference API built with FastAPI, LangGraph, and Azure OpenAI, supporting both GPT-4 chat and DALL-E 3 image generation through a unified interface.

## 🌟 Features

### Core Features

- **Unified Chat Endpoint** - Single endpoint for both chat and image generation
- **Mode-Based Routing** - Automatic routing to GPT-4 or DALL-E based on mode
- **LangGraph Integration** - Conversation state management
- **Azure OpenAI** - GPT-4 and DALL-E 3 integration
- **Real-time Streaming** - Live response updates
- **Persistent Storage** - SQLite for conversation history
- **Tool Support** - Extensible tool system

### Advanced Features

- **Conversation History** - Full chat and image generation history
- **Vector Search** - Azure AI Search integration
- **File Indexing** - Document processing and embedding
- **Authentication** - HTTP Basic Auth
- **CORS Support** - Frontend integration ready

## 🚀 Quick Start

### Prerequisites

- Python 3.12+
- UV package manager
- Azure OpenAI API access (GPT-4 and DALL-E 3)

### Installation

1. **Navigate to backend directory:**

   ```bash
   cd mock-backend
   ```

2. **Install dependencies:**

   ```bash
   uv sync
   ```

3. **Configure environment:**

   ```bash
   cp env.sample .env
   ```

4. **Edit `.env` with your credentials:**

   ```env
   # Azure OpenAI - Chat
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_API_VERSION=2025-01-01-preview
   AZURE_OPENAI_GPT_DEPLOYMENT_NAME=gpt-4
   
   # Azure OpenAI - Image Generation
   AZURE_OPENAI_DALLE_DEPLOYMENT_NAME=dall-e-3
   
   # Authentication
   BACKEND_AUTH_USERNAME=apiuser
   BACKEND_AUTH_PASSWORD=securepass123
   ```

5. **Start the server:**

   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port 8000
   ```

Server will be available at `http://localhost:8000`

## 📖 Unified Chat & Image Generation

### Overview

The backend provides a **single `/chat` endpoint** that intelligently routes requests to either GPT-4 (chat) or DALL-E 3 (image generation) based on the `mode` parameter.

### Request Format

```json
{
  "messages": [
    {
      "role": "user",
      "content": "Your prompt here"
    }
  ],
  "mode": "chat" | "image"
}
```

### Routing Logic

```python
@chat_conversation_route.post("/chat")
async def chat_completions(request: ChatRequest):
    if request.mode == "image":
        # Extract prompt from message
        prompt = extract_text_from_message(last_message)
        
        # Generate image using DALL-E
        return StreamingResponse(
            generate_image_stream(prompt, conversation_id),
            media_type="text/event-stream"
        )
    else:
        # Normal chat mode - use LangGraph + GPT-4
        graph = await get_graph()
        return StreamingResponse(
            generate_stream(graph, input_message, conversation_id),
            media_type="text/event-stream"
        )
```

### Response Stream Protocol

Both modes use the same streaming protocol:

```
f:{"messageId":"uuid"}           # Start message
0:"content"                      # Text delta
d:{"finishReason":"stop"}        # Finish message
3:"error message"                # Error (if any)
```

#### Chat Mode Stream Example

```
f:{"messageId":"123e4567-e89b-12d3-a456-426614174000"}
0:"Hello! "
0:"How can "
0:"I help "
0:"you today?"
d:{"finishReason":"stop","usage":{"promptTokens":10,"completionTokens":15}}
```

#### Image Mode Stream Example

```
f:{"messageId":"123e4567-e89b-12d3-a456-426614174000"}
0:"![Generated Image](https://dalle-url.com/image.png)\n\n*Revised prompt: A beautiful sunset...*"
d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}
```

## 🎨 DALL-E Integration

### Image Generation Flow

1. **Receive Request** with `mode: "image"`
2. **Extract Prompt** from message content
3. **Call DALL-E API** with prompt
4. **Format Response** as markdown
5. **Save to LangGraph** for history
6. **Stream to Client**

### Implementation

```python
async def generate_image_stream(prompt: str, conversation_id: str):
    """Generate image using DALL-E and return as stream"""
    from langchain_core.messages import HumanMessage, AIMessage
    
    # Send start message
    yield f"f:{json.dumps({'messageId': message_id})}\n"
    
    # Generate image
    client = get_dalle_client()
    result = client.images.generate(
        model="dall-e-3",
        prompt=prompt,
        size="1024x1024",
        quality="standard",
        style="vivid",
        n=1,
    )
    
    image_url = result.data[0].url
    revised_prompt = result.data[0].revised_prompt
    
    # Format as markdown
    response_text = f"![Generated Image]({image_url})\n\n*Revised prompt: {revised_prompt}*"
    
    # Send text delta
    yield f"0:{json.dumps(response_text)}\n"
    
    # Save to LangGraph for history
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
    
    # Send finish message
    yield f"d:{json.dumps({'finishReason': 'stop'})}\n"
```

### DALL-E Configuration

```python
def get_dalle_client():
    """Get Azure OpenAI client for DALL-E"""
    return AzureOpenAI(
        api_version=os.getenv("AZURE_OPENAI_API_VERSION"),
        azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT"),
        api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    )
```

## 💾 Conversation History

### LangGraph State Management

Both chat and image conversations are saved to LangGraph state:

```python
# Chat mode - automatic via LangGraph
async for msg in graph.astream(input_message, config):
    # Messages automatically saved to checkpointer
    pass

# Image mode - manual save
await graph.aupdate_state(
    config={"configurable": {"thread_id": conversation_id}},
    values={"messages": [user_message, ai_message]}
)
```

### Database Schema

**Conversation Metadata (`conversation_metadata.db`):**

```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    userid TEXT NOT NULL,
    is_pinned BOOLEAN DEFAULT FALSE,
    created_at INTEGER NOT NULL
);
```

**LangGraph State (`mock-langgraph-db.db`):**

- Managed by LangGraph SQLite checkpointer
- Stores full message history
- Supports conversation continuation

## 🔧 API Endpoints

### Chat & Image Generation

**POST `/chat`**

- Unified endpoint for chat and image generation
- Requires: `userid` header, Basic Auth
- Body: `{ messages, mode }`
- Returns: Streaming response

### Conversation Management

**GET `/conversations`**

- List all user conversations
- Returns: Array of conversation metadata

**GET `/conversations/{id}`**

- Get conversation history
- Returns: Full message history from LangGraph

**POST `/conversations/{id}/pin`**

- Pin/unpin conversation
- Body: `{ is_pinned: boolean }`

**DELETE `/conversations/{id}`**

- Delete conversation and history

### Health & Status

**GET `/health`**

- Server health check
- Returns: `{ status: "healthy" }`

## 🏗️ Project Structure

```
mock-backend/
├── main.py                      # FastAPI app
├── routes/
│   ├── chat_conversation.py     # Chat & image endpoints
│   └── file_indexing.py         # File processing
├── agent/
│   ├── graph.py                 # LangGraph agent
│   ├── model.py                 # Azure OpenAI config
│   └── tools.py                 # Agent tools
├── utils/
│   ├── stream_protocol.py       # Streaming utilities
│   └── uuid.py                  # UUID generation
├── lib/
│   └── database.py              # Database operations
└── .env                         # Configuration
```

## 🔐 Authentication

All endpoints require:

1. **HTTP Basic Auth**

   ```
   Authorization: Basic base64(username:password)
   ```

2. **User ID Header**

   ```
   userid: user@example.com
   ```

Example:

```bash
curl -u apiuser:securepass123 \
  -H "userid: user@example.com" \
  -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Hello"}],
    "mode": "chat"
  }'
```

## 🛠️ Development

### Adding New Tools

1. **Define tool in `agent/tools.py`:**

   ```python
   @tool
   def my_new_tool(param: str) -> str:
       """Tool description"""
       return result
   ```

2. **Add to AVAILABLE_TOOLS:**

   ```python
   AVAILABLE_TOOLS = [
       get_current_time,
       my_new_tool,
   ]
   ```

3. **Graph automatically binds tools**

### Testing

**Test Chat Mode:**

```bash
curl -u apiuser:securepass123 \
  -H "userid: test@example.com" \
  -X POST http://localhost:8000/chat \
  -d '{"messages":[{"role":"user","content":"Hello"}],"mode":"chat"}'
```

**Test Image Mode:**

```bash
curl -u apiuser:securepass123 \
  -H "userid: test@example.com" \
  -X POST http://localhost:8000/chat \
  -d '{"messages":[{"role":"user","content":"A sunset"}],"mode":"image"}'
```

### Database Operations

**Reset database:**

```bash
rm conversation_metadata.db mock-langgraph-db.db
```

**View conversations:**

```bash
sqlite3 conversation_metadata.db "SELECT * FROM conversations;"
```

## 🐛 Troubleshooting

### Common Issues

**1. DALL-E API Errors**

- Check `AZURE_OPENAI_DALLE_DEPLOYMENT_NAME` is correct
- Verify API key has DALL-E access
- Check API version supports DALL-E 3

**2. Stream Format Errors**

- Ensure text delta is JSON string: `0:"text"`
- Not JSON object: `0:{"type":"text"}`
- Check stream protocol implementation

**3. Conversation Not Found**

- Verify messages are saved to LangGraph
- Check `aupdate_state` is called for image mode
- Ensure conversation_id matches

**4. Authentication Failures**

- Check credentials match `.env`
- Verify `userid` header is present
- Test with curl first

## 📊 Monitoring

### Logs

Server logs show:

- Request routing (chat vs image)
- DALL-E API calls
- LangGraph state updates
- Errors and warnings

Example:

```
INFO:httpx:HTTP Request: POST https://...openai.azure.com/.../images/generations "HTTP/1.1 200 OK"
INFO:     ::1:0 - "POST /chat HTTP/1.1" 200 OK
```

### Health Check

```bash
curl -u apiuser:securepass123 http://localhost:8000/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-12-16T10:00:00Z"
}
```

## 🚀 Deployment

### Docker

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY . .

RUN pip install uv
RUN uv sync

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables

Production `.env`:

```env
AZURE_OPENAI_ENDPOINT=https://prod-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=prod-api-key
AZURE_OPENAI_GPT_DEPLOYMENT_NAME=gpt-4
AZURE_OPENAI_DALLE_DEPLOYMENT_NAME=dall-e-3
BACKEND_AUTH_USERNAME=secure-username
BACKEND_AUTH_PASSWORD=secure-password
```

## 📝 License

MIT License

---

**Built with ❤️ by the MII Data AI Team**
