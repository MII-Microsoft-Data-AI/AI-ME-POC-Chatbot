'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { getNavigationItems } from '@/lib/site-config'
import NavIcon from './NavIcon'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-react'

interface MenuButtonProps {
  isCollapsed?: boolean
}

export default function MenuButton({ isCollapsed = false }: MenuButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Get menu items from site config
  const menuItems = getNavigationItems('menu')

  const handleMenuClick = (path: string) => {
    setIsOpen(false)
    if (path === '/chat' && pathname.startsWith('/chat')) {
      // Stay on current page if already in chat
      return
    }
    router.push(path)
  }

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={menuRef}>
      {/* Menu Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center transition-colors rounded-md text-[#5f5f5f] hover:text-[#2d2d2d] hover:bg-[#f0f0f0]",
          isCollapsed ? "justify-center p-2" : "justify-start px-2 py-2 gap-3"
        )}
        title={isCollapsed ? 'Menu' : ''}
      >
        <Menu className="w-5 h-5" strokeWidth={1.5} />
        {!isCollapsed && <span className="text-sm font-medium">Menu</span>}
      </button>

      {/* Popover */}
      {isOpen && (
        <div 
           className={cn(
             "absolute left-0 bottom-full mb-2 rounded-lg shadow-xl border border-[#e5e5e5] bg-white z-50 overflow-hidden",
             isCollapsed ? "w-48 ml-1" : "w-full"
           )}
        >
          <div className="py-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleMenuClick(item.path)}
                className="w-full text-left px-3 py-2 hover:bg-[#f9f9f9] transition-colors flex items-center gap-2 group border-b border-[#f3f4f6] last:border-b-0"
                title={item.description}
              >
                <div className="text-[#9ca3af] group-hover:text-[#5f5f5f]">
                  <NavIcon iconSvg={item.icon.svg} className="w-4 h-4" />
                </div>
                <span className="text-sm text-[#2d2d2d] group-hover:text-black">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}