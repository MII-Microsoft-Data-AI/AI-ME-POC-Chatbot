'use client'

import React, { useState, useEffect } from 'react'
import { Thread } from "@/components/assistant-ui/thread";
import { AssistantRuntimeProvider, ThreadHistoryAdapter, useThreadRuntime } from '@assistant-ui/react';
import { useParams } from 'next/navigation';
import { ChatWithConversationIDAPIRuntime, LoadConversationHistory } from '@/lib/integration/client/chat-conversation';
import type { ChatMode } from '@/components/assistant-ui/thread';

function ConversationContent({ 
  mode, 
  onModeChange, 
  isLoading 
}: { 
  mode: ChatMode; 
  onModeChange: (mode: ChatMode) => void; 
  isLoading: boolean;
}) {
  const threadRuntime = useThreadRuntime()

  // Check for pending message from new chat redirect
  useEffect(() => {
    if (!threadRuntime) return

    const pendingMessage = sessionStorage.getItem('pendingMessage')
    const pendingMode = sessionStorage.getItem('pendingMode')

    if (pendingMessage) {
      // Clear from sessionStorage
      sessionStorage.removeItem('pendingMessage')
      sessionStorage.removeItem('pendingMode')

      // Set mode if provided
      if (pendingMode && (pendingMode === 'chat' || pendingMode === 'image')) {
        onModeChange(pendingMode as ChatMode)
      }

      // Wait a bit for runtime to be ready
      setTimeout(() => {
        // Set the message in composer
        threadRuntime.composer.setText(pendingMessage)
        // Send it
        threadRuntime.composer.send()
      }, 100)
    }
  }, [threadRuntime, onModeChange])

  return <Thread isLoading={isLoading} mode={mode} onModeChange={onModeChange} />
}

function ChatPage() {
  const params = useParams()
  const conversationId = params.conversationId as string
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Mode state management
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

  const HistoryAdapter = React.useMemo<ThreadHistoryAdapter>(() => ({
    async load() {
      try {
        if (!conversationId) {
          return { messages: [] };
        }

        setIsLoadingHistory(true)
        setError(null)

        // Retry logic for race conditions (conversation might not be created yet)
        let retries = 3
        let delay = 500 // Start with 500ms
        let historyData = null

        while (retries > 0) {
          historyData = await LoadConversationHistory(conversationId);

          if (historyData !== null) {
            // Success!
            break
          }

          // Failed, retry after delay
          retries--
          if (retries > 0) {
            console.log(`Retrying conversation load... (${retries} attempts left)`)
            await new Promise(resolve => setTimeout(resolve, delay))
            delay *= 2 // Exponential backoff
          }
        }

        if (historyData === null) {
          setError('Failed to load conversation history')
          setIsLoadingHistory(false)
          return { messages: [] };
        }

        if (historyData.length === 0) {
          // New conversation - no error, just empty
          setIsLoadingHistory(false)
          return { messages: [] };
        }

        setIsLoadingHistory(false)
        return { messages: historyData };
      } catch (error) {
        console.error('Failed to load conversation history:', error);
        setError('Failed to load conversation history')
        setIsLoadingHistory(false)
        return { messages: [] };
      }
    },

    async append() {
      // The message will be saved automatically by your backend when streaming completes
    },
  }), [conversationId])

  const runtime = ChatWithConversationIDAPIRuntime(conversationId, HistoryAdapter, mode)

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className='h-screen pt-16 md:pt-0'>
        {error ? (
          // Show error state if conversation failed to load
          <div className="h-full flex items-center justify-center">
            <div className="text-center space-y-4 max-w-md">
              <div className="text-red-500 text-2xl">😕</div>
              <h2 className="text-xl font-semibold text-gray-800">Oops!</h2>
              <p className="text-gray-600">{error}</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-primary/85 hover:bg-primary text-white rounded-lg transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : (
          // Show main chat interface
          <ConversationContent 
            mode={mode} 
            onModeChange={setMode} 
            isLoading={isLoadingHistory}
          />
        )}
      </div>
    </AssistantRuntimeProvider>
  )
}

export default ChatPage