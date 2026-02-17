"use client";

import { Thread } from "@/components/assistant-ui/thread";
import { usePendingMessage } from "@/hooks/chat/usePendingMessage";

interface ConversationContentProps {
  isLoading: boolean;
}

export function ConversationContent({
  isLoading,
}: ConversationContentProps) {
  // Handle pending message from new chat redirect
  usePendingMessage({ isLoading });

  return <Thread isLoading={isLoading} />;
}
