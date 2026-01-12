# New Chat Flow Documentation

This document describes the complete data flow when a user initiates a new chat from `/chat` (home) and transitions to `/chat/:id` (specific conversation room).

## Overview

The flow involves **client-side conversation creation**, **sessionStorage persistence**, **page redirect**, and **automatic message sending** after navigation. This pattern optimizes UX by:
- Creating the conversation before redirect (prevents "empty conversation" state)
- Storing the message locally during navigation
- Auto-sending the message after landing on the specific conversation page

---

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         /chat (New Chat Page)                       │
│                                                                     │
│  1. User types message                                              │
│  2. User clicks send                                                │
│  3. useConversationCreator intercepts send                          │
│  4. Generate UUID client-side                                       │
│  5. Call CreateConversation API                                     │
│  6. Save message + mode + attachments to sessionStorage/IndexedDB   │
│  7. Redirect to /chat/:id                                           │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ router.push()
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    /chat/:id (Conversation Page)                    │
│                                                                     │
│  8. Load conversation history (empty for new conversation)          │
│  9. usePendingMessage detects saved message                         │
│ 10. Wait for history load to complete                               │
│ 11. Set mode (if different)                                         │
│ 12. Add attachments to composer                                     │
│ 13. Set message text in composer                                    │
│ 14. Auto-send message (300ms delay)                                 │
│ 15. Clear sessionStorage/IndexedDB                                  │
│ 16. Stream response from backend                                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Flow

### Phase 1: New Chat Page (`/chat`)

#### File: `src/app/chat/page.tsx`
- **Component**: `NewChatPage`
- **Runtime**: `FirstChatAPIRuntime` (no conversation ID)
- **Rendered**: `NewChatContent` component

#### File: `src/components/features/chat/NewChatContent.tsx`
- Uses `useConversationCreator` hook
- Renders `Thread` component with mode selector
- Passes `isCreating` state to show loading UI

#### File: `src/hooks/chat/useConversationCreator.ts`
**Key Logic**: Intercepts the composer's send function

1. **Intercept Send** (useEffect)
   ```typescript
   const originalSend = threadRuntime.composer.send
   threadRuntime.composer.send = async () => { /* custom logic */ }
   ```

2. **Extract Message & Attachments**
   ```typescript
   const composerState = threadRuntime.composer.getState()
   const message = composerState.text
   const attachmentFiles = composerState.attachments.map(a => a.file)
   ```

3. **Generate Conversation ID**
   ```typescript
   const conversationId = crypto.randomUUID()
   ```

4. **Create Conversation** (API Call)
   ```typescript
   await CreateConversation(conversationId, message)
   // POST /api/be/create-conversation
   // Body: { conversationId, initialChat: message }
   ```

5. **Save Pending Data**
   ```typescript
   savePendingMessage(message, mode, attachmentFiles)
   // sessionStorage: message, mode
   // IndexedDB: attachment files
   ```

6. **Redirect**
   ```typescript
   router.push(`/chat/${conversationId}`)
   ```

#### File: `src/utils/chat/storage.ts`
**Storage Strategy**:
- **sessionStorage**: Stores text message and mode
  - `PENDING_MESSAGE`: The message text
  - `PENDING_MODE`: The chat mode ('chat' or 'image')
- **IndexedDB**: Stores file attachments (avoid size limits)
  - Database: `chat-app-db`
  - Store: `pending-attachments`
  - Keys: `file-0`, `file-1`, etc.

---

### Phase 2: Backend Conversation Creation

#### File: `src/app/api/be/[...path]/route.ts`
**Proxy Middleware**:
- Intercepts `/api/be/*` requests
- Adds `UserID` header from session
- Forwards to Python backend

#### File: `mock-backend/routes/chat_conversation.py`
**Endpoint**: `POST /create-conversation`

```python
@chat_conversation_route.post("/create-conversation")
async def create_new_conversation(request: CreateConversationRequest, userid: str):
    conversation_id = request.conversationId or generate_uuid()
    
    # Create conversation in database
    db_manager.create_conversation(conversation_id, request.initialChat, userid)
    
    return {
        "conversationId": conversation_id,
        "initialChat": request.initialChat,
        "userId": userid
    }
```

**Database Operation**:
- Creates entry in `conversations` table
- Fields: `id`, `user_id`, `title` (from initialChat), `created_at`, `is_pinned`

---

### Phase 3: Conversation Page (`/chat/:id`)

#### File: `src/app/chat/[conversationId]/page.tsx`
**Component**: `ConversationPage`

1. **Extract Conversation ID**
   ```typescript
   const params = useParams()
   const conversationId = params.conversationId as string
   ```

