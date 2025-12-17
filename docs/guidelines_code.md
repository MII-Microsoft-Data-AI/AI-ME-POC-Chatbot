# Frontend Code Guidelines

> **Single Source of Truth** untuk coding standards dan best practices di project ini

---

## 📁 Project Structure

```plaintext
src/
├── app/                          # Next.js App Router pages
│   └── chat/                     # Chat feature
│       ├── page.tsx              # New chat (30 lines)
│       └── [conversationId]/
│           └── page.tsx          # Conversation (41 lines)
│
├── components/
│   ├── features/chat/            # Chat feature components
│   │   ├── NewChatContent.tsx    # New chat UI (16 lines)
│   │   ├── ConversationContent.tsx # Conversation UI (22 lines)
│   │   ├── ErrorState.tsx        # Error display (24 lines)
│   │   └── ChatLayout.tsx        # Layout wrapper (11 lines)
│   ├── ui/                       # Reusable UI components
│   └── assistant-ui/             # Assistant-specific components
│
├── hooks/
│   └── chat/                     # Chat hooks
│       ├── useChatMode.ts        # Mode management (32 lines)
│       ├── useConversationCreator.ts # Create conversation (81 lines)
│       ├── usePendingMessage.ts  # Pending message (48 lines)
│       └── useConversationHistory.ts # Load history (60 lines)
│
├── utils/
│   └── chat/                     # Chat utilities
│       ├── storage.ts            # localStorage/sessionStorage (50 lines)
│       └── conversation.ts       # ID generation, timeout (23 lines)
│
├── types/
│   └── chat.ts                   # Chat types (12 lines)
│
└── lib/                          # External integrations
    └── integration/client/
        └── chat-conversation.ts  # API calls
```

**Total**: 436 lines of clean, organized code

---

## 🎯 Clean Code Principles

### 1. **Single Responsibility Principle (SRP)**

- Each component should have ONE clear responsibility
- Extract complex logic into custom hooks
- Separate business logic from UI rendering

### 2. **DRY (Don't Repeat Yourself)**

- Extract reusable logic into hooks
- Create shared components for common UI patterns
- Use utility functions for repeated operations

### 3. **Separation of Concerns**

- **Pages**: Orchestrate components and handle routing
- **Components**: Handle UI rendering and user interactions
- **Hooks**: Manage state and side effects
- **Utils**: Pure functions for data transformation
- **Lib**: External integrations and API calls

### 4. **Naming Conventions**

#### Files & Folders

```plaintext
✅ GOOD:
- PascalCase for components: `ChatPageContent.tsx`
- camelCase for hooks: `useChatMode.ts`
- camelCase for utils: `conversation.ts`
- kebab-case for folders: `chat-feature/`

❌ BAD:
- chatPageContent.tsx
- UseChatMode.ts
- Conversation.ts
```

#### Variables & Functions

```typescript
✅ GOOD:
const conversationId = params.conversationId
const handleModeChange = (mode: ChatMode) => {}
const isLoadingHistory = true

❌ BAD:
const ConversationId = params.conversationId
const ModeChange = (mode: ChatMode) => {}
const loading_history = true
```

### 5. **Component Structure**

```typescript
// 1. Imports (grouped logically)
import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// 2. Type definitions
interface ChatPageContentProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

// 3. Component
export function ChatPageContent({ mode, onModeChange }: ChatPageContentProps) {
  // 3.1. Hooks (in order: router, context, state, effects)
  const router = useRouter()
  const [isCreating, setIsCreating] = useState(false)
  
  // 3.2. Event handlers
  const handleSubmit = () => {}
  
  // 3.3. Render helpers (if needed)
  const renderContent = () => {}
  
  // 3.4. Return JSX
  return <div>...</div>
}
```

---

## 📋 How to Import

**Import langsung dari file** (no barrel exports):

```typescript
// Components
import { NewChatContent } from '@/components/features/chat/NewChatContent'
import { ErrorState } from '@/components/features/chat/ErrorState'

// Hooks
import { useChatMode } from '@/hooks/chat/useChatMode'
import { useConversationCreator } from '@/hooks/chat/useConversationCreator'

// Utils
import { getChatMode, saveChatMode } from '@/utils/chat/storage'
import { generateConversationId } from '@/utils/chat/conversation'

// Types
import type { ChatMode } from '@/types/chat'
```

---

## � Real Code Examples

### Example 1: Chat Page (Orchestration)

