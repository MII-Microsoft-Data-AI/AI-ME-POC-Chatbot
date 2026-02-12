// Chat types: pending message, conversation result
export interface PendingMessage {
  message: string
  attachmentFile: File[]
}

export interface ConversationCreationResult {
  conversationId: string | null
  error?: Error
}
