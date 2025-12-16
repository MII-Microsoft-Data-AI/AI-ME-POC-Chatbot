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

        // Generate ID client-side
        const conversationId = crypto.randomUUID()

        console.log('Creating conversation:', conversationId)

        // Create conversation and WAIT for it to complete
        const response = await fetch('/api/be/create-conversation', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            conversationId,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create conversation')
        }

        const data = await response.json()
        console.log('Conversation created successfully:', data.conversationId)
        
        // Store message in sessionStorage to send after redirect
        sessionStorage.setItem('pendingMessage', message)
        sessionStorage.setItem('pendingMode', mode)
        
        // Now redirect - conversation is guaranteed to exist
        router.push(`/chat/${conversationId}`)
        
      } catch (error) {
        console.error('Failed to create conversation:', error)
        setIsCreating(false)
        // Show error to user
        alert('Failed to create conversation. Please try again.')
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