// Chat types: mode, pending message, conversation result
export type ChatMode = 'chat' | 'image'

export interface PendingMessage {
  message: string
  mode: ChatMode
}

export interface ConversationCreationResult {
  conversationId: string | null
  error?: Error
}
