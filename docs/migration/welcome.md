# Welcome Page Migration Plan

## Current State (Observed)

- `/chat` uses `FirstChatAPIRuntime()` and `useConversationCreator` intercepts composer send to create a conversation, save pending message + attachments, and redirect to `/chat/:id`.
- `/chat/:id` uses the data-stream runtime and loads history from `/conversations/:id`.
- Pending message storage includes attachments via `sessionStorage` + IndexedDB in `src/utils/chat/storage.ts`.
- Edit/regenerate/branching UI is disabled in `src/components/assistant-ui/thread.tsx`.
- Backend streams the legacy chunk protocol and conversation metadata has no `repo_version`.

## Reference Welcome Page (New)

- `vendor/assistant-ui-langgraph-reference/frontend/app/welcome.tsx` creates a thread id client-side, stores a pending text-only message in `sessionStorage`, and redirects to `/chat/:id`.
- No backend conversation creation and no attachment support.

## Target State

- `/chat` becomes a standalone welcome page with the reference UI but preserves backend conversation creation and attachment support.
- `/chat/:id` runs SSE runtime with HITL, repo persistence, and checkpoint time-travel; edit/branching UI enabled.
- Conversation metadata includes `repo_version` and updates on thread repo writes.

## Full Implementation Plan

### 1) Data Model + repo_version

- Add `repo_version: Optional[int]` to `ConversationMetadata` in `mock-backend/lib/database.py`.
- Initialize `repo_version = 0` in `create_conversation`.
- Default missing `repo_version` to `0` when reading.
- Add `bump_repo_version(conversation_id, userid) -> int` in `DatabaseManager`.

### 2) Thread Repo Persistence

- Add `mock-backend/lib/thread_repo_store.py` from the reference (Cosmos container `thread_repos`, partition key `/thread_id`).
- Add `mock-backend/routes/thread_repo.py` from the reference.
- On `PUT /api/v1/threads/{thread_id}/repo`, upsert repo, then call `bump_repo_version(...)` and return `repo_version`.

### 3) SSE + HITL Backend

- Copy `vendor/assistant-ui-langgraph-reference/backend/routes/chat.py` to `mock-backend/routes/chat.py`.
- Update request parsing to accept `message.content` as string or content parts; convert parts using `from_assistant_ui_contents_to_langgraph_contents` to preserve attachments.
- Port HITL approval logic into `mock-backend/agent/graph.py` (interrupt + resume).
- Ensure model call uses `ainvoke` so streaming events are emitted.
- Wire routes in `mock-backend/main.py`:
  - `app.include_router(chat_routes, prefix="/api/v1/chat")`
  - `app.include_router(thread_repo_routes, prefix="/api/v1/threads")`

### 4) Frontend SSE Runtime

- Copy `vendor/assistant-ui-langgraph-reference/frontend/components/assistant-ui/CustomLanggraphRuntime.tsx` to `src/components/assistant-ui/CustomLanggraphRuntime.tsx`.
- Change it to accept `threadId` as a prop; remove URL/localStorage thread id logic.
- Ensure outbound delta message includes attachments (content parts).
- Persist repo to `/api/be/api/v1/threads/{thread_id}/repo` and rehydrate from it.
- Replace `src/components/assistant-ui/tool-fallback.tsx` with the HITL-aware reference version.

### 5) Enable Edit/Branching UI

- In `src/components/assistant-ui/thread.tsx`, set `Settings.editMessages = true` and `Settings.regenerate = true`.
- Confirm runtime attaches `checkpoint_id` to assistant message metadata so edits and branches fork correctly.

### 6) Page Wiring

- `/chat/[conversationId]`:
  - Use `CustomLanggraphRuntime` with `threadId={conversationId}`.
  - Remove history adapter and data-stream runtime usage.
  - Keep `usePendingMessage` to replay pending message + attachments.
- `/chat`:
  - Replace runtime-based page with a standalone welcome component.

### 7) Standalone Welcome with Attachments

- Create `src/components/features/chat/WelcomeContent.tsx` based on `vendor/assistant-ui-langgraph-reference/frontend/app/welcome.tsx`.
- Add file input + preview + remove for attachments; accept `image/jpeg,image/png,image/webp` to match `VisionImageAdapter`.
- On submit:
  - Generate conversationId (`generateConversationId()`).
  - Call `CreateConversation(conversationId, message)` with `withTimeout`.
  - `savePendingMessage(message, attachments)` to persist files.
  - Redirect to `/chat/${conversationId}`.
- Update `/chat/page.tsx` to render `WelcomeContent` directly (no runtime provider).

### 8) Pending Message Storage Update (Recommended)

- Update storage to support per-thread keys to avoid conflicts across tabs:
  - `savePendingMessage(message, files, threadId)`
  - `getPendingMessage(threadId)`
  - `clearPendingMessage(threadId)`
- Update `usePendingMessage` to read by `conversationId`.

### 9) Cleanup

- Deprecate `FirstChatAPIRuntime()` on `/chat` if the welcome page is standalone.
- Keep `useConversationCreator` only if it is reused elsewhere; otherwise move its logic into a shared helper used by the welcome component.

## Validation Checklist

- Backend:
  - `POST /api/v1/chat/stream` emits SSE events (`meta`, `token`, `tool_call`, `tool_result`, `done`).
  - HITL flow: `interrupt` appears, `feedback` resumes.
  - `PUT /api/v1/threads/:id/repo` increments and returns `repo_version`.
- Frontend:
  - `/chat` welcome page creates conversation, saves pending message + attachments, redirects to `/chat/:id`.
  - `/chat/:id` replays pending message and attachments, SSE streaming works.
  - Reload preserves branches; edit/regenerate buttons work.

## Risks

- Pending message collisions if per-thread keys are not used.
- Repo size growth; consider retention strategy later.
- Multi-user exposure: thread repo keyed only by `thread_id`.
