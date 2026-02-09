'use client'

import { Thread } from '@/components/assistant-ui/thread'
import { useConversationCreator } from '@/hooks/chat/useConversationCreator'

export function NewChatContent() {
  const { isCreating } = useConversationCreator()

  return <Thread isCreating={isCreating} />
}
