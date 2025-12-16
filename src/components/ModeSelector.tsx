"use client";

import React, { useState } from "react";
import { ChevronDown, CheckIcon, MessageSquare, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/components/assistant-ui/thread";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  primaryColor?: string;
}

export function ModeSelector({ mode, onModeChange, primaryColor }: ModeSelectorProps) {
  const [showModeMenu, setShowModeMenu] = useState(false);

  const modeOptions = [
    { value: 'chat' as ChatMode, label: 'Chat', icon: MessageSquare },
    { value: 'image' as ChatMode, label: 'Image Generation', icon: Sparkles }
  ];

  const currentMode = modeOptions.find(opt => opt.value === mode) || modeOptions[0];
  const CurrentIcon = currentMode.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowModeMenu(!showModeMenu)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted-foreground/10 transition-colors"
      >
        <CurrentIcon className="w-4 h-4" />
        <span className="hidden sm:inline">{currentMode.label}</span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Dropdown Menu */}
      {showModeMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowModeMenu(false)}
          />
          <div className="absolute bottom-full left-0 mb-2 w-48 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            {modeOptions.map((option) => {
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onModeChange(option.value);
                    setShowModeMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-muted transition-colors",
                    mode === option.value && "bg-muted"
                  )}
                >
                  <OptionIcon className="w-4 h-4" />
                  <span className="font-medium">{option.label}</span>
                  {mode === option.value && (
                    <CheckIcon className="w-4 h-4 ml-auto" style={{ color: primaryColor }} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
