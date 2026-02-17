"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AuiProvider,
  CompositeAttachmentAdapter,
  Tools,
  useLocalRuntime,
  AssistantRuntimeProvider,
  useAui,
  type ChatModelAdapter,
  type ChatModelRunOptions,
  type ChatModelRunResult,
  type ThreadAssistantMessagePart,
  type ThreadMessage,
  useAuiEvent,
} from "@assistant-ui/react";

import type { ReadonlyJSONObject } from "assistant-stream/utils";

import { appToolkit } from "@/components/assistant-ui/toolkit";
import { VisionImageAdapter } from "@/utils/chat/attachment-adapter";

const API_BASE = "/api/be";

const CHAT_STREAM_URL = `${API_BASE}/api/v1/chat/stream`;
const CHAT_FEEDBACK_URL = `${API_BASE}/api/v1/chat/feedback`;
const CHAT_INTERRUPT_URL = `${API_BASE}/api/v1/chat/interrupt`;

const threadRepoUrl = (threadId: string) =>
  `${API_BASE}/api/v1/threads/${encodeURIComponent(threadId)}/repo`;

interface InterruptPayload {
  type: string;
  tool_calls: Array<{
    id: string;
    name: string;
    arguments: ReadonlyJSONObject;
  }>;
}

interface HitlContextValue {
  pendingInterrupt: InterruptPayload | null;
  decisions: Record<string, "approved" | "rejected">;
  setDecision: (id: string, decision: "approved" | "rejected") => void;
  argsDraftTextById: Record<string, string>;
  setArgsDraftText: (id: string, jsonText: string) => void;
  resetArgsDraftText: (id: string) => void;
  argsDraftErrorById: Record<string, string | null>;
  argsDisplayTextById: Record<string, string>;
  allDecided: boolean;
  allApprovedArgsValid: boolean;
  submitDecisions: () => void;
  toolResults: Record<string, { result: unknown; isError?: boolean }>;
  threadId: string;
  resetInterrupt: () => void;
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseJsonObject(text: string): {
  value: ReadonlyJSONObject | null;
  error: string | null;
} {
  const trimmed = text.trim();
  if (!trimmed) return { value: {} as ReadonlyJSONObject, error: null };
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { value: null, error: "Arguments must be a JSON object." };
    }
    return { value: parsed as ReadonlyJSONObject, error: null };
  } catch {
    return { value: null, error: "Invalid JSON." };
  }
}

const HitlContext = createContext<HitlContextValue | null>(null);

export function useHitl() {
  const ctx = useContext(HitlContext);
  if (!ctx)
    throw new Error("useHitl must be used within CustomLanggraphRuntime");
  return ctx;
}

interface SseEvent {
  type: string;
  phase?: string;
  thread_id?: string;
  checkpoint_id?: string | null;
  content?: string;
  id?: string;
  tool_call_id?: string;
  name?: string;
  arguments?: ReadonlyJSONObject;
  payload?: InterruptPayload;
  error?: string;
  is_error?: boolean;
}

async function fetchInterruptStatus(opts: {
  threadId: string;
  checkpointId: string | null;
}): Promise<
  | {
      interrupted: true;
      checkpoint_id?: string | null;
      payload: InterruptPayload;
    }
  | {
      interrupted: false;
      checkpoint_id?: string | null;
    }
  | null
> {
  try {
    const url = new URL(
      CHAT_INTERRUPT_URL,
      typeof window === "undefined" ? "http://localhost" : window.location.origin,
    );
    url.searchParams.set("thread_id", opts.threadId);
    if (opts.checkpointId) url.searchParams.set("checkpoint_id", opts.checkpointId);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as any;
    if (!data || typeof data !== "object") return null;
    if (data.interrupted === true && data.payload) {
      return {
        interrupted: true,
        checkpoint_id: data.checkpoint_id ?? null,
        payload: data.payload as InterruptPayload,
      };
    }
    if (data.interrupted === false) {
      return { interrupted: false, checkpoint_id: data.checkpoint_id ?? null };
    }
    return null;
  } catch {
    return null;
  }
}

