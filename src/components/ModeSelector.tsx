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
          <div 
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-white text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <Image className="w-4 h-4" />
            <span>Image</span>
            <button
              type="button"
              onClick={() => onModeChange('chat')}
              className="ml-0.5 hover:bg-black/20 rounded-full p-0.5 transition-colors"
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
          <div className="absolute bottom-full mb-2 left-0 w-64 bg-white border border-zinc-200 rounded-xl shadow-lg z-50 overflow-hidden p-1.5">
            <button
                  type="button"
                  onClick={() => {
                    onModeChange(mode === 'image' ? 'chat' : 'image');
                    setShowModeMenu(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 text-sm text-left rounded-lg transition-colors hover:bg-zinc-50",
                    mode === 'image' && "bg-zinc-50"
                  )}
                >
                  <Image 
                    className="w-5 h-5" 
                    style={{ color: mode === 'image' ? primaryColor : undefined }}
                  />
                  <div className="flex flex-col flex-1">
                     <span className="font-normal text-zinc-700">Create images</span>
                     <span className="text-xs text-zinc-500">Generate images with AI</span>
                  </div>
                  {mode === 'image' && (
                    <CheckIcon className="w-4 h-4" style={{ color: primaryColor }} />
                  )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