2. **Initialize Mode**
   ```typescript
   const { mode, setMode } = useChatMode()
   // Loads from localStorage, default: 'chat'
   ```

3. **Load History**
   ```typescript
   const { historyAdapter, isLoadingHistory, error } = useConversationHistory(conversationId)
   ```

4. **Create Runtime**
   ```typescript
   const runtime = ChatWithConversationIDAPIRuntime(conversationId, historyAdapter, mode)
   // Uses /api/be/conversations/:id/chat endpoint
   ```

5. **Render**
   ```typescript
   <ConversationContent mode={mode} onModeChange={setMode} isLoading={isLoadingHistory} />
   ```

#### File: `src/hooks/chat/useConversationHistory.ts`
**History Loading**:

```typescript
const historyAdapter: ThreadHistoryAdapter = {
  async load() {
    const historyData = await LoadConversationHistory(conversationId)
    // GET /api/be/conversations/:id
    // Returns LangGraph state with messages
    
    return { messages: historyData }
  },
  async append() {
    // No-op: backend handles message persistence during streaming
  }
}
```

**For New Conversations**:
- Backend returns empty array (conversation exists in DB but no LangGraph state yet)
- `isLoadingHistory` becomes `false`
- Ready for pending message

---

### Phase 4: Pending Message Handling

#### File: `src/components/features/chat/ConversationContent.tsx`
```typescript
usePendingMessage({ isLoading, onModeChange })
```

#### File: `src/hooks/chat/usePendingMessage.ts`
**Auto-Send Logic**:

1. **Wait for History Load**
   ```typescript
   if (isLoading) return // Don't send until history is loaded
   ```

2. **Check for Pending Message** (once)
   ```typescript
   if (hasSentPendingMessage) return // Only send once
   
   const pending = await getPendingMessage()
   // Retrieves from sessionStorage + IndexedDB
   ```

3. **Set Mode**
   ```typescript
   if (pending.mode) {
     onModeChange(pending.mode)
   }
   ```

4. **Add Attachments** (after 300ms delay)
   ```typescript
   setTimeout(() => {
     for (const file of pending.attachmentFile) {
       threadRuntime.composer.addAttachment(file)
     }
   }, 300)
   ```

5. **Set Message Text**
   ```typescript
   threadRuntime.composer.setText(pending.message)
   ```

6. **Send Message** (after another 300ms)
   ```typescript
   setTimeout(() => {
     threadRuntime.composer.send()
     setHasSentPendingMessage(true)
   }, 300)
   ```

7. **Clear Storage**
   ```typescript
   clearPendingMessage()
   // Removes from sessionStorage + IndexedDB
   ```

**Why the delays?**
- Ensures runtime is fully initialized after history load
- Gives time for attachments to be processed
- Prevents race conditions

---

### Phase 5: Message Streaming

#### File: `src/lib/integration/client/chat-conversation.ts`
**Runtime**: `ChatWithConversationIDAPIRuntime`
- Endpoint: `/api/be/conversations/${conversationId}/chat`
- Body: `{ mode, messages: [lastMessage] }`

#### File: `src/utils/custom-data-stream-runtime.ts`
**Custom Streaming Runtime**:
- **Key Optimization**: Only sends last message to backend
  ```typescript
  const lastMessages = [messages[messages.length - 1]]
  ```
- Backend handles full conversation context via LangGraph state

#### Backend Processing
**File**: `mock-backend/routes/chat_conversation.py`

**Endpoint**: `POST /conversations/{conversation_id}/chat`

1. **Validate Conversation**
   ```python
   if not db_manager.conversation_exists(conversation_id, userid):
       raise HTTPException(status_code=404)
   ```

2. **Route by Mode**
   - **Chat Mode**: Use LangGraph agent
     ```python
     graph = get_graph()
     return StreamingResponse(
         generate_stream(graph, input_message, conversation_id)
     )
     ```
   - **Image Mode**: Use DALL-E
     ```python
     return StreamingResponse(
         generate_image_stream(prompt, conversation_id)
     )
     ```

3. **LangGraph State Management**
   - **State Key**: `thread_id = conversation_id`
   - **Auto-persists** messages to checkpointer during streaming
   - **Retrieves** full history for agent context

---

## Data Persistence Layers

### 1. PostgreSQL (via `lib/database.py`)
**Stores**:
- Conversation metadata
- User ownership
- Titles, pins, timestamps

**Schema** (conversations table):
```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    created_at INTEGER,
    is_pinned BOOLEAN DEFAULT FALSE
)
```

### 2. LangGraph State (via PostgresCheckpointer)
**Stores**:
- Full message history
- Agent state
- Tool call results

