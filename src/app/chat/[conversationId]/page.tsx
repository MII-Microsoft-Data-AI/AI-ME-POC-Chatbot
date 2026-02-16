"use client";

import { useParams, useSearchParams } from "next/navigation";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  CompositeAttachmentsAdapter,
} from "@/lib/integration/client/chat-conversation";
import { useConversationHistory } from "@/hooks/chat/useConversationHistory";
import { ConversationContent } from "@/components/features/chat/ConversationContent";
import { ErrorState } from "@/components/features/chat/ErrorState";
import { ChatLayout } from "@/components/features/chat/ChatLayout";
import { GenerateImageUI } from "@/components/assistant-ui/tool-ui/ImageGeneration";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";
import { CustomLanggraphRuntimeProvider } from "@/components/assistant-ui/CustomLanggraphRuntime";

function ConversationPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const conversationId = params.conversationId as string;

  const useSse = searchParams.get("runtime") === "sse";

  // History loading
  const { historyAdapter, isLoadingHistory, error } = useConversationHistory(
    conversationId,
    { enabled: !useSse },
  );

  const legacyRuntime = useDataStreamRuntime({
    api: `/api/be/conversations/${conversationId}/chat`,
    adapters: {
      history: historyAdapter,
      attachments: CompositeAttachmentsAdapter,
    },
  });

  return (
    <ChatLayout>
      {useSse ? (
        <CustomLanggraphRuntimeProvider threadId={conversationId}>
          {error ? (
            <ErrorState error={error} onRetry={() => window.location.reload()} />
          ) : (
            <>
              <GenerateImageUI />
              <ConversationContent isLoading={isLoadingHistory} />
            </>
          )}
        </CustomLanggraphRuntimeProvider>
      ) : (
        <AssistantRuntimeProvider runtime={legacyRuntime}>
          {error ? (
            <ErrorState error={error} onRetry={() => window.location.reload()} />
          ) : (
            <>
              <GenerateImageUI />
              <ConversationContent isLoading={isLoadingHistory} />
            </>
          )}
        </AssistantRuntimeProvider>
      )}
    </ChatLayout>
  );
}

export default ConversationPage;
