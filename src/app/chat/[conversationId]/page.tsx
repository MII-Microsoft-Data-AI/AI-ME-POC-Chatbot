"use client";

import { useParams } from "next/navigation";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  ChatWithConversationIDAPIRuntime,
  CompositeAttachmentsAdapter,
} from "@/lib/integration/client/chat-conversation";
import { useConversationHistory } from "@/hooks/chat/useConversationHistory";
import { ConversationContent } from "@/components/features/chat/ConversationContent";
import { ErrorState } from "@/components/features/chat/ErrorState";
import { ChatLayout } from "@/components/features/chat/ChatLayout";
import { GenerateImageUI } from "@/components/assistant-ui/tool-ui/ImageGeneration";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";

function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  // History loading
  const { historyAdapter, isLoadingHistory, error } =
    useConversationHistory(conversationId);

  // // Create runtime with conversation ID
  // const runtime = ChatWithConversationIDAPIRuntime(
  //   conversationId,
  //   historyAdapter,
  // );

  const runtime = useDataStreamRuntime({
    api: `/api/be/conversations/${conversationId}/chat`,
    adapters: {
      history: historyAdapter,
      attachments: CompositeAttachmentsAdapter,
    },
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
              isLoading={isLoadingHistory}
            />
          </>
        )}
      </AssistantRuntimeProvider>
    </ChatLayout>
  );
}

export default ConversationPage;
