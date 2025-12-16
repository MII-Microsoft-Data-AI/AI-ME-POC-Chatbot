'use client'

import { User } from "next-auth"
import { useState, useEffect } from "react"
import Image from "next/image"
import { useRouter, usePathname } from "next/navigation"
import { useChat } from "@/contexts/ChatContext"
import { useModal } from "@/contexts/ModalContext"
import MenuButton from "./MenuButton"
import Logo from "./Logo"
import ChatSearch from "./ChatSearch"
import ChatSkeleton from "./ChatSkeleton"
import { getPageTitle } from "@/lib/site-config"
import { getPersonalizedSiteConfig } from "@/lib/personalized-config"
import { usePersonalizationContext } from "@/contexts/PersonalizationContext"
import { SquarePen, PanelRightClose, PanelRightOpen, Pin, Trash2, MessageSquare, PanelLeft, Plus, MoreHorizontal, Star, Pencil, Settings, Globe, HelpCircle, LogOut, ChevronRight, Download, CircleArrowUp, Info, ChevronsUpDown, Database } from "lucide-react"
import { cn } from "@/lib/utils"

interface GlobalNavbarProps {
  user: User
}

// Helper component to render chat group sections
interface ChatGroupProps {
  title: string
  chats: { id: string; title: string; date: string; createdAt: number; isPinned: boolean }[]
  onChatClick: (chatId: string) => void
  onTogglePin?: (chatId: string) => Promise<void>
  onDeleteChat?: (chatId: string) => Promise<void>
  isCollapsed?: boolean
  isMobile?: boolean
}

