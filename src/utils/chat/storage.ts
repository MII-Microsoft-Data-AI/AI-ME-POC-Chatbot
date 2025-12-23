import type { ChatMode, PendingMessage } from '@/types/chat'

// Storage utilities untuk chat feature
// Handle localStorage (chat mode) dan sessionStorage (pending messages)
// Handle IndexedDB untuk file attachments
const STORAGE_KEYS = {
  CHAT_MODE: 'chat-mode',
  PENDING_MESSAGE: 'pendingMessage',
  PENDING_MODE: 'pendingMode',
  PENDING_ATTACHMENTS: 'pendingAttachments',
} as const

const DB_NAME = 'chat-app-db'
const STORE_NAME = 'pending-attachments'
const DB_VERSION = 1

// IndexedDB helper functions
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('IndexedDB not available'))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })
}

async function saveFilesToIndexedDB(files: File[]): Promise<void> {
  if (typeof window === 'undefined') return

  const db = await openDatabase()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  // Clear existing files
  await new Promise<void>((resolve, reject) => {
    const clearRequest = store.clear()
    clearRequest.onerror = () => reject(clearRequest.error)
    clearRequest.onsuccess = () => resolve()
  })

  // Store new files
  for (let i = 0; i < files.length; i++) {
    await new Promise<void>((resolve, reject) => {
      const addRequest = store.add(files[i], `file-${i}`)
      addRequest.onerror = () => reject(addRequest.error)
      addRequest.onsuccess = () => resolve()
    })
  }

  db.close()
}

async function getFilesFromIndexedDB(): Promise<File[]> {
  if (typeof window === 'undefined') return []

  const db = await openDatabase()
  const transaction = db.transaction([STORE_NAME], 'readonly')
  const store = transaction.objectStore(STORE_NAME)

  const files: File[] = []

  return new Promise((resolve, reject) => {
    const request = store.getAll()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      files.push(...(request.result as File[]))
      db.close()
      resolve(files)
    }
  })
}

async function clearFilesFromIndexedDB(): Promise<void> {
  if (typeof window === 'undefined') return

  const db = await openDatabase()
  const transaction = db.transaction([STORE_NAME], 'readwrite')
  const store = transaction.objectStore(STORE_NAME)

  return new Promise((resolve, reject) => {
    const request = store.clear()
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db.close()
      resolve()
    }
  })
}

export function getChatMode(): ChatMode | null {
  if (typeof window === 'undefined') return null
  
  const saved = localStorage.getItem(STORAGE_KEYS.CHAT_MODE)
  return saved === 'image' ? 'image' : saved === 'chat' ? 'chat' : null
}

export function saveChatMode(mode: ChatMode): void {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(STORAGE_KEYS.CHAT_MODE, mode)
}

export async function getPendingMessage(): Promise<PendingMessage | null> {
  if (typeof window === 'undefined') return null
  
  const message = sessionStorage.getItem(STORAGE_KEYS.PENDING_MESSAGE)
  const mode = sessionStorage.getItem(STORAGE_KEYS.PENDING_MODE) as ChatMode

  if (!message) return null

  // Get attachments from IndexedDB
  const attachmentFiles = await getFilesFromIndexedDB()
  
  return {
    message,
    mode: mode || 'chat',
    attachmentFile: attachmentFiles,
  }
}

export async function savePendingMessage(
  message: string,
  mode: ChatMode,
  attachmentsFile: File[]
): Promise<void> {
  if (typeof window === 'undefined') return
  
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MESSAGE, message)
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MODE, mode)

  // Store files in IndexedDB
  await saveFilesToIndexedDB(attachmentsFile)
}

export async function clearPendingMessage(): Promise<void> {
  if (typeof window === 'undefined') return
  
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MESSAGE)
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MODE)

  // Remove files from IndexedDB
  await clearFilesFromIndexedDB()
}
