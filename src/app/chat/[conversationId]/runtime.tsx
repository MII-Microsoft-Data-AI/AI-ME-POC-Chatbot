"use client";

import {
  AssistantRuntimeProvider,
  AssistantTransportConnectionMetadata,
  unstable_createMessageConverter as createMessageConverter,
  useAssistantTransportRuntime,
} from "@assistant-ui/react";
import {
  convertLangChainMessages,
  LangChainMessage,
} from "@assistant-ui/react-langgraph";

type State = {
  messages: LangChainMessage[];
};

const LangChainMessageConverter = createMessageConverter(
  convertLangChainMessages,
);

// Converter function: transforms agent state to assistant-ui format
const converter = (
  state: State,
  connectionMetadata: AssistantTransportConnectionMetadata,
) => {
  // Add optimistic updates for pending commands
  const optimisticStateMessages = connectionMetadata.pendingCommands.map(
    (c): LangChainMessage[] => {
      if (c.type === "add-message") {
        return [
          {
            type: "human" as const,
            content: [
              {
                type: "text" as const,
                text: c.message.parts
                  .map((p) => (p.type === "text" ? p.text : ""))
                  .join("\n"),
              },
            ],
          },
        ];
      }
      return [];
    },
  );

  const messages = [...state.messages, ...optimisticStateMessages.flat()];

  return {
    messages: LangChainMessageConverter.toThreadMessages(messages),
    isRunning: connectionMetadata.isSending || false,
  };
};

export function MyRuntimeProvider({ children }: { children: React.ReactNode }) {
  const runtime = useAssistantTransportRuntime({
    initialState: {
      messages: [],
    },
    api: "http://localhost:8010/assistant",
    converter,
    headers: async () => ({
      "Authorization": "Bearer token",
    }),
    body: {
      "custom-field": "custom-value",
    },
    onResponse: (response) => {
      console.log("Response received from server");
    },
    onFinish: () => {
      console.log("Conversation completed");
    },
    onError: (error, { commands, updateState }) => {
      console.error("Assistant transport error:", error);
      console.log("Commands in transit:", commands);
    },
    onCancel: ({ commands, updateState }) => {
      console.log("Request cancelled");
      console.log("Commands in transit or queued:", commands);
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}