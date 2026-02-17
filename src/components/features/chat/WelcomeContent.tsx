"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, SparklesIcon } from "lucide-react";

import { usePersonalizationContext } from "@/contexts/PersonalizationContext";
import { getPersonalizedSiteConfig } from "@/lib/personalized-config";
import {
  generateConversationId,
  withTimeout,
  CONVERSATION_CONSTANTS,
} from "@/utils/chat/conversation";
import { savePendingMessage } from "@/utils/chat/storage";
import { CreateConversation } from "@/lib/integration/client/chat-conversation";

const BACKDROP = [
  "bg-[radial-gradient(circle_at_top,rgba(0,118,90,0.25),rgba(0,118,90,0)_55%)]",
  "bg-[radial-gradient(circle_at_70%_20%,rgba(36,116,86,0.20),rgba(36,116,86,0)_45%)]",
  "bg-[radial-gradient(circle_at_20%_80%,rgba(8,48,48,0.18),rgba(8,48,48,0)_55%)]",
];

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

export function WelcomeContent() {
  const router = useRouter();
  const { settings } = usePersonalizationContext();
  const config = getPersonalizedSiteConfig(settings);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);

  const backdrop = useMemo(() => BACKDROP.join(" "), []);
  const suggestions = config.chat.recommendationQuestions.slice(0, 4);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const conversationId = generateConversationId();

      const createdId = await withTimeout(
        CreateConversation(conversationId, trimmed),
        CONVERSATION_CONSTANTS.CREATION_TIMEOUT_MS,
        "Conversation creation timeout (30s)",
      );

      if (!createdId) {
        throw new Error("Failed to create conversation");
      }

      await savePendingMessage(trimmed, attachments);
      router.push(`/chat/${createdId}`);
    } catch (error) {
      console.error("Failed to create conversation:", error);
      setIsSubmitting(false);
      const errorMessage =
        error instanceof Error ? error.message : "Failed to create conversation";
      alert(`${errorMessage}. Please try again.`);
    }
  };

  const handleSuggestion = (prompt: string) => {
    if (isSubmitting) return;
    setMessage(prompt);
  };

  const handleAttachments = (files: FileList | null) => {
    if (!files) return;
    const incoming = Array.from(files);
    setAttachments(incoming);
  };

  return (
    <div
      className={`relative flex min-h-dvh flex-col overflow-hidden bg-background text-foreground ${backdrop}`}
    >
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.35),rgba(255,255,255,0))] blur-2xl" />
        <div className="absolute right-0 top-24 h-64 w-64 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.25),rgba(255,255,255,0))] blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="fade-in slide-in-from-bottom-2 flex items-center gap-2 rounded-full border border-muted/60 bg-background/70 px-3 py-1 text-xs uppercase tracking-[0.32em] text-muted-foreground animate-in">
          <SparklesIcon className="h-3.5 w-3.5" />
          {config.name}
        </div>
        <h1 className="fade-in slide-in-from-bottom-1 mt-6 text-balance text-4xl font-semibold leading-tight animate-in md:text-5xl">
          Welcome. What would you like to build today?
        </h1>
        <p className="fade-in slide-in-from-bottom-1 mt-4 text-pretty text-base text-muted-foreground animate-in delay-75 md:text-lg">
          Start a new conversation and continue in a focused thread with your
          attachments ready.
        </p>

        <form
          onSubmit={handleSubmit}
          className="fade-in slide-in-from-bottom-2 mt-8 flex w-full flex-col gap-3 rounded-3xl border border-input bg-background/80 p-3 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.45)] backdrop-blur animate-in delay-100"
        >
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask anything..."
              rows={1}
              className="min-h-[56px] w-full resize-none bg-transparent px-3 py-3 text-base outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-foreground px-5 text-sm font-medium text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!message.trim() || isSubmitting}
              aria-label="Start new chat"
            >
              Start
              <ArrowUpIcon className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-col items-start gap-2 px-2">
            <label className="text-xs font-medium text-muted-foreground">
              Attach an image (optional)
            </label>
            <input
              type="file"
              accept={ACCEPTED_TYPES}
              multiple
              onChange={(event) => handleAttachments(event.target.files)}
              className="text-xs text-muted-foreground file:mr-3 file:rounded-full file:border file:border-muted/60 file:bg-background file:px-3 file:py-1 file:text-xs file:font-medium file:text-foreground"
            />
            {attachments.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {attachments.length} attachment{attachments.length > 1 ? "s" : ""} ready
              </p>
            ) : null}
          </div>

          <div className="fade-in slide-in-from-bottom-2 flex flex-wrap gap-2 px-2 pb-1 text-left text-xs text-muted-foreground animate-in delay-150">
            {suggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleSuggestion(prompt)}
                className="rounded-full border border-muted/50 px-3 py-1 transition hover:border-muted hover:text-foreground"
              >
                {prompt}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
