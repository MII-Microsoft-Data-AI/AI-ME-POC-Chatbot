"use client";

import { useEffect, useState, memo } from "react";
import { ToolResponse } from "assistant-stream";
import { Sparkles, TriangleAlert } from "lucide-react";
import { useAui, type ToolCallMessagePartStatus } from "@assistant-ui/react";

import { AnimatedImage } from "@/components/assistant-ui/animated-image";
import { cn } from "@/lib/utils";
import { useHitl } from "@/components/assistant-ui/CustomLanggraphRuntime";

type ToolCardProps = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  argsText: string;
  result?: unknown;
  status?: ToolCallMessagePartStatus;
  isError?: boolean;
};

const loadingMessages = [
  "Imagining your prompt...",
  "Sketching the outlines...",
  "Adding colors and details...",
  "Refining the composition...",
  "Finalizing your masterpiece...",
];

function normalizeToolResult(result: unknown) {
  if (result === null || result === undefined) return result;
  if (typeof result === "object") {
    if ("content" in result) {
      return (result as { content?: unknown }).content;
    }
    return result;
  }
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && "content" in parsed) {
          return (parsed as { content?: unknown }).content;
        }
      } catch {
        // ignore
      }
    }
    const match = trimmed.match(/content=("|')(.*?)("|')/);
    if (match && match[2]) return match[2];
    return result;
  }
  return result;
}

const ImageGenerationLoading = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border bg-muted/30 shadow-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 animate-pulse" />

      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />
          <div className="relative bg-card rounded-full p-3 border shadow-sm">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
        </div>

        <div className="space-y-1 z-10">
          <p className="text-sm font-semibold text-primary">Generating Image</p>
          <p className="text-xs text-muted-foreground min-h-[1.5em] transition-opacity duration-300">
            {loadingMessages[messageIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};

const ImageGenerationFailed = ({ reason }: { reason?: string }) => {
  return (
    <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border bg-destructive/5 shadow-sm">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-destructive/20 blur-lg" />
          <div className="relative bg-card rounded-full p-3 border shadow-sm">
            <TriangleAlert className="w-6 h-6 text-destructive" />
          </div>
        </div>

        <div className="space-y-1 z-10">
          <p className="text-sm font-semibold text-destructive">
            Image Generation Failed
          </p>
          <p className="text-xs text-muted-foreground">
            {reason ?? "Please try again later."}
          </p>
        </div>
      </div>
    </div>
  );
};

const ImageGenerationToolCardImpl = ({
  toolCallId,
  toolName,
  argsText,
  result,
  status,
}: ToolCardProps) => {
  const aui = useAui();
  const {
    pendingInterrupt,
    decisions,
    setDecision,
    argsDraftTextById,
    setArgsDraftText,
    resetArgsDraftText,
    argsDraftErrorById,
    allDecided,
    allApprovedArgsValid,
    submitDecisions,
    toolResults,
    argsDisplayTextById,
  } = useHitl();

  const storedResult = toolResults[toolCallId];
  useEffect(() => {
    if (!storedResult) return;
    if (result !== undefined) return;
    aui
      .part()
      .addToolResult(
        new ToolResponse({
          result: storedResult.result,
          isError: storedResult.isError ?? false,
        }),
      );
  }, [storedResult, result, aui]);

  const interruptToolCalls = pendingInterrupt?.tool_calls ?? [];
  const isInterruptTool = interruptToolCalls.some((tc) => tc.id === toolCallId);
  const decision = decisions[toolCallId];
  const isLastInterruptTool =
    interruptToolCalls[interruptToolCalls.length - 1]?.id === toolCallId;

  const displayArgsText =
    (isInterruptTool ? argsDraftTextById[toolCallId] : undefined) ??
    argsDisplayTextById[toolCallId] ??
    argsText;
  const draftError = argsDraftErrorById[toolCallId] ?? null;

  const normalized = result === undefined ? undefined : normalizeToolResult(result);
  const promptText = (() => {
    try {
      const parsed = JSON.parse(displayArgsText ?? "{}") as { prompt?: string };
      return typeof parsed.prompt === "string" ? parsed.prompt : displayArgsText;
    } catch {
      return displayArgsText;
    }
  })();
  const isRunning = status?.type === "running";
  const isComplete = status?.type === "complete";
  const isCancelled = status?.type === "incomplete" && status.reason === "cancelled";
  const hasResult = typeof normalized === "string" && normalized.length > 0;

  return (
    <div
      className={cn(
        "w-full max-w-2xl mx-auto pb-6",
        isCancelled && "opacity-70",
      )}
      data-tool-name={toolName}
    >
      {hasResult ? (
        <>
          <AnimatedImage src={normalized} />
          <div className="mt-3 text-sm text-muted-foreground text-center">
            <p className="font-medium">Prompt:</p>
            <p className="italic whitespace-pre-wrap">{promptText}</p>
          </div>
        </>
      ) : isInterruptTool && !isCancelled ? (
        <div className="rounded-2xl border bg-background/80 p-4 text-left">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">Approval required</p>
              <p className="text-xs text-muted-foreground">
                Review and approve the image generation request.
              </p>
            </div>
            <button
              type="button"
              onClick={() => resetArgsDraftText(toolCallId)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Reset
            </button>
          </div>
          <textarea
            value={argsDraftTextById[toolCallId] ?? displayArgsText ?? "{}"}
            onChange={(e) => setArgsDraftText(toolCallId, e.target.value)}
            disabled={decision === "rejected"}
            spellCheck={false}
            className={cn(
              "mt-3 w-full resize-y rounded-md border bg-background px-2 py-1.5 font-mono text-xs leading-5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              decision === "rejected" && "opacity-60",
              draftError && decision !== "rejected" && "border-red-500/50",
            )}
            rows={6}
          />
          {draftError && decision !== "rejected" ? (
            <p className="mt-1 text-xs text-red-600">{draftError}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setDecision(toolCallId, "approved")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                decision === "approved"
                  ? "border-green-500/50 bg-green-500/10 text-green-600"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Approve
            </button>
            <button
              type="button"
              onClick={() => setDecision(toolCallId, "rejected")}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                decision === "rejected"
                  ? "border-red-500/50 bg-red-500/10 text-red-600"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Reject
            </button>
            {isLastInterruptTool && (
              <button
                type="button"
                onClick={submitDecisions}
                disabled={!allDecided || !allApprovedArgsValid}
                className={cn(
                  "ml-auto rounded-md border px-3 py-1 text-xs font-medium",
                  allDecided && allApprovedArgsValid
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border text-muted-foreground",
                )}
              >
                Send Feedback
              </button>
            )}
          </div>
          {decision === "rejected" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              This tool call will not run.
            </p>
          ) : null}
          {isLastInterruptTool && allDecided && !allApprovedArgsValid ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Fix argument JSON for approved tool calls to continue.
            </p>
          ) : null}
        </div>
      ) : isRunning ? (
        <ImageGenerationLoading />
      ) : isComplete ? (
        <ImageGenerationFailed reason="No image returned." />
      ) : (
        <ImageGenerationFailed />
      )}
    </div>
  );
};

export const GenerateImageToolCard = memo(ImageGenerationToolCardImpl);