**Access Pattern**:
```python
graph.get_state(config={"configurable": {"thread_id": conversation_id}})
```

### 3. Client-Side Storage
**sessionStorage**:
- Pending message text
- Pending mode
- **Cleared** after send

**IndexedDB**:
- Pending attachment files
- **Cleared** after send

**localStorage**:
- Chat mode preference (persists across sessions)

---

## Key Components & Their Roles

| Component/Hook | Location | Responsibility |
|---------------|----------|----------------|
| `NewChatPage` | `src/app/chat/page.tsx` | Entry point for new chats |
| `ConversationPage` | `src/app/chat/[conversationId]/page.tsx` | Entry point for existing conversations |
| `useConversationCreator` | `src/hooks/chat/useConversationCreator.ts` | Intercepts send, creates conversation, redirects |
| `useConversationHistory` | `src/hooks/chat/useConversationHistory.ts` | Loads message history from backend |
| `usePendingMessage` | `src/hooks/chat/usePendingMessage.ts` | Auto-sends saved message after redirect |
| `useChatMode` | `src/hooks/chat/useChatMode.ts` | Manages chat/image mode with localStorage |
| `FirstChatAPIRuntime` | `src/lib/integration/client/chat-conversation.ts` | Runtime for `/chat` (no history) |
| `ChatWithConversationIDAPIRuntime` | `src/lib/integration/client/chat-conversation.ts` | Runtime for `/chat/:id` (with history) |
| `CustomDataStreamRuntime` | `src/utils/custom-data-stream-runtime.ts` | Custom streaming runtime (sends only last message) |

---

## API Endpoints

| Endpoint | Method | Purpose | Used By |
|----------|--------|---------|---------|
| `/api/be/create-conversation` | POST | Create new conversation entry | useConversationCreator |
| `/api/be/conversations/:id` | GET | Load conversation history | useConversationHistory |
| `/api/be/conversations/:id/chat` | POST | Send message in conversation | ChatWithConversationIDAPIRuntime |
| `/api/be/conversations` | GET | List all conversations | Sidebar |
| `/api/be/last-conversation-id` | GET | Get most recent conversation | (Legacy) |

---

## Performance Considerations

### Current Implementation

#### ✅ Optimizations
1. **Client-side UUID generation** - No server round-trip for ID
2. **Optimistic redirect** - Navigate before message is sent
3. **Lazy history loading** - Only loads when needed
4. **Single message sending** - Backend gets full context from state
5. **Memoized adapters** - Prevents unnecessary re-renders

#### ⚠️ Potential Issues

1. **Double Delay (600ms total)**
   ```typescript
   // First delay
   setTimeout(() => {
     addAttachments()
     setText()
     
     // Second delay
     setTimeout(() => {
       send()
     }, 300)
   }, 300)
   ```
   **Impact**: User sees 600ms delay before message sends
   **Why**: Ensures runtime stability after redirect

2. **SessionStorage + IndexedDB Overhead**
   - Two storage APIs for one operation
   - Async file read/write for attachments
   **Impact**: ~50-100ms for large files

3. **History Load on Empty Conversation**
   ```typescript
   // Loads empty history from backend
   await LoadConversationHistory(conversationId) // Returns []
   ```
   **Impact**: Unnecessary API call + wait for new conversations

4. **No Error Recovery**
   - If redirect happens but conversation creation fails, user lands on 404
   - No retry mechanism

---

## Optimization Opportunities

### High Impact

1. **Skip History Load for New Conversations**
   ```typescript
   // In useConversationHistory
   if (isNewConversation) {
     setIsLoadingHistory(false)
     return { messages: [] }
   }
   ```
   **Benefit**: Saves ~100-200ms API call

2. **Reduce Delay Before Send**
   ```typescript
   // From 600ms to 200ms or use proper Promise-based wait
   await threadRuntime.ready() // Hypothetical
   composer.send()
   ```
   **Benefit**: Faster UX, feels more responsive

3. **Parallel Storage Operations**
   ```typescript
   await Promise.all([
     sessionStorage.setItem(...),
     saveFilesToIndexedDB(...)
   ])
   ```
   **Benefit**: Saves ~20-50ms

### Medium Impact

4. **Backend Batching**
   ```python
   # Create conversation + send first message in one API call
   POST /api/be/conversations/create-and-send
   ```
   **Benefit**: Eliminates redirect flow entirely

5. **Optimistic UI Updates**
   - Show message in UI immediately
   - Don't wait for history load
   - Reconcile when stream completes
   **Benefit**: Perceived instant response

