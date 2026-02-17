# Assistant UI + LangGraph Integration Plan

## Scope
- Target repo: `/root/AI-ME-POC-Chatbot`
- Reference submodule: `vendor/assistant-ui-langgraph-reference`
- Backend: FastAPI + LangGraph (Python 3.12+)
- Frontend: Next.js (TypeScript)
- Requirements: SSE streaming, tool calling/results, HITL approval (LangGraph interrupts + resume), reload/edit/branching via checkpoints, server-side MessageRepository keyed by `thread_id`.

## Decisions
- HITL gating tool: `generate_image` only.
- Keep existing conversation creation and attachment upload flow.
- Minimal diff: integrate into current structure.
- Divergence from reference: persist MessageRepository pointer metadata on the existing `conversations` container (partition key `/userid`), not a separate `thread_repos` container.
- Divergence from reference: `GET/PUT /api/v1/threads/{thread_id}/repo` require `userid` (to allow single-partition reads/writes in `conversations`).
- Divergence from reference: add `repo_version` bump/return on repo writes (per `docs/migration/welcome.md`).

## Step-by-Step Plan (Order of Operations)

1) Backend SSE routes
- Copy `vendor/assistant-ui-langgraph-reference/backend/routes/chat.py` to `mock-backend/routes/chat.py`.
- Adapt request parsing so `message.content` accepts `string | content[]`.
  - If `content[]`, convert with `from_assistant_ui_contents_to_langgraph_contents` to preserve attachments.
  - If `string`, pass through as-is.
- Keep reference SSE conversion and `astream_events(..., version="v2")` usage.

2) HITL approval for `generate_image`
- Update `mock-backend/agent/graph.py` to include:
  - `DANGEROUS_TOOL_NAMES = {"generate_image"}`.
  - `approval_node()` using `interrupt(...)` with tool calls payload.
  - Conditional edge to approval node when dangerous tool calls exist.
  - `call_model` uses `await model_with_tools.ainvoke(...)` for streaming events.

3) MessageRepository persistence (combined into conversations + blob)
- Do NOT add a new Cosmos container.
- Store the exported Assistant UI `MessageRepository` payload in Azure Blob Storage (gzipped JSON).
- Store a lightweight pointer on the existing `conversations` item (scoped by `/userid`).
- Ensure `mock-backend/lib/blob.py` exposes `upload_bytes_to_blob` and `download_blob_to_bytes` (merge from reference if missing).

Recommended conversation document shape additions (simple):
```json
{
  "repo_version": 3,
  "repo_ref": {
    "blob": "thread_repos/<thread_id>/<uuid>.json.gz",
    "sha256": "<hex>",
    "updated_at": 1234567890
  }
}
```

4) Conversation metadata `repo_version` + `repo_ref`
- Update `mock-backend/lib/database.py`:
  - Add `repo_version: Optional[int]` to `ConversationMetadata`.
  - Add `repo_ref: Optional[Dict[str, Any]]` to `ConversationMetadata` (or a typed dataclass if preferred).
  - Initialize `repo_version = 0` in `create_conversation`.
  - Default missing `repo_version` to `0` when reading.
  - Add `bump_repo_version(conversation_id, userid) -> int`.
  - Add helpers to read/write `repo_ref` on the conversation item.
- In `PUT /api/v1/threads/{thread_id}/repo` (userid-scoped), write `repo_ref`, bump `repo_version`, and return it.

5) Wire routers
- In `mock-backend/main.py`:
  - `app.include_router(chat_routes, prefix="/api/v1/chat")`
  - `app.include_router(thread_repo_routes, prefix="/api/v1/threads")`

6) Frontend SSE runtime adapter
- Copy `vendor/assistant-ui-langgraph-reference/frontend/components/assistant-ui/CustomLanggraphRuntime.tsx`
  to `src/components/assistant-ui/CustomLanggraphRuntime.tsx`.
- Adjust to use a `threadId` prop only (no URL/localStorage thread selection).
- Outbound `message` payload:
  - Text-only: `content: "..."`.
  - With attachments: `content: [{type:"text",...},{type:"image",image:"chatbot://..."}]`.
- Keep checkpoint mapping into `metadata.custom.lg` for branching/edit/reload.

7) HITL UI + tool mapping
- Replace `src/components/assistant-ui/tool-fallback.tsx` with reference HITL-aware version.
- Add `src/components/assistant-ui/toolkit.tsx` from reference and register `generate_image`.
- Refactor `src/components/assistant-ui/tool-ui/ImageGeneration.tsx` to export a toolkit-compatible render component.

8) Enable edit/branching
- In `src/components/assistant-ui/thread.tsx`:
  - `Settings.editMessages = true`
  - `Settings.regenerate = true`

9) Page wiring
- `/chat/[conversationId]` (`src/app/chat/[conversationId]/page.tsx`):
  - Use `CustomLanggraphRuntime threadId={conversationId}`.
  - Remove data-stream runtime and history adapter.
  - Keep `usePendingMessage` to replay pending message + attachments.
- `/chat` (`src/app/chat/page.tsx`):
  - Render a standalone welcome component (no runtime provider).

10) Welcome page with attachments
- Add `src/components/features/chat/WelcomeContent.tsx` based on reference welcome UI.
- Preserve current flow:
  - Generate `conversationId`.
  - Call `CreateConversation(conversationId, message)`.
  - `savePendingMessage(message, attachments)`.
  - Redirect to `/chat/${conversationId}`.
