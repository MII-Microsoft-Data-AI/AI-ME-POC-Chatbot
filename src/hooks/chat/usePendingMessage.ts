import { useState, useEffect } from 'react'
import { useThreadRuntime } from '@assistant-ui/react'
import type { ChatMode } from '@/types/chat'
import { getPendingMessage, clearPendingMessage } from '@/utils/chat/storage'
import { CONVERSATION_CONSTANTS } from '@/utils/chat/conversation'

interface UsePendingMessageOptions {
  isLoading: boolean
  onModeChange: (mode: ChatMode) => void
}

// Hook untuk auto-send pending message setelah redirect dari new chat
// Wait history load dulu, baru send message (hanya sekali)
export function usePendingMessage({ isLoading, onModeChange }: UsePendingMessageOptions) {
  const threadRuntime = useThreadRuntime()
  const [hasSentPendingMessage, setHasSentPendingMessage] = useState(false)

  async function fetchPendingMessage() {
    if (!threadRuntime) return
    if (isLoading) return // Wait for history to load first
    if (hasSentPendingMessage) return // Only send once

    const pending = await getPendingMessage()

    if (pending) {
      // Clear from sessionStorage
      clearPendingMessage()

      // Set mode if provided
      if (pending.mode) {
        onModeChange(pending.mode)
      }

      
      setTimeout(() => {
        if (pending.attachmentFile.length > 0) {
          for (const file of pending.attachmentFile) {
            threadRuntime.composer.addAttachment(file)
          }
        }

        // Wait a bit for runtime to be fully ready after history load
        // Set the message in composer
        threadRuntime.composer.setText(pending.message)

        // Wait a bit before sending to ensure attachments are processed
        setTimeout(() => {
            // Send it
            threadRuntime.composer.send()
            setHasSentPendingMessage(true)
        },CONVERSATION_CONSTANTS.SEND_DELAY_MS)
      }, CONVERSATION_CONSTANTS.SEND_DELAY_MS)
    }
  }

  useEffect(() => {
    fetchPendingMessage()
  }, [threadRuntime, isLoading, hasSentPendingMessage, onModeChange])

  return {
    hasSentPendingMessage,
  }
}
