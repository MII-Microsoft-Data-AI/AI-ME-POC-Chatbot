"use client";

import React, { useState } from "react";
import { ChevronDown, CheckIcon, MessageSquare, SlidersHorizontal, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMode } from "@/components/assistant-ui/thread";

interface ModeSelectorProps {
  mode: ChatMode;
  onModeChange: (mode: ChatMode) => void;
  primaryColor?: string;
}

export function ModeSelector({ mode, onModeChange, primaryColor }: ModeSelectorProps) {
  const [showModeMenu, setShowModeMenu] = useState(false);

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowModeMenu(!showModeMenu)}
          className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium transition-colors",
              "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Tools</span>
          <ChevronDown className="w-4 h-4 text-zinc-400" />
        </button>

        {/* Active Mode Indicator */}
        {mode === 'image' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-zinc-900 text-white text-sm">
            <Image className="w-4 h-4" />
            <span>Image</span>
            <button
              type="button"
              onClick={() => onModeChange('chat')}
              className="ml-0.5 hover:bg-zinc-700 rounded-full p-0.5 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {showModeMenu && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowModeMenu(false)}
          />
          <div className="absolute bottom-full mb-2 left-0 w-56 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden text-zinc-700 p-1.5">
            <button
                  type="button"
                  onClick={() => {
                    onModeChange(mode === 'image' ? 'chat' : 'image');
                    setShowModeMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg transition-colors hover:bg-zinc-100",
                    mode === 'image' && "bg-zinc-50"
                  )}
                >
                  <Image className={cn("w-4 h-4", mode === 'image' ? "text-blue-500" : "text-zinc-400")} />
                  <div className="flex flex-col">
                     <span className="font-medium text-zinc-900">Create images</span>
                     <span className="text-xs text-zinc-500">Generate images with AI</span>
                  </div>
                  {mode === 'image' && (
                    <CheckIcon className="w-4 h-4 ml-auto text-blue-500" />
                  )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
