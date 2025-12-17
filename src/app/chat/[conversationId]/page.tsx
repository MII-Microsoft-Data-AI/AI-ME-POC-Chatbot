'use client'

import { useParams } from 'next/navigation'
import { AssistantRuntimeProvider } from '@assistant-ui/react'
import { ChatWithConversationIDAPIRuntime } from '@/lib/integration/client/chat-conversation'
import { useChatMode } from '@/hooks/chat/useChatMode'
import { useConversationHistory } from '@/hooks/chat/useConversationHistory'
import { ConversationContent } from '@/components/features/chat/ConversationContent'
import { ErrorState } from '@/components/features/chat/ErrorState'
import { ChatLayout } from '@/components/features/chat/ChatLayout'
import { GenerateImageUI } from '@/components/assistant-ui/tool-ui/ImageGeneration'

function ConversationPage() {
  const params = useParams()
  const conversationId = params.conversationId as string

  // Mode state management
  const { mode, setMode } = useChatMode()

  // History loading
  const { historyAdapter, isLoadingHistory, error } = useConversationHistory(conversationId)

  // Create runtime with conversation ID
  const runtime = ChatWithConversationIDAPIRuntime(conversationId, historyAdapter, mode)

  return (
    <ChatLayout>
      <AssistantRuntimeProvider runtime={runtime}>
        {error ? (
          <ErrorState error={error} onRetry={() => window.location.reload()} />
        ) : (
          <>
            <GenerateImageUI />
            <ConversationContent
              mode={mode}
              onModeChange={setMode}
              isLoading={isLoadingHistory}
              />
          </>
        )}
      </AssistantRuntimeProvider>
    </ChatLayout>
  )
}

export default ConversationPage