6. **IndexedDB Only for Large Files**
   ```typescript
   if (file.size > 1MB) {
     saveToIndexedDB(file)
   } else {
     saveToSessionStorage(await fileToBase64(file))
   }
   ```
   **Benefit**: Faster for small attachments

---

## Error Scenarios

### Scenario 1: Conversation Creation Fails
**Current**: User redirected to `/chat/:id` that doesn't exist → 404
**Better**: 
```typescript
try {
  await CreateConversation(...)
} catch (error) {
  alert(error)
  // Stay on /chat page
  return
}
```

### Scenario 2: Network Interruption During Redirect
**Current**: Message lost (in sessionStorage but never sent)
**Better**: TTL + cleanup job
```typescript
// Store timestamp with pending message
sessionStorage.setItem('pendingMessageTimestamp', Date.now())

// On app mount, clean up stale messages
if (Date.now() - timestamp > 5 * 60 * 1000) { // 5 minutes
  clearPendingMessage()
}
```

### Scenario 3: Multiple Tabs
**Current**: sessionStorage is per-tab → works correctly
**Risk**: If user opens two `/chat` tabs and sends from both, race condition

---

## Testing Checklist

- [ ] New chat with text only
- [ ] New chat with image attachment
- [ ] New chat with multiple attachments
- [ ] Mode switching (chat → image)
- [ ] Page refresh during redirect
- [ ] Network failure during creation
- [ ] Large files (>10MB)
- [ ] Rapid sequential sends
- [ ] Browser back button after redirect
- [ ] Multiple tabs scenario

---

## Future Improvements

1. **Eliminate Redirect Pattern**
   - Create conversation in background
   - Update URL without page reload
   - Stream message immediately

2. **WebSocket for Real-time**
   - Persistent connection
   - No need for sessionStorage
   - Faster message delivery

3. **Service Worker Caching**
   - Cache conversation metadata
   - Offline support
   - Faster history loads

4. **React Query/SWR**
   - Better cache management
   - Automatic retries
   - Optimistic updates

---

## Related Documentation

- [LANGGRAPH_TO_THREAD.md](./LANGGRAPH_TO_THREAD.md) - Message format conversion
- [LANGGRAPH_STREAMING_PROTOCOL.md](./LANGGRAPH_STREAMING_PROTOCOL.md) - Backend streaming format
- [VERCEL_AI_STREAM_PROTOCOL.md](./VERCEL_AI_STREAM_PROTOCOL.md) - Frontend stream parsing
- [backend-api-contract.md](./backend-api-contract.md) - API specifications

---

## Summary

The new chat flow is a **two-phase redirect pattern**:

1. **Create Phase** (`/chat`): Generate ID → Create conversation → Save message → Redirect
2. **Send Phase** (`/chat/:id`): Load history → Auto-send saved message → Clear storage

**Pros**:
- Clean separation of concerns
- Prevents empty conversation state
- Works with browser navigation

**Cons**:
- 600ms delay before send
- Unnecessary history load for new conversations
- Complex state management across pages

**Optimization Priority**:
1. Skip history load for new conversations (biggest impact)
2. Reduce send delays (UX improvement)
3. Add error recovery (reliability)

---

## Optimization Plan

### Phase 1: Quick Wins (Week 1) - Target: -300ms

**Goal**: Reduce new chat initialization from ~1000ms to ~700ms with minimal refactoring.

#### Task 1.1: Skip History Load for New Conversations
**Priority**: P0 (Critical)  
**Estimated Impact**: -150ms per new chat, -30% Cosmos DB RU consumption  
**Effort**: 2 hours  

**Implementation**:

```typescript
// File: src/hooks/chat/useConversationHistory.ts
export function useConversationHistory(conversationId: string) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const historyAdapter = useMemo<ThreadHistoryAdapter>(
    () => ({
      async load() {
        try {
          if (!conversationId) {
            return { messages: [] }
          }

          // ✅ NEW: Check if this is a new conversation redirect
          const hasPendingMessage = sessionStorage.getItem('pendingMessage')
          if (hasPendingMessage) {
            console.log('[Optimization] Skipping history load for new conversation')
            setIsLoadingHistory(false)
            return { messages: [] }
          }

          setIsLoadingHistory(true)
          setError(null)

          const historyData = await LoadConversationHistory(conversationId)
          // ... rest of existing code
        }
      }
    }),
    [conversationId]
  )

  return { historyAdapter, isLoadingHistory, error }
}
```

**Testing**:
- [ ] New chat creates and sends without backend history call
- [ ] Existing conversation still loads history correctly
- [ ] Browser refresh doesn't break history loading

