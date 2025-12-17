'use client'

import { Thread } from '@/components/assistant-ui/thread'
import type { ChatMode } from '@/types/chat'
import { useConversationCreator } from '@/hooks/chat/useConversationCreator'

interface NewChatContentProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
}

export function NewChatContent({ mode, onModeChange }: NewChatContentProps) {
  const { isCreating } = useConversationCreator(mode)

  return <Thread mode={mode} onModeChange={onModeChange} isCreating={isCreating} />
}
