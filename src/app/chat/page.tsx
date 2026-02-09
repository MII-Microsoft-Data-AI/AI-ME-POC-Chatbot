'use client'

import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { NewChatContent } from '@/components/features/chat/NewChatContent'
import { ChatLayout } from '@/components/features/chat/ChatLayout'
import { FirstChatAPIRuntime } from '@/lib/integration/client/chat-conversation'

function NewChatPage() {
  const runtime = FirstChatAPIRuntime()

  return (
    <ChatLayout>
      <AssistantRuntimeProvider runtime={runtime}>
        <NewChatContent />
      </AssistantRuntimeProvider>
    </ChatLayout>
  )
}

export default NewChatPage