function ChatGroup({ title, chats, onChatClick, onTogglePin, onDeleteChat, isCollapsed = false, isMobile = false }: ChatGroupProps) {
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
          <div key={chat.id} className="relative group px-2">
            <button
              onClick={() => onChatClick(chat.id)}
              className={cn(
                "w-full h-9 flex items-center justify-center rounded-md hover:bg-[#ececec] transition-colors relative",
                "text-[#5f5f5f] hover:text-[#2d2d2d]"
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
    <div className="mb-6 last:mb-2">
      {title && (
        <h3 className="text-xs font-medium text-[#787878] mb-2 px-3 flex items-center select-none"
          style={{ color: title === "Pinned" ? (siteConfig.primaryColor || '#d97757') : undefined }}
        >
          {title}
        </h3>
      )}
      <div className="space-y-[2px]">
        {chats.map((chat) => (
          <div key={chat.id} className="group relative">
            <button
              className={cn(
                "w-full flex items-center justify-between px-3 py-2 rounded-md transition-colors text-left",
                "hover:bg-[#ececec] group/item pr-9" // Added padding-right to avoid overlap with menu button
              )}
              onClick={() => onChatClick(chat.id)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
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
                className="p-1 rounded-md hover:bg-[#dcdcdc] text-[#5f5f5f] transition-colors"
              >
                <MoreHorizontal className="w-4 h-4" />
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
                   className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden py-1"
                 >
                    {onTogglePin && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          await onTogglePin(chat.id)
                          setActiveMenuId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f5] flex items-center gap-2"
                      >
                         <Star 
                           className={cn("w-4 h-4", chat.isPinned ? "" : "text-[#5f5f5f]")} 
                           style={chat.isPinned ? { fill: siteConfig.primaryColor || '#d97757', color: siteConfig.primaryColor || '#d97757' } : undefined}
                         />
                         <span>{chat.isPinned ? "Unstar" : "Star"}</span>
                      </button>
                    )}
                    
                    <button
                        onClick={(e) => {
                           e.stopPropagation()
                           // rename logic placeholder
                           setActiveMenuId(null)
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-[#2d2d2d] hover:bg-[#f5f5f5] flex items-center gap-2"
                    >
                         <Pencil className="w-4 h-4 text-[#5f5f5f]" />
                         <span>Rename</span>
                    </button>

                    {onDeleteChat && (
                      <>
                        <div className="h-px bg-gray-100 my-1"></div>
                        <button
                          onClick={async (e) => {
                            e.stopPropagation()
                            await onDeleteChat(chat.id)
                            setActiveMenuId(null)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-[#ffeaea] flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4" />
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

import { motion, AnimatePresence } from "framer-motion"

// ... existing imports ...
// We need to keep the imports but I will rewrite the whole component return to use motion

export default function GlobalNavbar({ user }: GlobalNavbarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const { getGroupedChatHistory, togglePinChat, deleteChat, isInitialLoading } = useChat()
  const { showConfirmation } = useModal()
  const router = useRouter()
  const pathname = usePathname()
  const { settings } = usePersonalizationContext()
  const siteConfig = getPersonalizedSiteConfig(settings)

  // Load isPinned state from localStorage on component mount
  useEffect(() => {
    const savedPinnedState = localStorage.getItem('sidebarPinned')
    if (savedPinnedState) {
      setIsPinned(JSON.parse(savedPinnedState))
    }
  }, [])

  // Save isPinned state to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('sidebarPinned', JSON.stringify(isPinned))
  }, [isPinned])

  // Close profile menu when sidebar is collapsed
  useEffect(() => {
    if (isCollapsed) {
      setShowProfileMenu(false)
    }
  }, [isCollapsed])

  // Custom signOut function that clears localStorage and redirects to signout page
  const handleSignOut = () => {
    localStorage.removeItem('sidebarPinned')
    router.push('/auth/signout')
  }

  // Get grouped chat history
  const groupedChats = getGroupedChatHistory()

  // Handle delete with confirmation popup
  const handleDeleteChat = async (chatId: string) => {
    const allChats = [
      ...groupedChats.pinned,
      ...groupedChats.today,
      ...groupedChats.yesterday,
      ...groupedChats.previous7Days,
      ...groupedChats.previous30Days,
      ...groupedChats.older
    ]
    const chat = allChats.find(c => c.id === chatId)
    if (chat) {
      showConfirmation({
        chatId,
        chatTitle: chat.title,
        message: `Are you sure you want to delete "${chat.title}"? This action cannot be undone.`,
        onConfirm: () => deleteChat(chatId)
      })
    }
  }

  // Get mobile title based on current page
  const getMobileTitle = () => {
    if (pathname.startsWith('/chat')) {
      const chatId = pathname.split('/chat/')[1]
      if (chatId) {
        const allChats = [
          ...groupedChats.pinned,
          ...groupedChats.today,
          ...groupedChats.yesterday,
          ...groupedChats.previous7Days,
          ...groupedChats.previous30Days,
          ...groupedChats.older
        ]
        const currentChat = allChats.find(chat => chat.id === chatId)

        if (currentChat) {
          return currentChat.title.length > 20 ? currentChat.title.slice(0, 25) + '...' : currentChat.title
        }

        return "Chat"
      }
      return 'New Chat'
    }
    
    return getPageTitle(pathname)
  }

  const handleChatClick = (chatId: string) => {
    router.push(`/chat/${chatId}`)
    setIsMobileSidebarOpen(false)
  }

  const handleNewChat = () => {
    router.push('/chat')
    setIsMobileSidebarOpen(false)
  }

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileSidebarOpen(false)
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const sidebarVariants = {
    expanded: { width: 260 },
    collapsed: { width: 60 }
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#e5e5e5] px-4 py-3 flex items-center justify-between shadow-sm w-screen">
        <button
          onClick={() => setIsMobileSidebarOpen(true)}
          className="p-2 -ml-2 rounded-md hover:bg-[#f0f0f0] transition-colors text-[#5f5f5f]"
          title="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="flex-1 flex justify-center items-center">
          <h1 className="text-sm font-semibold text-[#2d2d2d] truncate max-w-[200px]">
            {getMobileTitle()}
          </h1>
        </div>

        <div className="w-10 flex justify-end">
           <button onClick={handleNewChat} className="p-2 rounded-md hover:bg-[#f0f0f0] text-[#5f5f5f]">
             <SquarePen className="w-5 h-5" />
           </button>
        </div>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 w-[280px] bg-[#f9f9f9] flex flex-col z-50 md:hidden shadow-2xl"
            >
              <div className="flex-shrink-0 p-4 flex items-center justify-between border-b border-[#e5e5e5] bg-white">
                <Logo showText={true} />
                <button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  className="p-2 hover:bg-[#f0f0f0] rounded-md transition-colors text-[#5f5f5f]"
                >
                  <PanelRightClose className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto bg-[#ffffff]">
                <div className="p-3">
                  <button
                    onClick={handleNewChat}
                    className="w-full text-white py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors mb-4 shadow-sm hover:opacity-90"
                    style={{ backgroundColor: siteConfig.primaryColor || '#3b82f6' }}
                  >
                    <SquarePen className="w-4 h-4" />
                    <span className="font-medium text-sm">New Chat</span>
                  </button>

                  <ChatSearch isMobile={true} onChatSelect={() => setIsMobileSidebarOpen(false)} />
                  
                  <div className="mt-4">
                    {isInitialLoading ? (
                      <ChatSkeleton isMobile={true} count={4} />
                    ) : (
                      <>
                        <ChatGroup title="Pinned" chats={groupedChats.pinned} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} isMobile={true} />
                        <ChatGroup title="Today" chats={groupedChats.today} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} isMobile={true} />
                        <ChatGroup title="Yesterday" chats={groupedChats.yesterday} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} isMobile={true} />
                        <ChatGroup title="Previous 7 Days" chats={groupedChats.previous7Days} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} isMobile={true} />
                        <ChatGroup title="Previous 30 Days" chats={groupedChats.previous30Days} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} isMobile={true} />
                        <ChatGroup title="Older" chats={groupedChats.older} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} isMobile={true} />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 p-4 bg-white border-t border-[#e5e5e5]">
                 <div className="flex items-center gap-3">
                    {user.image ? (
                      <Image src={user.image} alt={user.name || 'User'} width={32} height={32} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 bg-[#f0f0f0] rounded-full flex items-center justify-center text-[#5f5f5f]">
                        <span className="text-xs font-bold">{user.name?.[0] || 'U'}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#2d2d2d] truncate">{user.name}</p>
                      <p className="text-xs text-[#787878] truncate">{user.email}</p>
                    </div>
                    <button onClick={handleSignOut} className="text-[#5f5f5f] hover:text-[#2d2d2d] p-1">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    </button>
                 </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.div
        initial={false}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="hidden md:flex h-screen flex-col border-r border-[#e5e5e5] bg-[#ffffff] relative z-30 overflow-hidden"
      >
        {/* Header */}
        <div className="flex-shrink-0 min-h-[60px] flex items-center justify-between px-3 pt-3 pb-2">
             {/* Logo - always in the same position */}
             <div className="flex items-center gap-2 flex-shrink-0">
                <Logo showText={false} />
                {!isCollapsed && (
                   <span className="font-semibold text-[#2d2d2d] whitespace-nowrap">
                     {siteConfig.name}
                   </span>
                )}
             </div>
            
            {/* Collapse button - always in the same position */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-md text-[#5f5f5f] hover:bg-[#ececec] hover:text-[#2d2d2d] transition-colors flex-shrink-0"
            >
              <div className="relative w-5 h-5">
                 <motion.div
                    animate={{ rotate: isCollapsed ? 0 : 180, opacity: isCollapsed ? 1 : 0, scale: isCollapsed ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                 >
                    <PanelLeft className="w-5 h-5" />
                 </motion.div>
                 <motion.div
                    animate={{ rotate: isCollapsed ? -180 : 0, opacity: isCollapsed ? 0 : 1, scale: isCollapsed ? 0 : 1 }}
                    transition={{ duration: 0.3 }}
                    className="absolute inset-0"
                 >
                    <PanelLeft className="w-5 h-5" />
                 </motion.div>
              </div>
            </button>
        </div>

        {/* New Chat Button */}
        <div className="flex-shrink-0 px-3 py-2">
          <div
            className={cn(
              "flex items-center rounded-lg transition-colors cursor-pointer",
              isCollapsed 
                ? "w-9 h-9 justify-center bg-transparent hover:bg-[#ececec] mx-auto" 
                : "w-full py-2 px-2 bg-[#f0f0f0] hover:bg-[#e6e6e6]"
             )} 
             onClick={handleNewChat}
          >
            {/* Plus icon - always in the same position */}
            <div 
               className="flex-shrink-0 flex items-center justify-center rounded-full text-white w-5 h-5"
               style={{ backgroundColor: siteConfig.primaryColor || '#da7756' }}
            >
               <Plus className="w-3 h-3" strokeWidth={3} />
            </div>
            
            {/* Text - only shown when expanded */}
            {!isCollapsed && (
               <span className="text-sm font-medium text-[#2d2d2d] whitespace-nowrap ml-3">
                 New chat
               </span>
            )}
          </div>
        </div>

        {/* Search */}
        <motion.div
           animate={{ 
             height: isCollapsed ? 0 : "auto", 
             opacity: isCollapsed ? 0 : 1,
             marginBottom: isCollapsed ? 0 : 8 // pb-2
           }}
           className="px-3 overflow-hidden"
        >
           <ChatSearch isCollapsed={false} />
        </motion.div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden modern-scrollbar">
           <div className="px-2 pb-2 relative">
             <AnimatePresence>
               {!isCollapsed && (
                 <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                 >
                    {isInitialLoading ? <ChatSkeleton count={6} /> : (
                      <>
                        <ChatGroup title="Pinned" chats={groupedChats.pinned} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} />
                        <ChatGroup title="Today" chats={groupedChats.today} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} />
                        <ChatGroup title="Yesterday" chats={groupedChats.yesterday} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} />
                        <ChatGroup title="Previous 7 Days" chats={groupedChats.previous7Days} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} />
                        <ChatGroup title="Previous 30 Days" chats={groupedChats.previous30Days} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} />
                        <ChatGroup title="Older" chats={groupedChats.older} onChatClick={handleChatClick} onTogglePin={togglePinChat} onDeleteChat={handleDeleteChat} />
                      </>
                    )}
                 </motion.div>
               )}
             </AnimatePresence>
           </div>
        </div>

        {/* Footer / User Profile */}
        <div className="flex-shrink-0 border-t border-[#e5e5e5] bg-[#ffffff] relative profile-menu-container">
           <AnimatePresence>
             {showProfileMenu && (
               <>
                 <motion.div
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   exit={{ opacity: 0 }}
                   className="fixed inset-0 z-40 bg-transparent"
                   onClick={() => setShowProfileMenu(false)}
                 />
                 <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.2 }}
                    className="fixed bottom-[76px] bg-white rounded-xl shadow-2xl border border-gray-100 z-[100] overflow-hidden text-sm"
                    style={{ 
                      left: '12px',
                      width: isCollapsed ? '220px' : '236px' // Smaller when collapsed, fits within sidebar
                    }}
                 >
                    <div className="px-4 py-3 border-b border-gray-100">
                        <p className="text-[#6e6e6e] truncate font-medium">{user.email}</p>
                    </div>
                    
                    <div className="py-1">
                        <button 
                             onClick={() => {
                                 handleNewChat()
                                 setShowProfileMenu(false)
                             }}
                             className="w-full text-left px-4 py-2 hover:bg-[#f5f5f5] flex items-center justify-between text-[#2d2d2d]"
                        >
                           <div className="flex items-center gap-3">
                              <Plus className="w-4 h-4 text-[#5f5f5f]" />
                              <span>New chat</span>
                           </div>
                        </button>
                    </div>

                    <div className="h-px bg-gray-100 my-1"></div>

                    <div className="py-1">
                        <button 
                            onClick={() => {
                                router.push('/settings')
                                setShowProfileMenu(false)
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#f5f5f5] flex items-center justify-between text-[#2d2d2d]"
                        >
                           <div className="flex items-center gap-3">
                              <Settings className="w-4 h-4 text-[#5f5f5f]" />
                              <span>Settings</span>
                           </div>
                        </button>
                        <button 
                            onClick={() => {
                                router.push('/resource-management')
                                setShowProfileMenu(false)
                            }}
                            className="w-full text-left px-4 py-2 hover:bg-[#f5f5f5] flex items-center gap-3 text-[#2d2d2d]"
                        >
                           <Database className="w-4 h-4 text-[#5f5f5f]" />
                           <span>Resource Management</span>
                        </button>
                    </div>

                    <div className="h-px bg-gray-100 my-1"></div>

                    <div className="py-1">
                       <button 
                         onClick={handleSignOut}
                         className="w-full text-left px-4 py-2 hover:bg-[#f5f5f5] flex items-center gap-3 text-[#2d2d2d]"
                       >
                           <LogOut className="w-4 h-4 text-[#5f5f5f]" />
                           <span>Log out</span>
                       </button>
                    </div>
                 </motion.div>
               </>
             )}
           </AnimatePresence>

           <div className={cn("p-2 space-y-1", isCollapsed && "flex justify-center")}>
              <div 
                className={cn(
                  "flex items-center rounded-md hover:bg-[#f0f0f0] transition-colors cursor-pointer group relative",
                  isCollapsed ? "w-9 h-9 justify-center" : "py-2 px-2"
                )}
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                  {/* Avatar - always in the same position */}
                  <div className="flex-shrink-0">
                      {user.image ? (
                      <Image src={user.image} alt={user.name!} width={32} height={32} className="w-8 h-8 rounded-full border border-[#e5e5e5]" />
                      ) : (
                      <div className="w-8 h-8 rounded-full bg-[#3b82f6] flex items-center justify-center text-white text-xs font-bold">
                          {user.email?.[0].toUpperCase()}
                      </div>
                      )}
                  </div>
                  
                  {/* User info - only shown when expanded */}
                  {!isCollapsed && (
                      <div className="min-w-0 flex flex-col ml-2.5 flex-1">
                          <span className="text-sm font-medium text-[#2d2d2d] truncate max-w-[120px]">{user.name}</span>
                          <span className="text-xs text-[#787878] truncate max-w-[120px] text-left">Free plan</span>
                      </div>
                  )}
                  
                  {/* Chevron icon - only shown when expanded */}
                  {!isCollapsed && (
                      <div className="flex-shrink-0 ml-auto">
                         <ChevronsUpDown className="w-4 h-4 text-[#9e9e9e]" />
                      </div>
                  )}
              </div>
           </div>
        </div>
      </motion.div>
    </>
  )
}