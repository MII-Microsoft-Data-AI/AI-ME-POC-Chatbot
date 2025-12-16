# AI Chat Application with DALL-E Integration

A modern ChatGPT-like application built with Next.js, featuring unified chat and image generation capabilities powered by Azure OpenAI (GPT-4 and DALL-E 3).

## 🌟 Features

### Core Features

- 🔐 **Authentication** - NextAuth with Google OAuth
- 💬 **AI Chat** - Powered by Azure OpenAI GPT-4
- 🎨 **Image Generation** - DALL-E 3 integration
- 🔄 **Unified Interface** - Single chat page for both modes
- 📝 **Markdown Support** - Rich text formatting
- 🎭 **Mode Switching** - Seamless toggle between Chat and Image modes
- 📱 **Responsive Design** - Works on all devices
- 🌈 **Personalization** - Customizable themes and colors

### Advanced Features

- ✨ **Smooth Animations** - Fade-in effects for images
- 💾 **Conversation History** - Persistent chat storage
- 🔍 **Search** - Find past conversations
- 📌 **Pin Conversations** - Keep important chats accessible
- 🎯 **Welcome Screen** - Mode selector on first chat
- 🔄 **Real-time Streaming** - Live response updates

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Bun
- Python 3.12+ (for backend)
- Azure OpenAI API access

### Installation

1. **Clone the repository:**

   ```bash
   git clone <repository-url>
   cd AI-ME-POC-Chatbot
   ```

2. **Install dependencies:**

   ```bash
   make setup
   ```

3. **Configure environment variables:**

   **Frontend (.env):**

   ```env
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-secret-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   ```

   **Backend (mock-backend/.env):**

   ```env
   AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
   AZURE_OPENAI_API_KEY=your-api-key
   AZURE_OPENAI_API_VERSION=2025-01-01-preview
   AZURE_OPENAI_DALLE_DEPLOYMENT_NAME=dall-e-3
   AZURE_OPENAI_GPT_DEPLOYMENT_NAME=gpt-4
   ```

4. **Start the application:**

   ```bash
   make dev
   ```

5. **Open in browser:**
   - Frontend: <http://localhost:3000>
   - Backend API: <http://localhost:8000>

## 📖 Unified Chat with Image Generation

### Overview

The application features a **unified chat interface** where users can seamlessly switch between:

- **💬 Chat Mode** - Conversational AI powered by GPT-4
- **✨ Image Generation Mode** - Create images with DALL-E 3

### How It Works

#### 1. **Mode Selection**

Users can choose their mode in two places:

**Welcome Screen (First Chat):**

```
┌─────────────────────────────────────┐
│   Good morning! 👋                  │
│   How can I help you today?         │
│                                     │
│   What would you like to do?        │
│                                     │
│   ┌──────────┐  ┌──────────┐      │
│   │    💬    │  │    ✨    │      │
│   │   Chat   │  │  Image   │      │
│   └──────────┘  └──────────┘      │
└─────────────────────────────────────┘
```

**Composer (Anytime):**

- Dropdown selector in the chat input area
- Switch modes without losing context

#### 2. **Backend Routing**

The backend automatically routes requests based on mode:

```python
@chat_conversation_route.post("/chat")
async def chat_completions(request: ChatRequest):
    if request.mode == "image":
        # Route to DALL-E
        return generate_image_stream(prompt, conversation_id)
    else:
        # Route to GPT-4
        return generate_stream(graph, input_message, conversation_id)
```

#### 3. **Response Handling**

**Chat Mode Response:**

- Streaming text chunks
- Real-time display
- Markdown formatting

**Image Mode Response:**

- DALL-E generates image
- Returns image URL + revised prompt
- Displays as markdown: `![Generated Image](url)`

### Stream Protocol

Both modes use the same streaming protocol:

```
f:{"messageId":"uuid"}           # Start message
0:"text content"                 # Text delta
d:{"finishReason":"stop"}        # Finish message
3:"error message"                # Error (if any)
```

### Image Animation

Generated images appear with smooth animations:

1. **Loading State** - Pulsing skeleton with "Loading image..."
2. **Fade-In** - 500ms smooth opacity transition
3. **Complete** - Fully visible image

```tsx
// Image component with animation
<span className="block relative">
  {!isLoaded && <LoadingSkeleton />}
  <img 
    className={isLoaded ? "opacity-100" : "opacity-0"}
    onLoad={() => setIsLoaded(true)}
  />
</span>
```

### Conversation History

Both chat and image generation conversations are saved to LangGraph state:

```python
# Save to LangGraph for history
await graph.aupdate_state(
    config={"configurable": {"thread_id": conversation_id}},
    values={
        "messages": [
            HumanMessage(content=prompt),
            AIMessage(content=response_text)
        ]
    }
)
```

This ensures:

- ✅ All conversations appear in sidebar
- ✅ History can be loaded and continued
- ✅ No "Conversation not found" errors
- ✅ Unified experience across modes

