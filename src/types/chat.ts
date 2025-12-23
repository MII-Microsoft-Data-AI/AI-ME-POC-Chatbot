// Chat types: mode, pending message, conversation result
export type ChatMode = 'chat' | 'image'

export interface PendingMessage {
  message: string
  mode: ChatMode
  attachmentFile: File[]
}

export interface ConversationCreationResult {
  conversationId: string | null
  error?: Error
}
