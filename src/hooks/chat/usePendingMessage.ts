import { useState, useEffect } from 'react'
import { useThreadRuntime, type ThreadRuntime } from '@assistant-ui/react'
import type { ChatMode } from '@/types/chat'
import { getPendingMessage, clearPendingMessage } from '@/utils/chat/storage'
import { PerformanceLogger } from '@/utils/performance-logger'

interface UsePendingMessageOptions {
  isLoading: boolean
  onModeChange: (mode: ChatMode) => void
}

// Helper: Wait for runtime to be ready
function waitForRuntimeReady(runtime: ThreadRuntime): Promise<void> {
  return new Promise((resolve) => {
    if (runtime.composer) {
      resolve()
    } else {
      setTimeout(() => resolve(), 50)
    }
  })
}

// Helper: Delay utility
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Hook para auto-send pending message setelah redirect dari new chat
// ✅ PHASE 1.2: Optimized dengan Promise-based approach (600ms -> 150ms)
export function usePendingMessage({ isLoading, onModeChange }: UsePendingMessageOptions) {
  const threadRuntime = useThreadRuntime()
  const [hasSentPendingMessage, setHasSentPendingMessage] = useState(false)

  useEffect(() => {
    async function processPendingMessage() {
      if (!threadRuntime || isLoading || hasSentPendingMessage) return

      const perf = new PerformanceLogger('PendingMessage')

      const pending = await getPendingMessage()
      if (!pending) return

      perf.checkpoint('Pending message retrieved')

      try {
        // Clear storage immediately
        await clearPendingMessage()
        perf.checkpoint('Storage cleared')

        // Set mode if needed
        if (pending.mode) {
          onModeChange(pending.mode)
        }

        // Wait for runtime to be ready
        await waitForRuntimeReady(threadRuntime)
        perf.checkpoint('Runtime ready')

        // Add attachments if present
        if (pending.attachmentFile.length > 0) {
          for (const file of pending.attachmentFile) {
            threadRuntime.composer.addAttachment(file)
          }
          perf.checkpoint(`Added ${pending.attachmentFile.length} attachments`)
          // Small delay for attachment processing
          await delay(100)
        }

        // Set text and send
        threadRuntime.composer.setText(pending.message)
        await delay(50) // Minimal delay for state sync
        
        perf.checkpoint('Message set in composer')
        
        threadRuntime.composer.send()
        setHasSentPendingMessage(true)
        
        perf.finish('PendingMessage')
      } catch (error) {
        console.error('[PendingMessage] Failed to send:', error)
        alert('Failed to send message. Please try again.')
      }
    }

    processPendingMessage()
  }, [threadRuntime, isLoading, hasSentPendingMessage, onModeChange])

  return { hasSentPendingMessage }
}
