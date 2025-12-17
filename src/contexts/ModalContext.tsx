'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface ConfirmationAlert {
  isOpen: boolean
  title: string
  message: string
  chatId?: string | null // Keep for backward compatibility/specific logic if needed
  onConfirm?: () => void
  confirmButtonText?: string
  cancelButtonText?: string
  type?: 'danger' | 'info' | 'warning'
}

interface RenameModal {
  isOpen: boolean
  chatId?: string | null
  currentTitle: string
  onRename?: (newTitle: string) => void | Promise<void>
}

interface ModalContextType {
  confirmationAlert: ConfirmationAlert
  showConfirmation: (options: {
    title: string
    message: string
    chatId?: string // Optional now
    onConfirm: () => void
    confirmButtonText?: string
    cancelButtonText?: string
    type?: 'danger' | 'info' | 'warning'
  }) => void
  hideConfirmation: () => void
  confirmAction: () => void
  renameModal: RenameModal
  showRenameModal: (options: {
    chatId?: string
    currentTitle: string
    onRename: (newTitle: string) => void | Promise<void>
  }) => void
  hideRenameModal: () => void
}

const ModalContext = createContext<ModalContextType | undefined>(undefined)

export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within a ModalProvider')
  }
  return context
}

interface ModalProviderProps {
  children: ReactNode
}

export function ModalProvider({ children }: ModalProviderProps) {
  const [confirmationAlert, setConfirmationAlert] = useState<ConfirmationAlert>({
    isOpen: false,
    title: '',
    message: '',
    chatId: null,
    onConfirm: undefined,
    type: 'danger'
  })

  const [renameModal, setRenameModal] = useState<RenameModal>({
    isOpen: false,
    chatId: null,
    currentTitle: '',
    onRename: undefined
  })

  const showConfirmation = (options: {
    title: string
    message: string
    chatId?: string
    onConfirm: () => void
    confirmButtonText?: string
    cancelButtonText?: string
    type?: 'danger' | 'info' | 'warning'
  }) => {
    setConfirmationAlert({
      isOpen: true,
      title: options.title,
      message: options.message,
      chatId: options.chatId || null,
      onConfirm: options.onConfirm,
      confirmButtonText: options.confirmButtonText,
      cancelButtonText: options.cancelButtonText,
      type: options.type || 'danger'
    })
  }

  const hideConfirmation = () => {
    setConfirmationAlert(prev => ({
      ...prev,
      isOpen: false
    }))
  }

  const confirmAction = () => {
    if (confirmationAlert.onConfirm) {
      confirmationAlert.onConfirm()
    }
    hideConfirmation()
  }

  const showRenameModal = (options: {
    chatId?: string
    currentTitle: string
    onRename: (newTitle: string) => void | Promise<void>
  }) => {
    setRenameModal({
      isOpen: true,
      chatId: options.chatId || null,
      currentTitle: options.currentTitle,
      onRename: options.onRename
    })
  }

  const hideRenameModal = () => {
    setRenameModal(prev => ({
      ...prev,
      isOpen: false
    }))
  }

  return (
    <ModalContext.Provider value={{
      confirmationAlert,
      showConfirmation,
      hideConfirmation,
      confirmAction,
      renameModal,
      showRenameModal,
      hideRenameModal
    }}>
      {children}
    </ModalContext.Provider>
  )
}
