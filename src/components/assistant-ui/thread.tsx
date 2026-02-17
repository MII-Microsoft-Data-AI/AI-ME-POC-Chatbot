import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useAssistantState,
  useThreadRuntime,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
  Loader2,
  MessageSquare,
  History,
  Plus,
  Paperclip,
} from "lucide-react";
import type { FC } from "react";
import { useState } from "react";
import { useSession } from "next-auth/react";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";

import { getPersonalizedSiteConfig } from "@/lib/personalized-config";
import { usePersonalizationContext } from "@/contexts/PersonalizationContext";
import { getTimeOfDay } from "@/utils/time-utils";
import { ChatMessageSkeleton } from "@/components/ChatMessageSkeleton";
import { Reasoning, ReasoningGroup } from "@/components/assistant-ui/reasoning";

const Settings = {
  attachments: true,
  editMessages: true,
  regenerate: true,
};

interface ThreadProps {
  isLoading?: boolean;
  isCreating?: boolean;
}

export const Thread: FC<ThreadProps> = ({
  isLoading = false,
  isCreating = false,
}) => {
  const isThreadEmpty = useAssistantState(
    ({ thread }) => thread.messages.length === 0,
  );

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="aui-root aui-thread-root @container flex h-full flex-col bg-white"
          style={{
            ["--thread-max-width" as string]: "48rem",
          }}
        >
          <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-hidden overflow-y-auto px-4 pt-10">
            {!isLoading && <ThreadWelcome isCreating={isCreating} />}

            {isLoading ? null : (
              <ThreadPrimitive.Messages
                components={{
                  UserMessage,
                  EditComposer,
                  AssistantMessage,
                }}
              />
            )}

            <div className="flex-grow min-h-4" />

            {!isThreadEmpty && !isLoading && (
              <div className="sticky bottom-0 z-10 bg-background pb-4 pt-2">
                <Composer isDisabled={isLoading} isCreating={isCreating} />
              </div>
            )}
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

const ThreadWelcomeSuggestions: FC = () => {
  const { settings } = usePersonalizationContext();
  const config = getPersonalizedSiteConfig(settings);
  const threadRuntime = useThreadRuntime();

  const handleSuggestionClick = (action: string) => {
    threadRuntime.composer.setText(action);
    threadRuntime.composer.send();
  };

  return (
    <div className="w-full px-4 md:px-0">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
        {config.chat.recommendationQuestions
          .slice(0, 4)
          .map((question, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(question)}
              className="group relative flex items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white p-4 text-left transition-all hover:border-zinc-300 hover:shadow-sm hover:bg-zinc-50/50"
            >
              <span className="text-sm font-medium text-zinc-600 line-clamp-2 leading-relaxed group-hover:text-zinc-900">
                {question}
              </span>
              <div
                className="shrink-0 rounded-full p-1.5 opacity-0 transition-all group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0"
                style={{
                  backgroundColor: `${settings.primaryColor}10`,
                }}
              >
                <ArrowUpIcon
                  className="h-3.5 w-3.5"
                  style={{ color: settings.primaryColor }}
                />
              </div>
            </button>
          ))}
      </div>
    </div>
  );
};

