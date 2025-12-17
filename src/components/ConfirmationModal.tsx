'use client'

import { useModal } from "@/contexts/ModalContext"
import { useRouter, usePathname } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"

export default function ConfirmationModal() {
  const { confirmationAlert, hideConfirmation, confirmAction } = useModal()
  const router = useRouter()
  const pathname = usePathname()

  const handleConfirm = () => {
    const chatId = confirmationAlert.chatId
    confirmAction()
    
    if (chatId && pathname === `/chat/${chatId}`) {
      router.push('/chat')
    }
  }

  return (
    <AnimatePresence>
      {confirmationAlert.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={hideConfirmation}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="bg-white rounded-2xl shadow-xl w-full max-w-[400px] overflow-hidden relative z-50 flex flex-col"
          >
            <div className="p-6 text-center">
              <h3 className="text-xl font-bold text-[#2d2d2d] mb-2">
                {confirmationAlert.title}
              </h3>
              <p className="text-[#6b7280] text-[15px] leading-relaxed">
                {confirmationAlert.message}
              </p>
            </div>
            
            <div className="p-4 pt-0 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={hideConfirmation}
                className="flex-1 border-[#e5e5e5] text-[#2d2d2d] hover:bg-[#f5f5f5]"
              >
                {confirmationAlert.cancelButtonText || 'Cancel'}
              </Button>
              <Button
                variant={confirmationAlert.type === 'info' ? 'default' : 'destructive'}
                onClick={handleConfirm}
                className={`flex-1 ${
                  confirmationAlert.type === 'info' 
                    ? 'bg-blue-600 hover:bg-blue-700' 
                    : 'bg-[#cf533d] hover:bg-[#b94a36]'
                }`}
              >
                {confirmationAlert.confirmButtonText || 'Delete'}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