## 🏗️ Architecture

### Frontend Stack

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **assistant-ui** - Chat UI components
- **Framer Motion** - Animations
- **NextAuth** - Authentication

### Backend Stack

- **FastAPI** - Python web framework
- **LangGraph** - Conversation state management
- **Azure OpenAI** - GPT-4 and DALL-E 3
- **Cosmos DB** - Conversation storage

### Data Flow

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│   Frontend (Next.js)                │
│   - Mode selector                   │
│   - Chat UI                         │
│   - Runtime with mode parameter     │
└──────┬──────────────────────────────┘
       │
       │ POST /api/be/chat
       │ { messages, mode: "chat|image" }
       ▼
┌─────────────────────────────────────┐
│   Backend (FastAPI)                 │
│   - Route based on mode             │
│   - LangGraph state management      │
└──────┬──────────────────────────────┘
       │
       ├─── mode="chat" ──────────────┐
       │                              ▼
       │                    ┌──────────────────┐
       │                    │  GPT-4 (Chat)    │
       │                    └──────────────────┘
       │
       └─── mode="image" ─────────────┐
                                      ▼
                            ┌──────────────────┐
                            │ DALL-E 3 (Image) │
                            └──────────────────┘
```

## 🎨 Personalization

Users can customize:

- **Primary Color** - Accent color throughout the app
- **Welcome Message** - Custom greeting
- **Suggestions** - Recommended prompts
- **Avatar** - Profile picture

Settings are persisted in localStorage and applied globally.

## 📁 Project Structure

```
AI-ME-POC-Chatbot/
├── src/
│   ├── app/
│   │   ├── chat/                    # Chat page
│   │   ├── settings/                # Settings page
│   │   └── api/                     # API routes
│   ├── components/
│   │   ├── assistant-ui/            # Chat UI components
│   │   │   ├── thread.tsx           # Main chat thread
│   │   │   └── markdown-text.tsx    # Markdown renderer
│   │   ├── ModeSelector.tsx         # Mode dropdown
│   │   └── GlobalNavbar.tsx         # Navigation
│   ├── lib/
│   │   └── integration/
│   │       └── client/
│   │           └── chat-conversation.ts  # Runtime config
│   └── contexts/
│       └── PersonalizationContext.tsx    # Theme context
├── mock-backend/
│   ├── routes/
│   │   └── chat_conversation.py     # Chat & image endpoints
│   ├── utils/
│   │   └── stream_protocol.py       # Streaming utilities
│   └── main.py                      # FastAPI app
└── README.md
```

## 🔧 Development

### Available Commands

```bash
# Full development (frontend + backend)
make dev

# Individual services
make dev-frontend    # Next.js on :3000
make dev-backend     # FastAPI on :8000

# Utilities
make setup          # Install all dependencies
make clean          # Clean build artifacts
make status         # Check running services
```

### Adding New Features

1. **Frontend Changes:**
   - Components in `src/components/`
   - Pages in `src/app/`
   - Update types in relevant files

2. **Backend Changes:**
   - Routes in `mock-backend/routes/`
   - Update stream protocol if needed
   - Test with both modes

3. **Testing:**
   - Test chat mode
   - Test image generation mode
   - Test mode switching
   - Test conversation history

## 🐛 Troubleshooting

### Common Issues

**1. Hydration Errors**

- Ensure no `<div>` inside `<p>` tags
- Use `<span className="block">` for block-level inline elements

**2. Image Not Rendering**

- Check stream format: `0:"markdown text"` not `0:{"type":"text"}`
- Verify DALL-E API credentials
- Check browser console for errors

**3. Conversation Not Found**

- Ensure messages are saved to LangGraph state
- Check `aupdate_state` is called after image generation
- Verify conversation_id is correct

**4. Mode Not Persisting**

- Check localStorage is enabled
- Verify `mounted` state before reading localStorage
- Clear browser cache if needed

## 📝 API Reference

### POST /api/be/chat

**Request:**

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

**Response (Streaming):**

```
f:{"messageId":"uuid"}
0:"response text or markdown image"
d:{"finishReason":"stop","usage":{...}}
```

### Image Generation Response Format

```markdown
![Generated Image](https://dalle-image-url.com/image.png)

*Revised prompt: A detailed description of what DALL-E created*
```

## 🚀 Deployment

### Frontend (Vercel)

1. Push to GitHub
2. Import to Vercel
3. Set environment variables
4. Deploy

### Backend (Azure/AWS)

1. Containerize with Docker
2. Deploy to Azure Container Apps or AWS ECS
3. Set environment variables
4. Configure CORS for frontend domain

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Azure OpenAI for GPT-4 and DALL-E 3
- assistant-ui for chat components
- Next.js team for the amazing framework
- FastAPI for the backend framework

---

**Built with ❤️ by the MII Data AI Team**