const ThreadWelcome: FC<{ isCreating?: boolean }> = ({ isCreating }) => {
  const { settings } = usePersonalizationContext();
  const config = getPersonalizedSiteConfig(settings);
  const time = getTimeOfDay();
  const { data: session } = useSession();
  const userName = session?.user?.name || "User";

  return (
    <ThreadPrimitive.Empty>
      <div className="aui-thread-welcome-root relative mx-auto flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col justify-center pb-24">
        <div className="flex flex-col items-center justify-center space-y-8 mt-12">
          {/* Badge */}
          <div className="flex flex-col items-center gap-2 mt-12 md:mt-0">
            <div
              className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors text-center max-w-[90vw] truncate"
              style={{
                backgroundColor: `${settings.primaryColor}15`,
                color: settings.primaryColor,
              }}
            >
              Powered by •{" "}
              <span className="underline cursor-pointer font-semibold">
                PT Mitra Integrasi Informatika - Azure AI Team
              </span>
            </div>
          </div>

          {/* Greeting */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-serif text-[#2d2d2d]">
              Good {time}, {userName}
            </h1>
            <p className="hidden md:block text-base text-zinc-500 font-light max-w-xl pt-2">
              Your dedicated intelligent partner for innovation. Experience the
              power of enterprise-grade AI designed to elevate your productivity
              and streamline your workflow.
            </p>
          </div>

          {/* Centered Composer */}
          <div className="w-full pt-4 space-y-8 flex flex-col items-center">
            <Composer isCreating={isCreating} variant="centered" />

            {/* Suggestions */}
            <ThreadWelcomeSuggestions />
          </div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};

interface ComposerProps {
  isDisabled?: boolean;
  isCreating?: boolean;
  variant?: "centered" | "footer";
}

const Composer: FC<ComposerProps> = ({
  isDisabled = false,
  isCreating = false,
  variant = "footer",
}) => {
  const { settings } = usePersonalizationContext();
  const threadExist = useAssistantState(
    ({ thread }) => thread.messages.length > 0,
  );
  const text = useAssistantState(({ composer }) => composer.text);
  const isEmpty = text.trim().length < 1;

  return (
    <div className="aui-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-2">
      <ComposerPrimitive.Root
        className={cn(
          "relative flex w-full flex-col rounded-2xl border bg-white shadow-sm transition-all focus-within:shadow-md dark:bg-zinc-900 dark:border-zinc-800",
          variant === "centered" ? "shadow-md pb-2" : "shadow-sm",
          isDisabled && "opacity-50 pointer-events-none",
        )}
      >
        <ComposerPrimitive.Input
          placeholder="How can I help you today?"
          className="w-full resize-none bg-transparent px-4 py-4 text-base outline-none placeholder:text-zinc-400 min-h-[52px] max-h-32"
          rows={1}
          autoFocus={!isDisabled}
          disabled={isDisabled || isCreating}
        />

        {/* Attachments Area */}
        <div className="px-4">
          <ComposerAttachments />
        </div>

        {/* Actions Footer */}
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <div className="flex items-center gap-2">
            <ComposerAddAttachment />
          </div>

          <div className="flex items-center gap-2">
            <ThreadPrimitive.If running={false}>
              <ComposerPrimitive.Send asChild>
                <TooltipIconButton
                  tooltip="Send message"
                  disabled={isDisabled || isCreating || isEmpty}
                  className={cn(
                    "size-8 rounded-lg transition-all flex items-center justify-center p-0",
                    isEmpty
                      ? "bg-zinc-100 text-zinc-400"
                      : "text-white shadow-sm hover:opacity-90",
                  )}
                  style={
                    !isEmpty
                      ? { backgroundColor: settings.primaryColor }
                      : undefined
                  }
                >
                  {isCreating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowUpIcon className="h-4 w-4" strokeWidth={2.5} />
                  )}
                </TooltipIconButton>
              </ComposerPrimitive.Send>
            </ThreadPrimitive.If>

            <ThreadPrimitive.If running>
              <ComposerPrimitive.Cancel asChild>
                <button className="size-8 rounded-full bg-zinc-100 flex items-center justify-center hover:bg-zinc-200">
                  <Square className="h-3 w-3 fill-zinc-500" />
                </button>
              </ComposerPrimitive.Cancel>
            </ThreadPrimitive.If>
          </div>
        </div>
      </ComposerPrimitive.Root>

      <div className="flex justify-center">
        <div className="text-xs text-zinc-400">
          AI can make mistakes. Please use with discretion.
        </div>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] animate-in py-4 duration-200 fade-in slide-in-from-bottom-1 last:mb-24"
        data-role="assistant"
      >
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolFallback },
              Reasoning: Reasoning,
              ReasoningGroup: ReasoningGroup,
            }}
          />
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-2 ml-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        {Settings.regenerate && (
          <TooltipIconButton tooltip="Refresh">
            <RefreshCwIcon />
          </TooltipIconButton>
        )}
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <div
        className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 duration-200 fade-in slide-in-from-bottom-1 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
        data-role="user"
      >
        {Settings.attachments && <UserMessageAttachments />}

        <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
          <div className="aui-user-message-content rounded-3xl bg-primary/15 px-5 py-2.5 break-words text-foreground">
            <MessagePrimitive.Parts />
          </div>
          <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
            {Settings.editMessages && <UserActionBar />}
          </div>
        </div>

        <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
      </div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
