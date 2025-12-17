'use client'

import { AssistantRuntimeProvider, useLocalRuntime } from '@assistant-ui/react'
import { useChatMode } from '@/hooks/chat/useChatMode'
import { NewChatContent } from '@/components/features/chat/NewChatContent'
import { ChatLayout } from '@/components/features/chat/ChatLayout'

function NewChatPage() {
  const { mode, setMode } = useChatMode()

  // Create a minimal local runtime that does nothing
  // We only need this to satisfy the Thread component
  // All actual chat happens after redirect to /chat/[id]
  const runtime = useLocalRuntime({
    async *run() {
      // This will never be called because we override composer.send
      // But we need it to satisfy the type requirements
      return
    },
  })

  return (
    <ChatLayout>
      <AssistantRuntimeProvider runtime={runtime}>
        <NewChatContent mode={mode} onModeChange={setMode} />
      </AssistantRuntimeProvider>
    </ChatLayout>
  )
}

export default NewChatPage