"use client";

import { useParams } from "next/navigation";

import { ChatLayout } from "@/components/features/chat/ChatLayout";
import { ConversationContent } from "@/components/features/chat/ConversationContent";
import { CustomLanggraphRuntime } from "@/components/assistant-ui/CustomLanggraphRuntime";

function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;

  if (!conversationId) return null;

  return (
    <ChatLayout>
      <CustomLanggraphRuntime threadId={conversationId}>
        <ConversationContent isLoading={false} />
      </CustomLanggraphRuntime>
    </ChatLayout>
  );
}

export default ConversationPage;
