import { useState, useEffect } from 'react'
import type { ChatMode } from '@/types/chat'
import { getChatMode, saveChatMode } from '@/utils/chat/storage'

// Hook untuk manage chat mode (chat/image) dengan localStorage persistence
// SSR-safe: mounted flag untuk prevent hydration mismatch
export function useChatMode() {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ChatMode>('chat')

  // Load mode from localStorage after mount (SSR-safe)
  useEffect(() => {
    setMounted(true)
    const savedMode = getChatMode()
    if (savedMode) {
      setMode(savedMode)
    }
  }, [])

  // Save mode to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      saveChatMode(mode)
    }
  }, [mode, mounted])

  return {
    mode,
    setMode,
    mounted,
  }
}
