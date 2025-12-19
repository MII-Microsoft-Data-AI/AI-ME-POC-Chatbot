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
import { useLangGraphRuntime } from '@assistant-ui/react-langgraph'
import { MyRuntimeProvider } from './runtime'

function ConversationPage() {
  const params = useParams()
  const conversationId = params.conversationId as string

  // Mode state management
  const { mode, setMode } = useChatMode()

  // History loading
  const { historyAdapter, isLoadingHistory, error } = useConversationHistory(conversationId)
  
  return (
    <ChatLayout>
        <MyRuntimeProvider>
        {/* {error ? (
          <ErrorState error={error} onRetry={() => window.location.reload()} />
        ) : (
        )} */}
          <>
            <GenerateImageUI />
            <ConversationContent
              mode={'chat'}
              onModeChange={setMode}
              isLoading={false}
              />
          </>
        </MyRuntimeProvider>
    </ChatLayout>
  )
}

export default ConversationPage