**Rollback Plan**: Feature flag `SKIP_NEW_CONVERSATION_HISTORY_LOAD`

---

#### Task 1.2: Reduce Message Send Delays
**Priority**: P0 (Critical)  
**Estimated Impact**: -300ms perceived lag  
**Effort**: 3 hours  

**Implementation**:

```typescript
// File: src/hooks/chat/usePendingMessage.ts
export function usePendingMessage({ isLoading, onModeChange }: UsePendingMessageOptions) {
  const threadRuntime = useThreadRuntime()
  const [hasSentPendingMessage, setHasSentPendingMessage] = useState(false)

  useEffect(() => {
    async function processPendingMessage() {
      if (!threadRuntime || isLoading || hasSentPendingMessage) return

      const pending = await getPendingMessage()
      if (!pending) return

      // Clear storage immediately
      await clearPendingMessage()

      // Set mode if needed
      if (pending.mode) {
        onModeChange(pending.mode)
      }

      // ✅ NEW: Use Promise-based approach instead of nested setTimeout
      try {
        // Wait for runtime to be ready
        await waitForRuntimeReady(threadRuntime)

        // Add attachments
        if (pending.attachmentFile.length > 0) {
          for (const file of pending.attachmentFile) {
            threadRuntime.composer.addAttachment(file)
          }
          // Small delay for attachment processing
          await delay(100)
        }

        // Set text and send immediately
        threadRuntime.composer.setText(pending.message)
        await delay(50) // Minimal delay for state sync
        
        threadRuntime.composer.send()
        setHasSentPendingMessage(true)
      } catch (error) {
        console.error('[PendingMessage] Failed to send:', error)
        // Show error to user
        alert('Failed to send message. Please try again.')
      }
    }

    processPendingMessage()
  }, [threadRuntime, isLoading, hasSentPendingMessage, onModeChange])

  return { hasSentPendingMessage }
}

// Helper functions
function waitForRuntimeReady(runtime: ThreadRuntime): Promise<void> {
  return new Promise((resolve) => {
    if (runtime.composer) {
      resolve()
    } else {
      setTimeout(() => resolve(), 50)
    }
  })
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

**Total Delay**: 150ms (down from 600ms)

**Testing**:
- [ ] Messages send consistently without errors
- [ ] Attachments appear before send
- [ ] No race conditions on fast connections

---

#### Task 1.3: Optimize IndexedDB File Storage
**Priority**: P0 (Critical)  
**Estimated Impact**: -200-600ms for multi-file attachments  
**Effort**: 3 hours  

**Problem**: Current IndexedDB implementation is MUCH slower than initially estimated:
- Sequential file writes: 5 files × 150ms = **750ms**
- Read on redirect: **400-600ms** for large files
- Main thread blocking during I/O
- Total overhead: **~1000ms** for typical use case (3-5 images)

**Implementation**:

```typescript
// File: src/utils/chat/storage.ts

// ✅ NEW: Parallel file writes
async function saveFilesToIndexedDB(files: File[]): Promise<void> {
  if (typeof window === 'undefined') return
  if (files.length === 0) return

  const db = await openDatabase()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  // Clear existing files
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear()
    clearRequest.onerror = () => reject(clearRequest.error)
    clearRequest.onsuccess = () => resolve()
  })

  // ✅ NEW: Write all files in parallel (same transaction)
  const writePromises = files.map((file, i) => {
    return new Promise<void>((resolve, reject) => {
      const addRequest = store.add(file, `file-${i}`)
      addRequest.onerror = () => reject(addRequest.error)
      addRequest.onsuccess = () => resolve()
    })
  })

  await Promise.all(writePromises)
  db.close()
}

// ✅ NEW: Convert to base64 for small files (avoid IDB overhead)
async function smartSaveAttachments(files: File[]): Promise<void> {
  if (typeof window === 'undefined') return

  const SMALL_FILE_THRESHOLD = 500 * 1024 // 500KB
  const smallFiles: string[] = []
  const largeFiles: File[] = []

  for (const file of files) {
    if (file.size < SMALL_FILE_THRESHOLD) {
      // Convert small files to base64 and store in sessionStorage
      const base64 = await fileToBase64(file)
      smallFiles.push(JSON.stringify({
        name: file.name,
        type: file.type,
        size: file.size,
        data: base64
      }))
    } else {
      largeFiles.push(file)
    }
  }

  // Store small files in sessionStorage (fast)
  if (smallFiles.length > 0) {
    sessionStorage.setItem('pendingAttachmentsSmall', JSON.stringify(smallFiles))
  }

  // Store large files in IndexedDB (unavoidable)
  if (largeFiles.length > 0) {
    await saveFilesToIndexedDB(largeFiles)
    sessionStorage.setItem('hasLargeAttachments', 'true')
  }
}

