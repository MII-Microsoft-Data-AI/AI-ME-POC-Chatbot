import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useThreadRuntime } from '@assistant-ui/react'
import type { ChatMode } from '@/types/chat'
import { savePendingMessage } from '@/utils/chat/storage'
import { generateConversationId, withTimeout, CONVERSATION_CONSTANTS } from '@/utils/chat/conversation'
import { CreateConversation } from '@/lib/integration/client/chat-conversation'
import { PerformanceLogger } from '@/utils/performance-logger'

// Hook untuk handle conversation creation flow
// ✅ PHASE 1: Optimized redirect pattern with improved storage and timing
export function useConversationCreator(mode: ChatMode) {
  const router = useRouter()
  const threadRuntime = useThreadRuntime()
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (!threadRuntime) return

    const originalSend = threadRuntime.composer.send

    threadRuntime.composer.send = async () => {
      try {
        const perf = new PerformanceLogger('NewChatFlow')

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
        perf.checkpoint('UUID generated')

        console.log('Creating conversation:', conversationId)

        // Create conversation with timeout
        const createdId = await withTimeout(
          CreateConversation(conversationId, message),
          CONVERSATION_CONSTANTS.CREATION_TIMEOUT_MS,
          'Conversation creation timeout (30s)'
        )
        perf.checkpoint('Conversation created via API')

        if (!createdId) {
          throw new Error('Failed to create conversation')
        }

        console.log('Conversation created successfully:', createdId)

        // ✅ Small delay to ensure DB write is committed before redirect
        await new Promise(resolve => setTimeout(resolve, 100))

        // ✅ PHASE 1.4: Use smart storage instead of direct IDB
        await savePendingMessage(message, mode, attachmentFile)
        perf.checkpoint('Message saved to storage')

        // Redirect to conversation page
        router.push(`/chat/${createdId}`)
        perf.finish('NewChatFlow')
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setIsCreating(false)
        
        const errorMessage = error instanceof Error ? error.message : 'Failed to create conversation'
        alert(`${errorMessage}. Please try again.`)
      }
    }

    return () => {
      threadRuntime.composer.send = originalSend
    }
  }, [threadRuntime, router, mode])

  return {
    isCreating,
  }
}
