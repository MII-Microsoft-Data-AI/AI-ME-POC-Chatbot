'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Thread } from '@/components/assistant-ui/thread'
import { AssistantRuntimeProvider, useThreadRuntime } from '@assistant-ui/react'
import { FirstChatAPIRuntime } from '@/lib/integration/client/chat-conversation'
import type { ChatMode } from '@/components/assistant-ui/thread'
import { useRouter } from 'next/navigation'

function ChatPageContent({ mode, onModeChange }: { mode: ChatMode; onModeChange: (mode: ChatMode) => void }) {
  const router = useRouter()
  const threadRuntime = useThreadRuntime()

  // Override composer send to create conversation first
  useEffect(() => {
    if (!threadRuntime) return

    // Store original send function
    const originalSend = threadRuntime.composer.send

    // Override send function
    threadRuntime.composer.send = async () => {
      try {
        // Get the message from composer
        const composerState = threadRuntime.composer.getState()
        const message = composerState.text

        if (!message.trim()) return

        // Create conversation first
        const response = await fetch('/api/be/create-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })
        
        const data = await response.json()
        
        if (data.conversationId) {
          console.log('Created conversation:', data.conversationId)
          
          // Store message in sessionStorage to send after redirect
          sessionStorage.setItem('pendingMessage', message)
          sessionStorage.setItem('pendingMode', mode)
          
          // Redirect to conversation page
          router.push(`/chat/${data.conversationId}`)
        }
      } catch (error) {
        console.error('Failed to create conversation:', error)
        // Fallback to original send
        originalSend()
      }
    }

    return () => {
      // Restore original send on cleanup
      threadRuntime.composer.send = originalSend
    }
  }, [threadRuntime, router, mode])

  return <Thread mode={mode} onModeChange={onModeChange} />
}

function ChatPage() {
  const [mounted, setMounted] = useState(false)
  const [mode, setMode] = useState<ChatMode>('chat')

  // Load mode from localStorage after mount
  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('chat-mode')
    if (saved === 'image') {
      setMode('image')
    }
  }, [])

  // Save mode to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('chat-mode', mode)
    }
  }, [mode, mounted])

  // Create runtime with mode - runtime hook must be called at top level
  const runtime = FirstChatAPIRuntime(mode)

  return (
    <div className='h-screen pt-16 md:pt-0'>
      <AssistantRuntimeProvider runtime={runtime}>
        <ChatPageContent mode={mode} onModeChange={setMode} />
      </AssistantRuntimeProvider>
    </div>
  )
}

export default ChatPage