'use client'

import { Thread } from '@/components/assistant-ui/thread'
import type { ChatMode } from '@/types/chat'
import { usePendingMessage } from '@/hooks/chat/usePendingMessage'

interface ConversationContentProps {
  mode: ChatMode
  onModeChange: (mode: ChatMode) => void
  isLoading: boolean
}

export function ConversationContent({
  mode,
  onModeChange,
  isLoading,
}: ConversationContentProps) {
  // Handle pending message from new chat redirect
  usePendingMessage({ isLoading, onModeChange })

  return <Thread isLoading={isLoading} mode={mode} onModeChange={onModeChange} />
}
