import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useThreadRuntime } from '@assistant-ui/react'
import type { ChatMode } from '@/types/chat'
import { CreateConversation } from '@/lib/integration/client/chat-conversation'
import { savePendingMessage } from '@/utils/chat/storage'
import {
  generateConversationId,
  withTimeout,
  CONVERSATION_CONSTANTS,
} from '@/utils/chat/conversation'

// Utility function to convert File to base64
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Hook untuk handle conversation creation flow
// Override composer.send untuk create conversation dulu sebelum redirect
// Flow: generate ID -> create conversation (30s timeout) -> save message -> redirect
export function useConversationCreator(mode: ChatMode) {
  const router = useRouter()
  const threadRuntime = useThreadRuntime()
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!threadRuntime) return

    // Store original send function
    const originalSend = threadRuntime.composer.send

    // Override send function to create conversation first
    threadRuntime.composer.send = async () => {
      try {
        // Get the message from composer
        const composerState = threadRuntime.composer.getState()
        const message = composerState.text
        const attachmentFile: File[] = [] 

        for (const attachment of composerState.attachments) {
          if (attachment.file) {
            attachmentFile.push(attachment.file)
          }
        }

        if (!message.trim()) return

        setIsCreating(true)

        // Generate ID client-side
        const conversationId = generateConversationId()

        console.log('Creating conversation:', conversationId)

        // Create conversation with timeout
        const createdId = await withTimeout(
          CreateConversation(conversationId, message),
          CONVERSATION_CONSTANTS.CREATION_TIMEOUT_MS,
          'Conversation creation timeout (30s)'
        )

        if (!createdId) {
          throw new Error('Failed to create conversation')
        }

        console.log('Conversation created successfully:', createdId)

        // Store message in sessionStorage to send after redirect
        savePendingMessage(message, mode, attachmentFile)

        // Redirect to conversation page
        router.push(`/chat/${createdId}`)
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setIsCreating(false)
        
        // Show error to user
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create conversation'
        alert(`${errorMessage}. Please try again.`)
      }
    }

    // Cleanup: restore original send function
    return () => {
      threadRuntime.composer.send = originalSend
    }
  }, [threadRuntime, router, mode])

  return {
    isCreating,
  }
}
