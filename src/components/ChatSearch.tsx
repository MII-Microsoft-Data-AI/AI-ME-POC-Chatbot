'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { Search, X } from 'lucide-react'
import Fuse from 'fuse.js'
import { useChat } from '@/contexts/ChatContext'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface ChatSearchProps {
  isCollapsed?: boolean
  isMobile?: boolean
  onChatSelect?: () => void
}

interface ChatItem {
  id: string
  title: string
  date: string
}

export default function ChatSearch({ isCollapsed = false, isMobile = false, onChatSelect }: ChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<ChatItem[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const { chatHistory } = useChat()
  const router = useRouter()
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Fuse.js configuration
  const fuse = useMemo(() => new Fuse(chatHistory, {
    keys: ['title'],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 1
  }), [chatHistory])

  // Handle search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([])
      setIsDropdownOpen(false)
      return
    }

    const results = fuse.search(searchQuery).map(result => result.item)
    setSearchResults(results)
    setIsDropdownOpen(results.length > 0)
  }, [searchQuery, fuse])

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle chat selection
  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`)
    setSearchQuery('')
    setIsDropdownOpen(false)
    onChatSelect?.()
  }

  // Handle clear search
  const handleClearSearch = () => {
    setSearchQuery('')
    setSearchResults([])
    setIsDropdownOpen(false)
    inputRef.current?.focus()
  }

  // Handle search activation for collapsed mode
  const handleSearchActivation = () => {
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  if (isCollapsed) {
    return (
      <div className="px-1 mb-2">
        <button
          onClick={handleSearchActivation}
          className="w-full h-9 flex items-center justify-center rounded-md hover:bg-[#f5f5f5] transition-colors text-[#5f5f5f]"
          title="Search chats"
        >
          <Search className="w-4 h-4" strokeWidth={1.5} />
        </button>
      </div>
    )
  }

  return (
    <div ref={searchRef} className={cn("relative", isMobile ? "px-0 mb-4" : "px-0 mb-4")}>
      <div className="relative group">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-[#9ca3af] group-focus-within:text-[#6b7280] transition-colors" strokeWidth={1.5} />
        </div>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search chats..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "w-full pl-9 pr-9 py-2 text-sm rounded-md transition-all duration-200",
            "bg-[#f5f5f5] border border-transparent", // Lighter bg
            "focus:bg-white focus:border-[#f0f0f0] focus:outline-none focus:ring-2 focus:ring-[#f5f5f5]",
            "text-[#2d2d2d] placeholder-[#9ca3af]"
          )}
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            <X className="h-3.5 w-3.5 text-[#9ca3af] hover:text-[#4b5563]" strokeWidth={1.5} />
          </button>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isDropdownOpen && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#f0f0f0] rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          <div className="py-1">
            {searchResults.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleChatClick(chat.id)}
                className="w-full text-left px-4 py-2 hover:bg-[#f9f9f9] transition-colors border-b border-[#f5f5f5] last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#2d2d2d] truncate">
                      {chat.title}
                    </p>
                    <p className="text-xs text-[#9ca3af]">{chat.date}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* No Results Message */}
      {isDropdownOpen && searchQuery && searchResults.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#f0f0f0] rounded-md shadow-lg z-50">
          <div className="py-4 px-4 text-center text-[#787878] text-sm">
            No chats found for &ldquo;{searchQuery}&rdquo;
          </div>
        </div>
      )}
    </div>
  )
}
