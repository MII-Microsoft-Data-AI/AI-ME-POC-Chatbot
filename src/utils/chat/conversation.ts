// Conversation utilities: ID generation, timeout handling, constants
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

export const CONVERSATION_CONSTANTS = {
  CREATION_TIMEOUT_MS: 30000, // 30 seconds
  SEND_DELAY_MS: 300, // Delay before sending pending message
} as const