```typescript
// app/chat/page.tsx - Simple orchestration, no business logic
'use client'

import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { useChatMode } from '@/hooks/chat/useChatMode'
import { NewChatContent } from '@/components/features/chat/NewChatContent'
import { ChatLayout } from '@/components/features/chat/ChatLayout'

function NewChatPage() {
  const { mode, setMode } = useChatMode()

  const runtime = useLocalRuntime({
    async *run() {
      return
    },
  })

  return (
    <ChatLayout>
      <AssistantRuntimeProvider runtime={runtime}>
        <NewChatContent mode={mode} onModeChange={setMode} />
      </AssistantRuntimeProvider>
    </ChatLayout>
  )
}

export default NewChatPage
```

### Example 2: Custom Hook (Business Logic)

```typescript
// hooks/chat/useChatMode.ts
import { useState, useEffect } from 'react'
import type { ChatMode } from '@/types/chat'
import { getChatMode, saveChatMode } from '@/utils/chat/storage'

// Hook untuk manage chat mode (chat/image) dengan localStorage persistence
// SSR-safe: mounted flag untuk prevent hydration mismatch
export function useChatMode() {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ChatMode>('chat')

  useEffect(() => {
    setMounted(true)
    const savedMode = getChatMode()
    if (savedMode) setMode(savedMode)
  }, [])

  useEffect(() => {
    if (mounted) saveChatMode(mode)
  }, [mode, mounted])

  return { mode, setMode, mounted }
}
```

### Example 3: Utility Functions (Pure Functions)

```typescript
// utils/chat/storage.ts
import type { ChatMode } from '@/types/chat'

// Storage utilities untuk chat feature
// Handle localStorage (chat mode) dan sessionStorage (pending messages)
const STORAGE_KEYS = {
  CHAT_MODE: 'chat-mode',
  PENDING_MESSAGE: 'pendingMessage',
} as const

export function getChatMode(): ChatMode | null {
  if (typeof window === 'undefined') return null
  const saved = localStorage.getItem(STORAGE_KEYS.CHAT_MODE)
  return saved === 'image' ? 'image' : saved === 'chat' ? 'chat' : null
}

export function saveChatMode(mode: ChatMode): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.CHAT_MODE, mode)
}
```

---

## �🔧 Custom Hooks Pattern

### When to Create a Hook?

- Logic is reused across multiple components
- Complex state management with multiple `useState`/`useEffect`
- Side effects that need cleanup
- Business logic that doesn't belong in components

### Hook Naming Convention

```typescript
✅ GOOD:
- useChatMode()
- useConversationCreator()
- usePendingMessage()

❌ BAD:
- chatMode()
- createConversation()
- pendingMessage()
```

### Hook Structure Example

```typescript
// hooks/chat/useChatMode.ts
import { useState, useEffect } from 'react'
import { ChatMode } from '@/types/chat'
import { getChatMode, saveChatMode } from '@/utils/chat/storage'

export function useChatMode() {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ChatMode>('chat')

  // Load from storage on mount
  useEffect(() => {
    setMounted(true)
    const savedMode = getChatMode()
    if (savedMode) setMode(savedMode)
  }, [])

  // Save to storage on change
  useEffect(() => {
    if (mounted) {
      saveChatMode(mode)
    }
  }, [mode, mounted])

  return { mode, setMode }
}
```

---

## 🎨 Component Patterns

### 1. **Container/Presentational Pattern**

```typescript
// ❌ BAD: Everything in one component
function ChatPage() {
  const [mode, setMode] = useState('chat')
  const [isLoading, setIsLoading] = useState(false)
  // ... 50 more lines of logic
  return <div>...</div>
}

// ✅ GOOD: Separated concerns
// Container (Page)
function ChatPage() {
  const { mode, setMode } = useChatMode()
  return <ChatPageContent mode={mode} onModeChange={setMode} />
}

// Presentational (Component)
function ChatPageContent({ mode, onModeChange }: Props) {
  const { isCreating, handleSend } = useConversationCreator(mode)
  return <Thread mode={mode} onModeChange={onModeChange} />
}
```

### 2. **Error Boundary Pattern**

```typescript
// components/features/chat/ErrorState.tsx
interface ErrorStateProps {
  error: string
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center space-y-4 max-w-md">
        <div className="text-red-500 text-2xl">😕</div>
        <h2 className="text-xl font-semibold text-gray-800">Oops!</h2>
        <p className="text-gray-600">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="btn-primary">
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}
```

---

## 📦 Utility Functions

### Storage Utilities

