import type { PendingMessage } from '@/types/chat'

// Storage utilities untuk chat feature
// Handle sessionStorage (pending messages) and IndexedDB untuk file attachments
export const STORAGE_KEYS = {
  PENDING_MESSAGE: 'pendingMessage',
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

  // ✅ PHASE 1.3: Write all files in parallel (same transaction)
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

// ✅ PHASE 1.4: Smart file storage utilities
const SMALL_FILE_THRESHOLD = 500 * 1024 // 500KB

// Helper: File to base64
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
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

// Smart save - small files to sessionStorage, large to IndexedDB
async function smartSaveAttachments(files: File[]): Promise<void> {
  if (typeof window === 'undefined') return
  if (files.length === 0) return

  const smallFiles: string[] = []
  const largeFiles: File[] = []

  for (const file of files) {
    if (file.size < SMALL_FILE_THRESHOLD) {
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

  // Store large files in IndexedDB
  if (largeFiles.length > 0) {
    await saveFilesToIndexedDB(largeFiles)
    sessionStorage.setItem('hasLargeAttachments', 'true')
  }
}

// Smart retrieval
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

  // Get large files from IndexedDB
  const hasLargeFiles = sessionStorage.getItem('hasLargeAttachments')
  if (hasLargeFiles) {
    const largeFiles = await getFilesFromIndexedDB()
    files.push(...largeFiles)
  }

  return files
}

export function getChatMode(): null {
  return null
}

export function saveChatMode(): void {
  // No longer needed
}

export async function getPendingMessage(): Promise<PendingMessage | null> {
  if (typeof window === 'undefined') return null
  
  const message = sessionStorage.getItem(STORAGE_KEYS.PENDING_MESSAGE)

  if (!message) return null

  // ✅ PHASE 1.4: Use smart retrieval instead of direct IDB
  const attachmentFiles = await smartGetAttachments()
  
  return {
    message,
    attachmentFile: attachmentFiles,
  }
}

export async function savePendingMessage(
  message: string,
  attachmentsFile: File[]
): Promise<void> {
  if (typeof window === 'undefined') return
  
  sessionStorage.setItem(STORAGE_KEYS.PENDING_MESSAGE, message)

  // ✅ PHASE 1.4: Use smart storage instead of direct IDB
  await smartSaveAttachments(attachmentsFile)
}

export async function clearPendingMessage(): Promise<void> {
  if (typeof window === 'undefined') return
  
  sessionStorage.removeItem(STORAGE_KEYS.PENDING_MESSAGE)
  // ✅ PHASE 1.4: Clear smart storage keys
  sessionStorage.removeItem('pendingAttachmentsSmall')
  sessionStorage.removeItem('hasLargeAttachments')

  // Remove files from IndexedDB
  await clearFilesFromIndexedDB()
}