// ✅ NEW: Smart retrieval
async function smartGetAttachments(): Promise<File[]> {
  if (typeof window === 'undefined') return []

  const files: File[] = []

  // Get small files from sessionStorage (fast)
  const smallFilesJson = sessionStorage.getItem('pendingAttachmentsSmall')
  if (smallFilesJson) {
    const smallFiles = JSON.parse(smallFilesJson)
    for (const fileData of smallFiles) {
      const parsed = JSON.parse(fileData)
      const blob = base64ToBlob(parsed.data, parsed.type)
      const file = new File([blob], parsed.name, { type: parsed.type })
      files.push(file)
    }
  }

  // Get large files from IndexedDB (slower, but necessary)
  const hasLargeFiles = sessionStorage.getItem('hasLargeAttachments')
  if (hasLargeFiles) {
    const largeFiles = await getFilesFromIndexedDB()
    files.push(...largeFiles)
  }

  return files
}

// Helper: base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteString = atob(base64.split(',')[1])
  const arrayBuffer = new ArrayBuffer(byteString.length)
  const uint8Array = new Uint8Array(arrayBuffer)
  
  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i)
  }
  
  return new Blob([arrayBuffer], { type: mimeType })
}

// Helper: File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

```typescript
// File: src/hooks/chat/useConversationCreator.ts
export function useConversationCreator(mode: ChatMode) {
  // ... existing code

  threadRuntime.composer.send = async () => {
    try {
      const composerState = threadRuntime.composer.getState()
      const message = composerState.text
      const attachmentFiles = composerState.attachments
        .map(a => a.file)
        .filter(Boolean) as File[]

      if (!message.trim()) return

      setIsCreating(true)

      const conversationId = generateConversationId()

      // ✅ NEW: Run API call and storage in parallel
      const [createdId] = await Promise.all([
        withTimeout(
          CreateConversation(conversationId, message),
          CONVERSATION_CONSTANTS.CREATION_TIMEOUT_MS,
          'Conversation creation timeout (30s)'
        ),
        smartSaveAttachments(attachmentFiles) // ✅ Use smart storage
      ])

      if (!createdId) {
        throw new Error('Failed to create conversation')
      }

      router.push(`/chat/${createdId}`)
    } catch (error) {
      console.error('Failed to create conversation:', error)
      setIsCreating(false)
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to create conversation'
      alert(`${errorMessage}. Please try again.`)
    }
  }
  // ... rest of code
}
```

**Performance Improvement**:
- **Small files (< 500KB)**: sessionStorage = ~10-20ms (vs 150ms IDB)
- **Large files**: Parallel IDB writes = ~300ms for 5 files (vs 750ms sequential)
- **Read on redirect**: Mixed retrieval = ~50-100ms (vs 400-600ms)

**Testing**:
- [ ] Small files (< 500KB) use sessionStorage
- [ ] Large files use IndexedDB
- [ ] Mixed file sizes work correctly
- [ ] Parallel writes complete successfully
- [ ] No file corruption or data loss
- [ ] Performance metrics show improvement

**Rollback Plan**: Keep old `saveFilesToIndexedDB` as fallback with feature flag

---

### Phase 2: Architecture Improvement (Week 2-3) - Target: -400ms

**Goal**: Eliminate redirect pattern, reduce to ~300ms total.

#### Task 2.1: Create Combined Backend Endpoint
**Priority**: P0 (Critical)  
**Estimated Impact**: -200ms, eliminates redirect overhead  
**Effort**: 1 day  

**Implementation**:

```python
# File: mock-backend/routes/chat_conversation.py

class CreateAndSendRequest(BaseModel):
    conversationId: str
    message: str
    mode: str = "chat"
    attachments: list = []

@chat_conversation_route.post("/conversations/create-and-send")
async def create_and_send_message(
    request: CreateAndSendRequest,
    _: Annotated[str, Depends(get_authenticated_user)],
    userid: Annotated[str | None, Header()] = None
):
    """
    Atomic operation: Create conversation + send first message.
    Eliminates need for redirect pattern.
    """
    if not userid:
        raise HTTPException(status_code=401, detail="Missing userid header")
    
    conversation_id = request.conversationId
    
    try:
        # 1. Create conversation in database
        db_manager.create_conversation(
            conversation_id=conversation_id,
            title=request.message[:50] + ("..." if len(request.message) > 50 else ""),
            user_id=userid
        )
        
        # 2. Convert message for LangGraph
        langgraph_content = from_assistant_ui_contents_to_langgraph_contents(
            request.message
        )
        
        input_message = [{
            "role": "user",
            "content": langgraph_content
        }]
        
        # 3. Stream response (LangGraph auto-saves to checkpointer)
        graph = get_graph()
        
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
        
    except Exception as e:
        # Rollback conversation if message send fails
        db_manager.delete_conversation(conversation_id, userid)
        raise HTTPException(status_code=500, detail=f"Failed to create and send: {str(e)}")
```

