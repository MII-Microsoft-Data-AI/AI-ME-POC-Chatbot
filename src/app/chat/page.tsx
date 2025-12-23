'use client'

import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { useChatMode } from '@/hooks/chat/useChatMode'
import { NewChatContent } from '@/components/features/chat/NewChatContent'
import { ChatLayout } from '@/components/features/chat/ChatLayout'
import { FirstChatAPIRuntime } from '@/lib/integration/client/chat-conversation'

function NewChatPage() {
  const { mode, setMode } = useChatMode()

  const runtime = FirstChatAPIRuntime(mode)

  return (
    <ChatLayout>
      <AssistantRuntimeProvider runtime={runtime}>
        <NewChatContent mode={mode} onModeChange={setMode} />
      </AssistantRuntimeProvider>
    </ChatLayout>
  )
}

export default NewChatPage