```typescript
// utils/chat/storage.ts
import { ChatMode } from '@/types/chat'

const STORAGE_KEYS = {
  CHAT_MODE: 'chat-mode',
  PENDING_MESSAGE: 'pendingMessage',
  PENDING_MODE: 'pendingMode',
} as const

export function getChatMode(): ChatMode | null {
  const saved = localStorage.getItem(STORAGE_KEYS.CHAT_MODE)
  return saved === 'image' ? 'image' : saved === 'chat' ? 'chat' : null
}

export function saveChatMode(mode: ChatMode): void {
  localStorage.setItem(STORAGE_KEYS.CHAT_MODE, mode)
}

export function getPendingMessage(): { message: string; mode: ChatMode } | null {
  const message = sessionStorage.getItem(STORAGE_KEYS.PENDING_MESSAGE)
  const mode = sessionStorage.getItem(STORAGE_KEYS.PENDING_MODE) as ChatMode
  
  if (!message) return null
  
  return { message, mode: mode || 'chat' }
}

export function savePendingMessage(message: string, mode: ChatMode): void {
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MESSAGE, message)
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MODE, mode)
}

export function clearPendingMessage(): void {
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MESSAGE)
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MODE)
}
```

### Conversation Utilities

```typescript
// utils/chat/conversation.ts

export function generateConversationId(): string {
  return crypto.randomUUID()
}

export function createTimeoutPromise(ms: number, errorMessage: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(errorMessage)), ms)
  )
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([promise, createTimeoutPromise(ms, errorMessage)])
}
```

---

## 🧪 Testing Considerations

### File Organization

```plaintext
src/
├── components/features/chat/
│   ├── ChatPageContent.tsx
│   └── __tests__/
│       └── ChatPageContent.test.tsx
├── hooks/chat/
│   ├── useChatMode.ts
│   └── __tests__/
│       └── useChatMode.test.ts
```

---

## 📝 Comments & Documentation

### When to Comment

```typescript
// ✅ GOOD: Explain WHY, not WHAT
// Override composer send to create conversation before redirect
// This ensures the conversation exists when the user lands on /chat/[id]
threadRuntime.composer.send = async () => { ... }

// ❌ BAD: Stating the obvious
// Set isCreating to true
setIsCreating(true)
```

### JSDoc for Complex Functions

```typescript
/**
 * Creates a new conversation and redirects to its page
 * @param message - The initial message to send
 * @param mode - The chat mode (chat or image)
 * @throws {Error} If conversation creation fails or times out
 */
async function createAndRedirect(message: string, mode: ChatMode): Promise<void> {
  // ...
}
```

---

## ⚡ Performance Best Practices

### 1. **Memoization**

```typescript
// ✅ GOOD: Memoize expensive computations
const HistoryAdapter = React.useMemo<ThreadHistoryAdapter>(() => ({
  async load() { ... }
}), [conversationId])

// ❌ BAD: Recreating on every render
const HistoryAdapter = {
  async load() { ... }
}
```

### 2. **Avoid Inline Functions in JSX**

```typescript
// ✅ GOOD
const handleClick = useCallback(() => {
  doSomething()
}, [dependencies])

return <button onClick={handleClick}>Click</button>

// ❌ BAD
return <button onClick={() => doSomething()}>Click</button>
```

---

## 🚀 Migration Checklist

When refactoring existing code:

- [ ] Identify single responsibilities
- [ ] Extract custom hooks for complex logic
- [ ] Create utility functions for pure operations
- [ ] Separate components into feature folders
- [ ] Add proper TypeScript types
- [ ] Remove code duplication
- [ ] Add meaningful comments for complex logic
- [ ] Test the refactored code
- [ ] Update imports across the project

---

## 📚 Quick Reference

### File Locations

- **Pages**: `src/app/chat/`
- **Components**: `src/components/features/chat/`
- **Hooks**: `src/hooks/chat/`
- **Utils**: `src/utils/chat/`
- **Types**: `src/types/chat.ts`

### Common Patterns

**Create new hook**:

```typescript
// hooks/chat/useYourHook.ts
import { useState } from 'react'

// Brief comment explaining what this hook does
export function useYourHook() {
  const [state, setState] = useState()
  return { state, setState }
}
```

**Create new component**:

```typescript
// components/features/chat/YourComponent.tsx
'use client'

interface YourComponentProps {
  prop: string
}

export function YourComponent({ prop }: YourComponentProps) {
  return <div>{prop}</div>
}
```

**Create new utility**:

```typescript
// utils/chat/yourUtil.ts

// Brief comment explaining what this does
export function yourFunction(param: string): string {
  return param
}
```

### Key Principles

1. ✅ **Import langsung** - No barrel exports
2. ✅ **Inline comments** - Explain WHY, not WHAT
3. ✅ **SSR-safe** - Check `typeof window`
4. ✅ **Type-safe** - Use TypeScript properly
5. ✅ **Single responsibility** - One file, one purpose

---

## 📚 External Resources

- [React Best Practices](https://react.dev/learn)
- [Next.js App Router](https://nextjs.org/docs/app)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Clean Code JavaScript](https://github.com/ryanmcdermott/clean-code-javascript)

---

**Last Updated**: December 16, 2025  
**Version**: 2.0.0  
**Status**: ✅ Production Ready
