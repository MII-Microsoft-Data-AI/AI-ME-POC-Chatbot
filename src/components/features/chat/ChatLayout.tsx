'use client'

import { ReactNode } from 'react'

interface ChatLayoutProps {
  children: ReactNode
}

export function ChatLayout({ children }: ChatLayoutProps) {
  return <div className="h-screen pt-16 md:pt-0">{children}</div>
}