async function* parseSseStream(
  response: Response,
  {
    onInterrupt,
    onToolResult,
    onMeta,
  }: {
    onInterrupt: (payload: InterruptPayload) => void;
    onToolResult: (
      toolCallId: string,
      result: unknown,
      isError?: boolean,
    ) => void;
    onMeta: (meta: {
      phase: string;
      threadId?: string;
      checkpointId?: string | null;
    }) => void;
  },
): AsyncGenerator<ChatModelRunResult> {
  if (!response.body) {
    throw new Error("Response body is null");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";

  const parts: ThreadAssistantMessagePart[] = [];
  const toolPartIndexById = new Map<string, number>();

  const appendToken = (token: string) => {
    const lastIdx = parts.length - 1;
    const last = parts[lastIdx];
    if (last && last.type === ("text" as const)) {
      parts[lastIdx] = { type: "text" as const, text: last.text + token };
      return;
    }
    parts.push({ type: "text" as const, text: token });
  };

  const upsertToolCallPart = (opts: {
    id: string;
    name: string;
    args: ReadonlyJSONObject;
  }) => {
    const existingIndex = toolPartIndexById.get(opts.id);
    const nextPart: ThreadAssistantMessagePart = {
      type: "tool-call" as const,
      toolCallId: opts.id,
      toolName: opts.name,
      args: opts.args,
      argsText: JSON.stringify(opts.args, null, 2),
    };

    if (existingIndex !== undefined) {
      const existing = parts[existingIndex];
      if (existing && existing.type === ("tool-call" as const)) {
        parts[existingIndex] = {
          ...existing,
          toolName: opts.name,
          args: opts.args,
          argsText: JSON.stringify(opts.args, null, 2),
        };
        return;
      }
    }

    parts.push(nextPart);
    toolPartIndexById.set(opts.id, parts.length - 1);
  };

  const updateToolResult = (opts: {
    id: string;
    result: unknown;
    isError: boolean;
  }) => {
    const existingIndex = toolPartIndexById.get(opts.id);
    if (existingIndex === undefined) return;
    const existing = parts[existingIndex];
    if (!existing || existing.type !== ("tool-call" as const)) return;
    parts[existingIndex] = {
      ...existing,
      result: opts.result,
      isError: opts.isError,
    };
  };

  const snapshot = (status?: ChatModelRunResult["status"]) => {
    if (status) return { content: parts.slice(), status };
    return { content: parts.slice() };
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const dataStr = line.slice(6).trim();
        if (!dataStr || dataStr === "[DONE]") continue;

        let evt: SseEvent;
        try {
          evt = JSON.parse(dataStr);
        } catch {
          continue;
        }

        if (evt.type === "token" && evt.content) {
          appendToken(evt.content);
        } else if (evt.type === "meta" && evt.phase) {
          onMeta({
            phase: evt.phase,
            threadId: evt.thread_id,
            checkpointId: evt.checkpoint_id,
          });
          continue;
        } else if (evt.type === "tool_call" && evt.id && evt.name) {
          const args = evt.arguments ?? ({} as ReadonlyJSONObject);
          upsertToolCallPart({ id: evt.id, name: evt.name, args });
        } else if (evt.type === "tool_result") {
          const toolCallId = evt.tool_call_id ?? evt.id;
          if (toolCallId) {
            const result = evt.content ?? null;
            const isError = evt.is_error ?? false;
            updateToolResult({ id: toolCallId, result, isError });
            onToolResult(toolCallId, result, isError);
          }
        } else if (evt.type === "interrupt" && evt.payload) {
          onInterrupt(evt.payload);

          for (const tc of evt.payload.tool_calls) {
            if (!toolPartIndexById.has(tc.id)) {
              const args = tc.arguments ?? ({} as ReadonlyJSONObject);
              upsertToolCallPart({ id: tc.id, name: tc.name, args });
            }
          }

          if (parts.length > 0) {
            yield snapshot({
              type: "requires-action" as const,
              reason: "interrupt" as const,
            });
          } else {
            yield {
              content: [],
              status: {
                type: "requires-action" as const,
                reason: "interrupt" as const,
              },
            };
          }
          return;
        } else if (evt.type === "error") {
          if (parts.length === 0) {
            parts.push({
              type: "text" as const,
              text: `Error: ${evt.error ?? "Unknown error"}`,
            });
          } else {
            parts.push({
              type: "text" as const,
              text: `\nError: ${evt.error ?? "Unknown error"}`,
            });
          }

          if (parts.length > 0) {
            yield snapshot({ type: "incomplete" as const, reason: "error" as const });
          } else {
            yield {
              content: [],
              status: { type: "incomplete" as const, reason: "error" as const },
            };
          }
          return;
        } else if (evt.type === "done") {
          continue;
        }

        if (parts.length > 0) {
          yield snapshot();
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export function CustomLanggraphRuntime({
  children,
  threadId,
}: {
  children: ReactNode;
  threadId: string;
}) {
  const [pendingInterrupt, setPendingInterrupt] =
    useState<InterruptPayload | null>(null);
  const pendingInterruptMessageIdRef = useRef<string | null>(null);
  const [decisions, setDecisions] = useState<
    Record<string, "approved" | "rejected">
  >({});

  const [argsDraftTextById, setArgsDraftTextById] = useState<
    Record<string, string>
  >({});
  const [argsDraftErrorById, setArgsDraftErrorById] = useState<
    Record<string, string | null>
  >({});
  const [argsDisplayTextById, setArgsDisplayTextById] = useState<
    Record<string, string>
  >({});

  const [toolResults, setToolResults] = useState<
    Record<string, { result: unknown; isError?: boolean }>
  >({});

  const threadIdRef = useRef<string>(threadId);

  useEffect(() => {
    threadIdRef.current = threadId;
  }, [threadId]);

  const lgCheckpointByMessageIdRef = useRef<Record<string, string>>({});
  const lastRunCheckpointIdRef = useRef<string | null>(null);

  const getCheckpointFromMessage = useCallback((message: ThreadMessage) => {
    const custom = (message.metadata?.custom ?? {}) as Record<string, unknown>;
    const lg = custom.lg as
      | {
          checkpoint_id?: unknown;
        }
      | undefined;
    const cp = lg?.checkpoint_id;
    return typeof cp === "string" && cp ? cp : null;
  }, []);

  const rebuildCheckpointIndex = useCallback(() => {
    const rt = runtimeRef.current;
    if (!rt) return;
    try {
      const repo = rt.thread.export();
      const next: Record<string, string> = {};
      for (const item of repo.messages) {
        const cp = getCheckpointFromMessage(item.message);
        if (cp) next[item.message.id] = cp;
      }
      lgCheckpointByMessageIdRef.current = next;
    } catch {
      // ignore
    }
  }, [getCheckpointFromMessage]);

  const getCheckpointForParentId = useCallback(
    (
      parentId: string | null,
      fallbackMessages?: readonly ThreadMessage[],
    ): string | null => {
      const rt = runtimeRef.current;
      if (parentId && rt) {
        let current: string | null = parentId;
        for (let depth = 0; depth < 4 && current; depth++) {
          const direct = lgCheckpointByMessageIdRef.current[current];
          if (direct) return direct;

          const state = rt.thread.getMessageById(current).getState();
          const fromMeta = getCheckpointFromMessage(state as unknown as ThreadMessage);
          if (fromMeta) {
            lgCheckpointByMessageIdRef.current[current] = fromMeta;
            return fromMeta;
          }
          current = state.parentId;
        }
      }

      if (fallbackMessages && fallbackMessages.length > 0) {
        for (let i = fallbackMessages.length - 1; i >= 0; i--) {
          const m = fallbackMessages[i];
          if (m.role !== "assistant") continue;
          const fromMeta = getCheckpointFromMessage(m);
          if (fromMeta) return fromMeta;
        }
      }

      return null;
    },
    [getCheckpointFromMessage],
  );

  const failIfMissingCheckpoint = useCallback(
    (
      computed: string | null,
      opts: {
        parentId: string | null;
        messages: readonly ThreadMessage[];
        context: string;
      },
    ) => {
      if (computed) return null;
      const hasAnyAssistant = opts.messages.some((m) => m.role === "assistant");
      if (!hasAnyAssistant) return null;
      if (!opts.parentId) {
        return `Missing LangGraph checkpoint for ${opts.context} (no parentId provided).`;
      }
      return `Missing LangGraph checkpoint for ${opts.context} (parentId=${opts.parentId}).`;
    },
    [],
  );

  const pendingFeedbackRef = useRef<
    | {
        type: "tool_approval";
        decisions: Array<
          | { id: string; decision: "approved"; arguments: ReadonlyJSONObject }
          | { id: string; decision: "rejected" }
        >;
      }
    | null
  >(null);

  const runtimeRef = useRef<ReturnType<typeof useLocalRuntime> | null>(null);

  const sendFeedback = useCallback(
    (
      approvalData: NonNullable<(typeof pendingFeedbackRef)["current"]>,
    ) => {
      pendingFeedbackRef.current = approvalData;
      setPendingInterrupt(null);
      setDecisions({});
      setArgsDraftTextById({});
      setArgsDraftErrorById({});

      const parentId = pendingInterruptMessageIdRef.current;
      pendingInterruptMessageIdRef.current = null;
      if (runtimeRef.current && parentId) {
        runtimeRef.current.thread.startRun({ parentId });
      }
    },
    [],
  );

  const resetInterrupt = useCallback(() => {
    setPendingInterrupt(null);
    pendingInterruptMessageIdRef.current = null;
    setDecisions({});
    setArgsDraftTextById({});
    setArgsDraftErrorById({});
  }, []);

  const pendingToolCalls = pendingInterrupt?.tool_calls ?? [];

  useEffect(() => {
    if (!pendingInterrupt) return;
    setArgsDraftTextById((prev) => {
      const next = { ...prev };
      for (const tc of pendingInterrupt.tool_calls) {
        if (!(tc.id in next)) {
          next[tc.id] = prettyJson(tc.arguments ?? {});
        }
      }
      return next;
    });

    setArgsDisplayTextById((prev) => {
      const next = { ...prev };
      for (const tc of pendingInterrupt.tool_calls) {
        if (!(tc.id in next)) {
          next[tc.id] = prettyJson(tc.arguments ?? {});
        }
      }
      return next;
    });
  }, [pendingInterrupt]);

  const allDecided = useMemo(() => {
    if (pendingToolCalls.length === 0) return false;
    return pendingToolCalls.every((tc) => tc.id in decisions);
  }, [pendingToolCalls, decisions]);

  const allApprovedArgsValid = useMemo(() => {
    if (pendingToolCalls.length === 0) return false;
    const anyApproved = pendingToolCalls.some((tc) => decisions[tc.id] === "approved");
    if (!anyApproved) return true;
    for (const tc of pendingToolCalls) {
      if (decisions[tc.id] !== "approved") continue;
      const draft =
        argsDraftTextById[tc.id] ?? prettyJson(tc.arguments ?? ({} as unknown));
      const parsed = parseJsonObject(draft);
      if (parsed.error || !parsed.value) return false;
    }
    return true;
  }, [pendingToolCalls, decisions, argsDraftTextById, pendingInterrupt]);

  const submitDecisions = useCallback(() => {
    if (!pendingInterrupt) return;
    if (!allDecided) return;

    const nextErrors: Record<string, string | null> = {};
    const payload: NonNullable<(typeof pendingFeedbackRef)["current"]> = {
      type: "tool_approval",
      decisions: [],
    };

    for (const tc of pendingToolCalls) {
      const decision = decisions[tc.id];
      if (decision === "rejected") {
        payload.decisions.push({ id: tc.id, decision: "rejected" });
        continue;
      }

      if (decision !== "approved") {
        payload.decisions.push({ id: tc.id, decision: "rejected" });
        continue;
      }

      const draft = argsDraftTextById[tc.id] ?? prettyJson(tc.arguments ?? {});
      const parsed = parseJsonObject(draft);
      nextErrors[tc.id] = parsed.error;
      if (parsed.error || !parsed.value) {
        setArgsDraftErrorById((prev) => ({ ...prev, ...nextErrors }));
        return;
      }
      payload.decisions.push({
        id: tc.id,
        decision: "approved",
        arguments: parsed.value,
      });
    }

    setArgsDisplayTextById((prev) => {
      const next = { ...prev };
      for (const tc of pendingToolCalls) {
        const draft = argsDraftTextById[tc.id];
        if (typeof draft === "string") {
          next[tc.id] = draft;
        }
      }
      return next;
    });

    setArgsDraftErrorById((prev) => ({ ...prev, ...nextErrors }));
    sendFeedback(payload);
  }, [
    pendingInterrupt,
    allDecided,
    pendingToolCalls,
    decisions,
    argsDraftTextById,
    sendFeedback,
  ]);

  useEffect(() => {
    setDecisions({});
  }, [pendingInterrupt]);

  const adapterRef = useRef<ChatModelAdapter | null>(null);
  if (!adapterRef.current) {
    adapterRef.current = {
      async *run({
        messages,
        abortSignal,
        unstable_assistantMessageId,
        unstable_parentId,
      }: ChatModelRunOptions): AsyncGenerator<ChatModelRunResult> {
        const threadIdValue = threadIdRef.current;
        const feedback = pendingFeedbackRef.current;
        pendingFeedbackRef.current = null;

        let url: string;
        let body: string;

        if (feedback) {
          url = CHAT_FEEDBACK_URL;

          const checkpointId = getCheckpointForParentId(
            unstable_parentId ?? null,
            messages,
          );
          if (!checkpointId) {
            yield {
              content: [
                {
                  type: "text" as const,
                  text: "Backend error: missing checkpoint_id for feedback resume.",
                },
              ],
              status: { type: "incomplete" as const, reason: "error" as const },
            };
            return;
          }

          body = JSON.stringify({
            thread_id: threadIdValue,
            checkpoint_id: checkpointId,
            approval_data: feedback,
          });
        } else {
          const last = messages[messages.length - 1];
          const text = last
            ? last.content
                .filter(
                  (c): c is { type: "text"; text: string } => c.type === "text",
                )
                .map((c) => c.text)
                .join("")
            : "";

          const hasAttachments =
            last?.role === "user" &&
            (last?.content ?? []).some((c) => c.type !== "text");

          const deltaMessage = last && last.role === "user" ? text : "";

          const checkpointId = getCheckpointForParentId(
            unstable_parentId ?? null,
            messages,
          );
          const missingCheckpointError = failIfMissingCheckpoint(checkpointId, {
            parentId: unstable_parentId ?? null,
            messages,
            context: "run",
          });
          if (missingCheckpointError) {
            yield {
              content: [
                {
                  type: "text" as const,
                  text: `Backend error: ${missingCheckpointError}`,
                },
              ],
              status: { type: "incomplete" as const, reason: "error" as const },
            };
            return;
          }

          url = CHAT_STREAM_URL;
          body = JSON.stringify({
            thread_id: threadIdValue,
            checkpoint_id: checkpointId,
            message:
              last && last.role === "user"
                ? {
                    role: "human",
                    content: hasAttachments ? last.content : deltaMessage,
                  }
                : null,
          });
        }

        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: abortSignal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "Unknown error");
          yield {
            content: [
              {
                type: "text" as const,
                text: `Backend error (${response.status}): ${errorText}`,
              },
            ],
            status: { type: "incomplete" as const, reason: "error" as const },
          };
          return;
        }

        let completedCheckpointId: string | null = null;
        yield* parseSseStream(response, {
          onInterrupt: (payload) => {
            pendingInterruptMessageIdRef.current =
              unstable_assistantMessageId ?? null;
            setPendingInterrupt(payload);
          },
          onToolResult: (toolCallId, result, isError) => {
            setToolResults((prev) => {
              if (prev[toolCallId]) return prev;
              return { ...prev, [toolCallId]: { result, isError } };
            });
          },
          onMeta: ({ phase, checkpointId }) => {
            if (phase === "complete" || phase === "interrupt") {
              if (typeof checkpointId === "string" && checkpointId) {
                completedCheckpointId = checkpointId;
                lastRunCheckpointIdRef.current = checkpointId;
              }
            }
          },
        });

        if (
          unstable_assistantMessageId &&
          completedCheckpointId &&
          typeof completedCheckpointId === "string"
        ) {
          lgCheckpointByMessageIdRef.current[unstable_assistantMessageId] =
            completedCheckpointId;
          yield {
            metadata: {
              custom: {
                lg: {
                  thread_id: threadIdValue,
                  checkpoint_id: completedCheckpointId,
                },
              },
            },
          };
        }

        rebuildCheckpointIndex();
      },
    };
  }

  const attachmentsAdapter = useMemo(
    () => new CompositeAttachmentAdapter([new VisionImageAdapter()]),
    [],
  );

  const runtime = useLocalRuntime(adapterRef.current, {
    adapters: {
      attachments: attachmentsAdapter,
    },
  });
  runtimeRef.current = runtime;

  const rehydrateInterruptForBranchHead = useCallback(async () => {
    const rt = runtimeRef.current;
    if (!rt) return;
    const threadIdValue = threadIdRef.current;
    const { messages } = rt.thread.getState();
    let lastAssistant: ThreadMessage | null = null;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === "assistant") {
        lastAssistant = messages[i] ?? null;
        break;
      }
    }
    if (!lastAssistant) {
      setPendingInterrupt(null);
      pendingInterruptMessageIdRef.current = null;
      return;
    }

    const checkpointId =
      getCheckpointFromMessage(lastAssistant) ??
      lgCheckpointByMessageIdRef.current[lastAssistant.id] ??
      null;

    const status = await fetchInterruptStatus({ threadId: threadIdValue, checkpointId });
    if (!status) return;

    if (status.interrupted) {
      pendingInterruptMessageIdRef.current = lastAssistant.id;
      setPendingInterrupt(status.payload);
    } else {
      setPendingInterrupt(null);
      pendingInterruptMessageIdRef.current = null;
    }
  }, [getCheckpointFromMessage]);

  useEffect(() => {
    let cancelled = false;
    const threadIdValue = threadIdRef.current;
    (async () => {
      try {
        const res = await fetch(threadRepoUrl(threadIdValue), {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { repo: unknown };
        if (cancelled) return;
        if (data && typeof data === "object" && (data as any).repo) {
          runtime.thread.import((data as any).repo);
          rebuildCheckpointIndex();
          if (!cancelled) {
            await rehydrateInterruptForBranchHead();
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runtime.thread, rebuildCheckpointIndex, rehydrateInterruptForBranchHead]);

  useEffect(() => {
    let timeout: number | null = null;
    let lastHeadId: string | null = null;
    const unsub = runtime.thread.subscribe(() => {
      const { messages } = runtime.thread.getState();
      let head: ThreadMessage | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i]?.role === "assistant") {
          head = messages[i] ?? null;
          break;
        }
      }
      const headId = head?.id ?? null;
      if (headId === lastHeadId) return;
      lastHeadId = headId;

      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        rehydrateInterruptForBranchHead();
      }, 300);
    });
    return () => {
      if (timeout) window.clearTimeout(timeout);
      unsub();
    };
  }, [runtime.thread, rehydrateInterruptForBranchHead]);

  useEffect(() => {
    const threadIdValue = threadIdRef.current;
    let timeout: number | null = null;
    const unsub = runtime.thread.subscribe(() => {
      if (typeof window === "undefined") return;
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        const repo = runtime.thread.export();
        fetch(threadRepoUrl(threadIdValue), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo }),
        }).catch(() => undefined);
      }, 500);
    });
    return () => {
      if (timeout) window.clearTimeout(timeout);
      unsub();
    };
  }, [runtime.thread]);

  return (
    <HitlContext.Provider
      value={{
        pendingInterrupt,
        decisions,
        setDecision: (id, decision) => {
          setDecisions((prev) => ({ ...prev, [id]: decision }));
        },
        argsDraftTextById,
        setArgsDraftText: (id, jsonText) => {
          setArgsDraftTextById((prev) => ({ ...prev, [id]: jsonText }));
          const parsed = parseJsonObject(jsonText);
          setArgsDraftErrorById((prev) => ({ ...prev, [id]: parsed.error }));
          setArgsDisplayTextById((prev) => ({ ...prev, [id]: jsonText }));
        },
        resetArgsDraftText: (id) => {
          if (!pendingInterrupt) return;
          const tc = pendingInterrupt.tool_calls.find((x) => x.id === id);
          if (!tc) return;
          const text = prettyJson(tc.arguments ?? {});
          setArgsDraftTextById((prev) => ({ ...prev, [id]: text }));
          setArgsDraftErrorById((prev) => ({ ...prev, [id]: null }));
          setArgsDisplayTextById((prev) => ({ ...prev, [id]: text }));
        },
        argsDraftErrorById,
        allDecided,
        allApprovedArgsValid,
        submitDecisions,
        toolResults,
        argsDisplayTextById,
        threadId: threadIdRef.current,
        resetInterrupt,
      }}
    >
      <AssistantRuntimeProvider runtime={runtime}>
        <ToolRegistryProvider>
          <HitlComposerListener onSend={resetInterrupt} />
          {children}
        </ToolRegistryProvider>
      </AssistantRuntimeProvider>
    </HitlContext.Provider>
  );
}

function ToolRegistryProvider({ children }: { children: ReactNode }) {
  const aui = useAui({ tools: Tools({ toolkit: appToolkit }) });
  return <AuiProvider value={aui}>{children}</AuiProvider>;
}

function HitlComposerListener({ onSend }: { onSend: () => void }) {
  useAuiEvent("composer.send", () => {
    onSend();
  });
  return null;
}