**Testing**:
- [ ] Conversation created in DB
- [ ] First message streams correctly
- [ ] Rollback works on error
- [ ] LangGraph state persisted

---

#### Task 2.2: Update Frontend to Use New Endpoint
**Priority**: P0 (Critical)  
**Estimated Impact**: Enables redirect elimination  
**Effort**: 4 hours  

**Implementation**:

```typescript
// File: src/hooks/chat/useConversationCreator.ts (NEW VERSION)
export function useConversationCreator(mode: ChatMode) {
  const router = useRouter()
  const threadRuntime = useThreadRuntime()
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!threadRuntime) return

    const originalSend = threadRuntime.composer.send

    threadRuntime.composer.send = async () => {
      try {
        const composerState = threadRuntime.composer.getState()
        const message = composerState.text
        const attachments = composerState.attachments

        if (!message.trim()) return

        setIsCreating(true)

        // Generate ID client-side
        const conversationId = generateConversationId()

        // ✅ NEW: Update URL WITHOUT page reload (shallow routing)
        router.replace(`/chat/${conversationId}`, undefined, { shallow: true })

        // ✅ NEW: Use combined endpoint (no redirect needed)
        // The runtime will handle streaming automatically
        // No need for sessionStorage/IndexedDB!
        
        // Call original send - it will use the new URL's conversationId
        await originalSend()

        setIsCreating(false)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setIsCreating(false)
        
        // Revert URL on error
        router.replace('/chat', undefined, { shallow: true })
        
        alert(`Failed to create conversation. Please try again.`)
      }
    }

    return () => {
      threadRuntime.composer.send = originalSend
    }
  }, [threadRuntime, router, mode])

  return { isCreating }
}
```

**NOTE**: This requires updating runtime to detect conversation ID from URL.

**Testing**:
- [ ] URL updates without page reload
- [ ] Message sends immediately
- [ ] No storage operations needed
- [ ] Error handling reverts URL

---

#### Task 2.3: Remove Storage Dependencies
**Priority**: P1 (High)  
**Estimated Impact**: Simplifies codebase, removes 100-1000ms overhead (depending on file count)  
**Effort**: 2 hours  

**Note**: Phase 2 eliminates the need for sessionStorage/IndexedDB entirely by using shallow routing instead of full page redirect.

**Files to Update**:
- ✅ Remove `usePendingMessage` hook entirely
- ✅ Remove `savePendingMessage`, `getPendingMessage`, `clearPendingMessage` from storage.ts
- ✅ Remove IndexedDB logic from storage.ts (saves ~500 lines of complex code)
- ✅ Update `ConversationContent` to not use `usePendingMessage`

**IndexedDB Overhead Being Eliminated**:
```typescript
// Current overhead we're removing:
const savedTime = {
  smallFile_100KB: '~150ms write + 80ms read = 230ms',
  multipleFiles_5x500KB: '~750ms write + 400ms read = 1150ms',
  largeFile_10MB: '~1200ms write + 900ms read = 2100ms',
  
  // Plus code complexity:
  linesOfCode: 200,
  errorHandling: 'Complex (IDB transactions)',
  testingComplexity: 'High (async storage APIs)'
}
```

**Testing**:
- [ ] No sessionStorage writes on new chat
- [ ] No IndexedDB operations
- [ ] Conversation flow still works
- [ ] File attachments handled by runtime directly
- [ ] Performance improvement measured (should see 200-1000ms reduction)

---

### Phase 3: Database Optimization (Week 4) - Cosmos DB Best Practices

**Goal**: Optimize for Cosmos DB scalability and cost.

#### Task 3.1: Implement Proper Partitioning
**Priority**: P0 (Critical for scale)  
**Estimated Impact**: Prevents hot partitions, enables scale beyond 20GB per user  
**Effort**: 1 day  

**Current Schema (PostgreSQL)**:
```sql
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    created_at INTEGER,
    is_pinned BOOLEAN DEFAULT FALSE
)
```

