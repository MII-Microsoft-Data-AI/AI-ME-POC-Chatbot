import { useState, useMemo } from 'react'
import type { ThreadHistoryAdapter } from '@assistant-ui/react'
import { LoadConversationHistory } from '@/lib/integration/client/chat-conversation'

// Hook untuk load conversation history dengan error handling
// Returns: historyAdapter (memoized), isLoadingHistory, error
export function useConversationHistory(conversationId: string) {
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Memoize adapter supaya tidak recreate setiap render
  const historyAdapter = useMemo<ThreadHistoryAdapter>(
    () => ({
      async load() {
        try {
          if (!conversationId) {
            return { messages: [] }
          }

          setIsLoadingHistory(true)
          setError(null)

          // Load conversation history dari backend
          const historyData = await LoadConversationHistory(conversationId)

          if (historyData === null) {
            setError('Failed to load conversation history')
            setIsLoadingHistory(false)
            return { messages: [] }
          }

          if (historyData.length === 0) {
            // New conversation - no error, just empty
            setIsLoadingHistory(false)
            return { messages: [] }
          }

          setIsLoadingHistory(false)
          return { messages: historyData }
        } catch (error) {
          console.error('Failed to load conversation history:', error)
          setError('Failed to load conversation history')
          setIsLoadingHistory(false)
          return { messages: [] }
        }
      },

      async append() {
        // Message auto-saved by backend saat streaming selesai
      },
    }),
    [conversationId]
  )

  return {
    historyAdapter,
    isLoadingHistory,
    error,
  }
}
