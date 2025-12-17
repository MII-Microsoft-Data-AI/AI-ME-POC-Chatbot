'use client'

import { useState, useEffect } from "react"
import { useModal } from "@/contexts/ModalContext"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"

export default function RenameModal() {
  const { renameModal, hideRenameModal } = useModal()
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (renameModal.isOpen) {
      setInputValue(renameModal.currentTitle)
      setError(null)
    }
  }, [renameModal.isOpen, renameModal.currentTitle])

  const handleRename = async () => {
    const trimmedValue = inputValue.trim()
    
    if (!trimmedValue) {
      setError('Title cannot be empty')
      return
    }

    if (trimmedValue.length > 1000) {
      setError('Title must be less than 1000 characters')
      return
    }

    if (trimmedValue === renameModal.currentTitle) {
      hideRenameModal()
      return
    }

    try {
      setIsLoading(true)
      setError(null)
      
      if (renameModal.onRename) {
        await renameModal.onRename(trimmedValue)
      }
      
      hideRenameModal()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to rename conversation'
      setError(errorMessage)
      alert(`Failed to rename conversation: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isLoading) {
      handleRename()
    } else if (e.key === 'Escape') {
      hideRenameModal()
    }
  }

  const isSubmitDisabled = !inputValue.trim() || isLoading || inputValue.trim().length > 1000

  return (
    <AnimatePresence>
      {renameModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={hideRenameModal}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-[400px] overflow-hidden relative z-50 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-xl font-bold text-[#2d2d2d] mb-4">
                Rename conversation
              </h3>
              
              <div className="mb-4">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value)
                    setError(null)
                  }}
                  onKeyDown={handleKeyDown}
                  maxLength={1000}
                  placeholder="Enter new title"
                  autoFocus
                  disabled={isLoading}
                  className="w-full px-3 py-2 border border-[#e5e5e5] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-[#2d2d2d] placeholder-[#a0a0a0] disabled:bg-[#f5f5f5]"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-[#6b7280]">
                    {inputValue.length} / 1000
                  </p>
                  {error && (
                    <p className="text-xs text-red-600">
                      {error}
                    </p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="p-4 pt-0 flex gap-3 justify-end border-t border-[#f0f0f0]">
              <Button
                variant="outline"
                onClick={hideRenameModal}
                disabled={isLoading}
                className="flex-1 border-[#e5e5e5] text-[#2d2d2d] hover:bg-[#f5f5f5]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRename}
                disabled={isSubmitDisabled}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:bg-[#c5c5c5] disabled:cursor-not-allowed"
              >
                {isLoading ? 'Renaming...' : 'Rename'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
