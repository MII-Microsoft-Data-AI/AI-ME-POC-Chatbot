"use client";

import { ChatLayout } from "@/components/features/chat/ChatLayout";
import { WelcomeContent } from "@/components/features/chat/WelcomeContent";

function NewChatPage() {
  return (
    <ChatLayout>
      <WelcomeContent />
    </ChatLayout>
  );
}

export default NewChatPage;
