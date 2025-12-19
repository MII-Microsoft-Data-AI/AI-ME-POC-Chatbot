"use client";

/**
 * Custom LangGraph DataStream Runtime for Assistant UI
 * 
 * Connects to a LangGraph backend API using assistant_stream's DataStreamResponse format.
 * Supports dynamic API paths (e.g., /conversations/{id}/chat) for conversation-scoped chats.
 * 
 * Backend: Uses assistant_stream + append_langgraph_event
 * Frontend: Uses DataStreamDecoder + AssistantMessageAccumulator for parsing
 * 
 * Future extensibility: Interrupt handling, LangGraph commands
 */

import {
  AssistantRuntime,
  ChatModelAdapter,
  ChatModelRunOptions,
  INTERNAL,
  LocalRuntimeOptions,
  ThreadMessage,
  Tool,
  useLocalRuntime,
} from "@assistant-ui/react";
import { z } from "zod";
import { JSONSchema7 } from "json-schema";
import {
  AssistantMessageAccumulator,
  DataStreamDecoder,
  unstable_toolResultStream,
} from "assistant-stream";
import { asAsyncIterableStream } from "assistant-stream/utils";
import { toLanguageModelMessages } from "@assistant-ui/react-data-stream";
import { LangGraphInterruptState } from "@assistant-ui/react-langgraph";

const { splitLocalRuntimeOptions } = INTERNAL;

type HeadersValue = Record<string, string> | Headers;

export type UseLangGraphDataStreamRuntimeOptions = {
  /**
   * API endpoint path. Can be a static string or function that returns dynamic path.
   * Examples:
   * - Static: "/api/be/conversations/conv-123/chat"
   * - Dynamic: `() => \`/api/be/conversations/\${conversationId}/chat\``
   */
  api: string | (() => string);
  onResponse?: (response: Response) => void | Promise<void>;
  onFinish?: (message: ThreadMessage) => void;
  onError?: (error: Error) => void;
  onCancel?: () => void;
  /**
   * Called when LangGraph interrupt state is received from the stream
   * (Future feature - prepared for extensibility)
   */
  onInterrupt?: (interrupt: LangGraphInterruptState) => void;
  credentials?: RequestCredentials;
  headers?: HeadersValue | (() => Promise<HeadersValue>);
  body?: object;
  sendExtraMessageFields?: boolean;
} & LocalRuntimeOptions;

type LangGraphDataStreamRequestOptions = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tools: any;
  system?: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  runConfig?: any;
  unstable_assistantMessageId?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: any;
};

const toAISDKTools = (tools: Record<string, Tool>) => {
  return Object.fromEntries(
    Object.entries(tools).map(([name, tool]) => [
      name,
      {
        ...(tool.description ? { description: tool.description } : undefined),
        parameters: (tool.parameters instanceof z.ZodType
          ? z.toJSONSchema(tool.parameters)
          : tool.parameters) as JSONSchema7,
      },
    ]),
  );
};

const getEnabledTools = (tools: Record<string, Tool>) => {
  return Object.fromEntries(
    Object.entries(tools).filter(
      ([, tool]) => !tool.disabled && tool.type !== "backend",
    ),
  );
};

class CustomLangGraphDataStreamRuntimeAdapter implements ChatModelAdapter {
  constructor(
    private options: Omit<
      UseLangGraphDataStreamRuntimeOptions,
      keyof LocalRuntimeOptions
    >,
  ) {}

  async *run({
    messages,
    runConfig,
    abortSignal,
    context,
    unstable_assistantMessageId,
    unstable_getMessage,
  }: ChatModelRunOptions) {
    const headersValue =
      typeof this.options.headers === "function"
        ? await this.options.headers()
        : this.options.headers;

    abortSignal.addEventListener(
      "abort",
      () => {
        if (!abortSignal.reason?.detach) this.options.onCancel?.();
      },
      { once: true },
    );

    const headers = new Headers(headersValue);
    headers.set("Content-Type", "application/json");

    // Resolve API path - supports both static strings and dynamic functions
    const apiUrl = typeof this.options.api === "function"
      ? this.options.api()
      : this.options.api;

    // Get the last messages
    if (messages.length === 0) {
      throw new Error("No messages to send");
    }
    
    // Send only the last message to the backend
    const lastMessages = [messages[messages.length - 1]];

    const result = await fetch(apiUrl, {
      method: "POST",
      headers,
      credentials: this.options.credentials ?? "same-origin",
      body: JSON.stringify({
        system: context.system,
        messages: toLanguageModelMessages(lastMessages, {
          unstable_includeId: this.options.sendExtraMessageFields,
        }) as LangGraphDataStreamRequestOptions["messages"],
        tools: toAISDKTools(
          getEnabledTools(context.tools ?? {}),
        ) as unknown as LangGraphDataStreamRequestOptions["tools"],
        ...(unstable_assistantMessageId ? { unstable_assistantMessageId } : {}),
        runConfig,
        state: unstable_getMessage().metadata.unstable_state || undefined,
        ...context.callSettings,
        ...context.config,
        ...this.options.body,
      } satisfies LangGraphDataStreamRequestOptions),
      signal: abortSignal,
    });

    await this.options.onResponse?.(result);

    try {
      if (!result.ok) {
        throw new Error(`Status ${result.status}: ${await result.text()}`);
      }
      if (!result.body) {
        throw new Error("Response body is null");
      }

      const stream = result.body
        .pipeThrough(new DataStreamDecoder())
        .pipeThrough(unstable_toolResultStream(context.tools, abortSignal))
        .pipeThrough(new AssistantMessageAccumulator());

      yield* asAsyncIterableStream(stream);

      this.options.onFinish?.(unstable_getMessage());
    } catch (error: unknown) {
      this.options.onError?.(error as Error);
      throw error;
    }
  }
}

/**
 * Custom LangGraph DataStream Runtime Hook
 * 
 * Creates a runtime adapter for connecting to LangGraph backends that use
 * assistant_stream's DataStreamResponse format (DataStream protocol).
 * 
 * Supports dynamic API paths for conversation-scoped endpoints.
 * 
 * @param options Configuration options including dynamic api path
 * @returns AssistantRuntime for use with assistant-ui
 */
export const useCustomLangGraphDataStreamRuntime = (
  options: UseLangGraphDataStreamRuntimeOptions,
): AssistantRuntime => {
  const { localRuntimeOptions, otherOptions } =
    splitLocalRuntimeOptions(options);

  return useLocalRuntime(
    new CustomLangGraphDataStreamRuntimeAdapter(otherOptions),
    localRuntimeOptions,
  );
};
