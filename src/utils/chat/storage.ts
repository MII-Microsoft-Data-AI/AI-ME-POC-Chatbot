import type { ChatMode, PendingMessage } from '@/types/chat'

// Storage utilities untuk chat feature
// Handle localStorage (chat mode) dan sessionStorage (pending messages)
const STORAGE_KEYS = {
  CHAT_MODE: 'chat-mode',
  PENDING_MESSAGE: 'pendingMessage',
  PENDING_MODE: 'pendingMode',
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

export function getPendingMessage(): PendingMessage | null {
  if (typeof window === 'undefined') return null
  
  const message = sessionStorage.getItem(STORAGE_KEYS.PENDING_MESSAGE)
  const mode = sessionStorage.getItem(STORAGE_KEYS.PENDING_MODE) as ChatMode
  
  if (!message) return null
  
  return {
    message,
    mode: mode || 'chat',
  }
}

export function savePendingMessage(message: string, mode: ChatMode): void {
  if (typeof window === 'undefined') return
  
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MESSAGE, message)
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MODE, mode)
}

export function clearPendingMessage(): void {
  if (typeof window === 'undefined') return
  
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MESSAGE)
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MODE)
}
