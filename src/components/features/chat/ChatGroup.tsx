'use client'

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, MoreHorizontal, Star, Pencil, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { usePersonalizationContext } from "@/contexts/PersonalizationContext"
import { getPersonalizedSiteConfig } from "@/lib/personalized-config"

interface ChatGroupProps {
  title: string
  chats: { id: string; title: string; date: string; createdAt: number; isPinned: boolean }[]
  onChatClick: (chatId: string) => void
  onTogglePin?: (chatId: string) => Promise<void>
  onDeleteChat?: (chatId: string) => Promise<void>
  onRenameChat?: (chatId: string, currentTitle: string) => void
  isCollapsed?: boolean
  isMobile?: boolean
}

export function ChatGroup({ 
  title, 
  chats, 
  onChatClick, 
  onTogglePin, 
  onDeleteChat,
  onRenameChat,
  isCollapsed = false, 
  isMobile = false 
}: ChatGroupProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null)
  const { settings } = usePersonalizationContext()
  const siteConfig = getPersonalizedSiteConfig(settings)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (activeMenuId && !(event.target as Element).closest('.chat-menu-trigger')) {
        setActiveMenuId(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [activeMenuId])

  if (chats.length === 0) return null

  if (isCollapsed) {
    return (
      <div className="space-y-1">
        {chats.map((chat) => (
          <div key={chat.id} className="relative group px-1">
            <button
              onClick={() => onChatClick(chat.id)}
              className={cn(
                "w-full h-9 flex items-center justify-center rounded-md transition-colors relative",
                "text-[#5f5f5f] hover:text-[#2d2d2d] hover:bg-[#f5f5f5]" // Lighter hover
              )}
              title={chat.title}
            >
              <MessageSquare className="w-5 h-5" strokeWidth={1.5} />
              {chat.isPinned && (
                <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full border border-white" style={{ backgroundColor: siteConfig.primaryColor || '#d97757' }}></div>
              )}
            </button>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mb-4 last:mb-2"> {/* Reduced margin bottom for compactness */}
      {title && (
        <h3 className="text-xs font-medium text-[#787878] mb-1 px-3 flex items-center select-none"
          style={{ color: title === "Pinned" ? (siteConfig.primaryColor || '#d97757') : undefined }}
        >
          {title}
        </h3>
      )}
      <div className="space-y-[1px]"> {/* Thinner spacing */}
        {chats.map((chat) => (
          <div key={chat.id} className="group relative">
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-1.5 rounded-md transition-colors text-left", // Reduced vertical padding
                "hover:bg-[#f5f5f5] group/item pr-8" // Lighter hover, adjusted padding
              )}
              onClick={() => onChatClick(chat.id)}
            >
              <div className="flex items-center gap-2 overflow-hidden"> {/* Reduced gap */}
                <div className="min-w-0 flex-1">
                  <p className={cn(
                    "text-sm font-normal truncate transition-colors",
                    "text-[#2d2d2d]"
                  )}>
                    {chat.title}
                  </p>
                </div>
              </div>
            </button>
            
            {/* Menu Trigger Button */}
            <div className={cn(
               "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity chat-menu-trigger",
               activeMenuId === chat.id && "opacity-100"
            )}>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setActiveMenuId(activeMenuId === chat.id ? null : chat.id)
                }}
                className="p-1 rounded-md hover:bg-[#e0e0e0] text-[#5f5f5f] transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" strokeWidth={1.5} />
              </button>
            </div>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {activeMenuId === chat.id && (
                 <motion.div
                   initial={{ opacity: 0, scale: 0.95, y: -10 }}
                   animate={{ opacity: 1, scale: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   transition={{ duration: 0.1 }}
                   className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-[#f0f0f0] z-50 overflow-hidden py-1"
                 >
                    {onTogglePin && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await onTogglePin(chat.id)
                          setActiveMenuId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f8f8f8] flex items-center gap-2"
                      >
                         <Star 
                           className={cn("w-4 h-4", chat.isPinned ? "" : "text-[#5f5f5f]")} 
                           style={chat.isPinned ? { fill: siteConfig.primaryColor || '#d97757', color: siteConfig.primaryColor || '#d97757' } : undefined}
                           strokeWidth={1.5}
                         />
                         <span>{chat.isPinned ? "Unstar" : "Star"}</span>
                      </button>
                    )}
                    
                    <button
                        onClick={(e) => {
                           e.stopPropagation()
                           if (onRenameChat) {
                             onRenameChat(chat.id, chat.title)
                           }
                           setActiveMenuId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f8f8f8] flex items-center gap-2"
                    >
                         <Pencil className="w-4 h-4 text-[#5f5f5f]" strokeWidth={1.5} />
                         <span>Rename</span>
                    </button>

                    {onDeleteChat && (
                      <>
                        <div className="h-px bg-[#f0f0f0] my-1"></div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            await onDeleteChat(chat.id)
                            setActiveMenuId(null)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[#fff0f0] flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                          <span>Delete</span>
                        </button>
                      </>
                    )}
                 </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  )
}