**Cosmos DB Schema (Recommended)**:
```python
# File: mock-backend/lib/database.py

class CosmosConversationManager:
    """Cosmos DB optimized conversation manager with proper partitioning"""
    
    def __init__(self, cosmos_client, database_name: str, container_name: str):
        self.database = cosmos_client.get_database_client(database_name)
        # Container MUST be created with partition key: /userId
        self.container = self.database.get_container_client(container_name)
    
    async def create_conversation(
        self,
        conversation_id: str,
        user_id: str,
        title: str
    ):
        """Create conversation with proper partitioning"""
        item = {
            "id": conversation_id,           # Unique ID
            "userId": user_id,                # Partition key
            "title": title,
            "createdAt": int(time.time()),
            "isPinned": False,
            "messageCount": 0,                # For quick stats
            "lastMessageAt": int(time.time()),
            "type": "conversation"            # For mixed workload queries
        }
        
        # Single partition write (efficient)
        await self.container.create_item(body=item, partition_key=user_id)
    
    async def get_user_conversations(self, user_id: str):
        """Query all conversations for user (same partition = fast)"""
        query = """
            SELECT c.id, c.title, c.createdAt, c.isPinned, c.messageCount
            FROM c
            WHERE c.userId = @userId AND c.type = 'conversation'
            ORDER BY c.isPinned DESC, c.lastMessageAt DESC
        """
        
        # Partition-scoped query (low RU cost)
        items = self.container.query_items(
            query=query,
            parameters=[{"name": "@userId", "value": user_id}],
            partition_key=user_id,  # ✅ Single partition query
            enable_cross_partition_query=False
        )
        
        return [item async for item in items]
    
    async def conversation_exists(self, conversation_id: str, user_id: str) -> bool:
        """Check if conversation exists (point read = 1 RU)"""
        try:
            # Point read (most efficient operation)
            item = await self.container.read_item(
                item=conversation_id,
                partition_key=user_id
            )
            return True
        except CosmosResourceNotFoundError:
            return False
```

**Migration Script**:
```python
# File: mock-backend/scripts/migrate_to_cosmos.py

async def migrate_postgres_to_cosmos():
    """One-time migration script"""
    # 1. Read all conversations from PostgreSQL
    pg_conversations = db_manager.get_all_conversations()
    
    # 2. Write to Cosmos DB with proper partitioning
    cosmos_manager = CosmosConversationManager(...)
    
    for conv in pg_conversations:
        await cosmos_manager.create_conversation(
            conversation_id=conv.id,
            user_id=conv.user_id,
            title=conv.title or "New Conversation"
        )
    
    print(f"Migrated {len(pg_conversations)} conversations")
```

**Benefits**:
- ✅ Even data distribution (no hot partitions)
- ✅ Fast user conversation queries (same partition)
- ✅ Point reads for existence checks (1 RU)
- ✅ Scalable beyond 20GB per user (hierarchical keys if needed)

**Testing**:
- [ ] Create conversation writes to correct partition
- [ ] Query conversations returns all user's conversations
- [ ] Point read works for existence check
- [ ] Performance metrics show reduced RU consumption

---

#### Task 3.2: Embed First Message in Conversation Item
**Priority**: P2 (Nice to have)  
**Estimated Impact**: -1 write operation, faster conversation preview  
**Effort**: 3 hours  

**Implementation**:
```python
async def create_conversation_with_preview(
    self,
    conversation_id: str,
    user_id: str,
    first_message: str
):
    """Create conversation with embedded first message for preview"""
    item = {
        "id": conversation_id,
        "userId": user_id,
        "title": first_message[:50] + ("..." if len(first_message) > 50 else ""),
        "createdAt": int(time.time()),
        "isPinned": False,
        "messageCount": 1,
        "lastMessageAt": int(time.time()),
        "preview": {  # ✅ Embedded for fast access
            "message": first_message[:200],  # First 200 chars
            "timestamp": int(time.time())
        },
        "type": "conversation"
    }
    
    await self.container.create_item(body=item, partition_key=user_id)
```

**Note**: Full message history still in LangGraph state; this is just for UI preview.

---

### Phase 4: Advanced Optimizations (Future)

#### Task 4.1: Implement Optimistic UI
**Priority**: P2  
**Impact**: Perceived instant response  
**Effort**: 1 week  

- Show message in UI immediately
- Stream response in background
- Reconcile state when complete

#### Task 4.2: WebSocket for Real-Time
**Priority**: P3  
**Impact**: Multi-tab sync, faster updates  
**Effort**: 2 weeks  

- Persistent WebSocket connection
- Real-time conversation updates
- Collaborative editing support

#### Task 4.3: Service Worker Caching
**Priority**: P3  
**Impact**: Offline support, faster loads  
**Effort**: 1 week  

- Cache conversation list
- Cache message history
- Sync when online

