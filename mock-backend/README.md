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
   # Base64-encoded JSON configs
   APPLICATION_CONFIG_JSON_BASE64=<base64-encoded-application-json>
   AGENT_CONFIG_JSON_BASE64=<base64-encoded-agent-json>
   INDEXING_CONFIG_JSON_BASE64=<base64-encoded-indexing-json>
   ```

5. **Start the server:**

   ```bash
   uv run uvicorn main:app --host 0.0.0.0 --port 8000
   ```

Server will be available at `http://localhost:8000`

## JSON Config Environment Variables

The backend now uses three base64-encoded JSON environment variables for application, agent, and indexing configuration.

### `APPLICATION_CONFIG_JSON_BASE64`

- Used by `mock-backend/main.py`, `mock-backend/lib/auth.py`, `mock-backend/lib/db_connection.py`, `mock-backend/lib/checkpointer.py`, and `mock-backend/orchestration/__init__.py`
- Sample decoded JSON lives in `mock-backend/application.config.sample.json`
- The application config contains server settings, HTTP Basic Auth, and Cosmos DB settings shared by the API, checkpointer, and orchestrator

Expected decoded shape:

```json
{
  "server": {
    "host": "0.0.0.0",
    "port": 8000
  },
  "auth": {
    "username": "apiuser",
    "password": "securepass123"
  },
  "cosmos": {
    "endpoint": "https://your-cosmos-account.documents.azure.com:443/",
    "key": "your-cosmos-key",
    "database_name": "chatbot_db"
  }
}
```

### `AGENT_CONFIG_JSON_BASE64`

- Used by `mock-backend/agent/model.py`, `mock-backend/agent/prompt.py`, and `mock-backend/agent/tools.py`
- Sample decoded JSON lives in `mock-backend/agent.config.sample.json`
- The agent config contains the chat model, optional Prompty settings, and tool configuration such as SearxNG, AI Search, and `tools.generate_image`

Expected decoded shape:

```json
{
  "llm": {
    "base_url": "https://your-provider.example.com/openai/v1",
    "api_key": "your-api-key",
    "model_id": "gpt-4.1-mini",
    "verify_ssl": true
  },
  "prompty": {
    "enabled": true,
    "base_url": "https://your-prompty-service.example.com",
    "project_id": "your-project-id",
    "api_key": "your-prompty-api-key"
  },
  "tools": {
    "searxng": {
      "enabled": true,
      "base_url": "https://your-searxng-instance.example.com"
    },
    "azure_session_pool": {
      "enabled": false,
      "endpoint": ""
    },
    "ai_search": {
      "enabled": true,
      "endpoint": "https://your-search.search.windows.net",
      "api_key": "your-search-api-key",
      "index_name": "your-index-name",
      "semantic_config": "main-semantic-config",
      "vector_field": "content_vector",
      "openai_embedding": {
        "enabled": true,
        "base_url": "https://your-provider.example.com/openai/v1",
        "api_key": "your-api-key",
        "model_id": "text-embedding-3-small"
      }
    },
    "generate_image": {
      "enabled": true,
      "provider": "dalle",
      "storage": {
        "connection_string": "your-storage-connection-string",
        "container_name": "your-container-name"
      },
      "dalle": {
        "base_url": "https://your-provider.example.com/openai/v1",
        "api_key": "your-api-key",
        "model_id": "dall-e-3"
      }
    }
  }
}
```

### `INDEXING_CONFIG_JSON_BASE64`

- Used by `mock-backend/orchestration/file_indexing.py`
- Sample decoded JSON lives in `mock-backend/indexing.config.sample.json`
- The indexing workflow reads storage, document intelligence, search, and OpenAI-compatible embedding settings directly from this JSON

Expected decoded shape:

```json
{
  "storage": {
    "connection_string": "your-storage-connection-string",
    "container_name": "your-container-name"
  },
  "document_intelligence": {
    "endpoint": "https://your-resource.cognitiveservices.azure.com/",
    "api_key": "your-document-intelligence-api-key"
  },
  "llm_openai": {
    "base_url": "https://your-provider.example.com/openai/v1",
    "api_key": "your-api-key",
    "model_id": "gpt-4.1-mini"
  },
  "embedding_openai": {
    "base_url": "https://your-provider.example.com/openai/v1",
    "api_key": "your-api-key",
    "model_id": "text-embedding-3-small"
  },
  "search": {
    "endpoint": "https://your-search.search.windows.net",
    "api_key": "your-search-api-key",
    "index_name": "your-index-name"
  }
}
```

Notes:

- `llm.base_url`, `tools.ai_search.openai_embedding.base_url`, `tools.generate_image.dalle.base_url`, `llm_openai.base_url`, and `embedding_openai.base_url` must already include `/v1`
- The indexing workflow currently assumes an embedding model compatible with the index vector dimension
- Feature blocks under `prompty` and `tools.*` are enabled or disabled with their `enabled` flags

### Encode JSON to Base64

From `mock-backend/`, you can generate the environment variable values with Python:

```bash
python - <<'PY'
import base64
from pathlib import Path

for filename in [
    "application.config.sample.json",
    "agent.config.sample.json",
    "indexing.config.sample.json",
]:
    encoded = base64.b64encode(Path(filename).read_bytes()).decode("utf-8")
    print(f"{filename}:\n{encoded}\n")
PY
```

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
│   ├── config.py                # Agent JSON config loader
│   ├── graph.py                 # LangGraph agent
│   ├── model.py                 # Agent model config
│   ├── prompt.py                # Prompt + Prompty client
│   └── tools.py                 # Agent tools
├── application.config.sample.json # Decoded application config example
├── agent.config.sample.json     # Decoded agent config example
├── indexing.config.sample.json  # Decoded indexing config example
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
APPLICATION_CONFIG_JSON_BASE64=<base64-encoded-application-json>
AGENT_CONFIG_JSON_BASE64=<base64-encoded-agent-json>
INDEXING_CONFIG_JSON_BASE64=<base64-encoded-indexing-json>
```

## 📝 License

MIT License

---

**Built with ❤️ by the MII Data AI Team**