- Accept `image/jpeg,image/png,image/webp` to match `VisionImageAdapter`.

11) Optional: per-thread pending storage
- Update `src/utils/chat/storage.ts` to key pending message by `threadId`.
- Update `src/hooks/chat/usePendingMessage.ts` and `useConversationCreator` to pass `conversationId`.

## File Map: Copy vs Re-implement

Copy + adapt
- `vendor/assistant-ui-langgraph-reference/backend/routes/chat.py`
  -> `mock-backend/routes/chat.py`
- `vendor/assistant-ui-langgraph-reference/backend/routes/thread_repo.py`
  -> `mock-backend/routes/thread_repo.py` (adapt storage to `conversations` + require `userid`)
- `vendor/assistant-ui-langgraph-reference/frontend/components/assistant-ui/CustomLanggraphRuntime.tsx`
  -> `src/components/assistant-ui/CustomLanggraphRuntime.tsx`
- `vendor/assistant-ui-langgraph-reference/frontend/components/assistant-ui/tool-fallback.tsx`
  -> `src/components/assistant-ui/tool-fallback.tsx`
- `vendor/assistant-ui-langgraph-reference/frontend/components/assistant-ui/toolkit.tsx`
  -> `src/components/assistant-ui/toolkit.tsx` (rename tool to `generate_image`)

Re-implement / merge
- `mock-backend/agent/graph.py`
- `mock-backend/lib/database.py`
- `mock-backend/lib/blob.py`
- `mock-backend/main.py`
- `mock-backend/routes/thread_repo.py` (combined storage, userid required)
- `src/app/chat/page.tsx`
- `src/app/chat/[conversationId]/page.tsx`
- `src/components/assistant-ui/thread.tsx`
- `src/components/features/chat/WelcomeContent.tsx`
- `src/components/assistant-ui/tool-ui/ImageGeneration.tsx`
- `src/utils/chat/storage.ts` (optional per-thread)
- `src/hooks/chat/usePendingMessage.ts`

## SSE Event Contract (verbatim JSON shapes)
Each event is sent as `data: <json>\n\n`, followed by a final `data: [DONE]\n\n`.

```text
{"type":"meta","phase":"start","thread_id":"...","checkpoint_id":null}
{"type":"token","content":"..."}
{"type":"tool_call","id":"...","name":"...","arguments":{...}}
{"type":"tool_result","tool_call_id":"...","name":"...","content":"..."}
{"type":"interrupt","payload":{"type":"tool_approval_required","tool_calls":[...]}}
{"type":"meta","phase":"interrupt","checkpoint_id":"..."}
{"type":"meta","phase":"complete","checkpoint_id":"..."}
{"type":"done"}
{"type":"error","error":"..."}
```

## Minimal Endpoints (paths + shapes)

POST `/api/v1/chat/stream`
```json
{
  "thread_id": "string",
  "checkpoint_id": "string | null",
  "message": { "role": "human", "content": "string | content[]" },
  "messages": [{ "role": "string", "content": "string | content[]" }]
}
```
Response: `text/event-stream` SSE using the contract above.

POST `/api/v1/chat/feedback`
```json
{
  "thread_id": "string",
  "checkpoint_id": "string | null",
  "approval_data": {
    "type": "tool_approval",
    "decisions": [
      { "id": "string", "decision": "approved", "arguments": {} },
      { "id": "string", "decision": "rejected" }
    ]
  }
}
```
Response: `text/event-stream` SSE using the same contract.

GET `/api/v1/chat/interrupt?thread_id=...&checkpoint_id=...`
```json
{
  "thread_id": "string",
  "interrupted": true,
  "checkpoint_id": "string | null",
  "payload": { "type": "tool_approval_required", "tool_calls": [ ... ] }
}
```
If not interrupted:
```json
{ "thread_id": "string", "interrupted": false, "checkpoint_id": "string | null" }
```

GET `/api/v1/threads/{thread_id}/repo`
```json
{ "thread_id": "string", "repo": { ... } | null }
```

Headers:
- `userid: string` (required)

PUT `/api/v1/threads/{thread_id}/repo`
```json
{ "repo": { ... } }
```
Response (divergence from reference to return repo_version):
```json
{ "thread_id": "string", "updated_at": 1234567890, "repo_version": 3 }
```

Headers:
- `userid: string` (required)

## Validation Checklist

Manual tests
- `/chat` welcome sends message + attachment, redirects to `/chat/:id`.
- `/chat/:id` replays pending message + attachments.
- SSE streaming works; tool calls + results render.
- `generate_image` triggers HITL approval; approve/reject resumes graph.
- Refresh during interrupt rehydrates approval UI.
- Edit/regenerate creates branches and persists across reload.

Build commands
- `make dev`
- `bun run build`
- `cd mock-backend && uv sync`

## Risks
- Auth/multi-user: repo is stored on the conversation item (partition `/userid`), but if `userid` is a spoofable header (vs server-authenticated), users can read/write other users' repos.
- Data retention: repository blobs can grow without TTL or pruning.
- Branching correctness depends on `metadata.custom.lg.checkpoint_id` on assistant messages.
- Interrupt replay if you inspect final state with `checkpoint_id` in config.
