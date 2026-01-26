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
import { useMemo } from 'react'
import { HttpAgent } from "@ag-ui/client";
import { useAgUiRuntime } from '@assistant-ui/react-ag-ui'

function ConversationPage() {
  const params = useParams()
  const conversationId = params.conversationId as string

  // Mode state management
  const { mode, setMode } = useChatMode()

  // History loading
  const { historyAdapter, isLoadingHistory, error } = useConversationHistory(conversationId)

  // Create runtime with conversation ID
  const agentUrl = `/api/be/conversations-agui/${conversationId}/chat`

  const agent = useMemo(() => {
    return new HttpAgent({
      threadId: conversationId,
      url: agentUrl,
      headers: {
        Accept: "text/event-stream",
      },
    });
  }, [agentUrl]);

  const runtime = useAgUiRuntime({
    agent,
    logger: {
      debug: (...a: unknown[]) => console.debug("[agui]", ...a),
      error: (...a: unknown[]) => console.error("[agui]", ...a),
    },
    adapters: {
      history: historyAdapter
    }
  });

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