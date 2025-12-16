'use client'

import React, { useState, useEffect } from 'react'
import { Thread } from '@/components/assistant-ui/thread'
import { AssistantRuntimeProvider, useThreadRuntime } from '@assistant-ui/react'
import type { ChatMode } from '@/components/assistant-ui/thread'
import { useRouter } from 'next/navigation'
import { useLocalRuntime } from '@assistant-ui/react'

function ChatPageContent({ mode, onModeChange }: { mode: ChatMode; onModeChange: (mode: ChatMode) => void }) {
  const router = useRouter()
  const threadRuntime = useThreadRuntime()
  const [isCreating, setIsCreating] = useState(false)

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

        setIsCreating(true)

        // Generate ID client-side for optimistic navigation
        const conversationId = crypto.randomUUID()

        // Create conversation in background (fire and forget)
        // We use keepalive to ensure request completes even if page unmounts
        fetch('/api/be/create-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
          }),
          keepalive: true
        }).catch(err => console.error('Background creation failed:', err))
        
        console.log('Optimistic navigation to:', conversationId)
        
        // Store message in sessionStorage to send after redirect
        sessionStorage.setItem('pendingMessage', message)
        sessionStorage.setItem('pendingMode', mode)
        
        // Redirect to conversation page immediately
        router.push(`/chat/${conversationId}`)
        
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setIsCreating(false)
        // Fallback to original send? No, we just stay here.
      }
    }

    return () => {
      // Restore original send on cleanup
      threadRuntime.composer.send = originalSend
    }
  }, [threadRuntime, router, mode])

  return <Thread mode={mode} onModeChange={onModeChange} isCreating={isCreating} />
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

  // Create a minimal local runtime that does nothing
  // We only need this to satisfy the Thread component
  // All actual chat happens after redirect to /chat/[id]
  const runtime = useLocalRuntime({
    async *run() {
      // This will never be called because we override composer.send
      // But we need it to satisfy the type requirements
      return
    }
  })

  return (
    <div className='h-screen pt-16 md:pt-0'>
      <AssistantRuntimeProvider runtime={runtime}>
        <ChatPageContent mode={mode} onModeChange={setMode} />
      </AssistantRuntimeProvider>
    </div>
  )
}

export default ChatPage