'use client'

import { SessionProvider } from "next-auth/react"
import { ReactNode } from "react"
import { ChatProvider } from "@/contexts/ChatContext"
import { ModalProvider } from "@/contexts/ModalContext"
import { PersonalizationProvider } from "@/contexts/PersonalizationContext"
import ConfirmationModal from "./ConfirmationModal"
import RenameModal from "./RenameModal"

interface ProvidersProps {
  children: ReactNode
}

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <PersonalizationProvider>
        <ChatProvider>
          <ModalProvider>
            {children}
            <ConfirmationModal />
            <RenameModal />
          </ModalProvider>
        </ChatProvider>
      </PersonalizationProvider>
    </SessionProvider>
  )
}
