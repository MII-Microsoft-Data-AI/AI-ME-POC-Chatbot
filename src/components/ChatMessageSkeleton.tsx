'use client'

import { usePersonalizationContext } from "@/contexts/PersonalizationContext"
import { Sparkles } from "lucide-react"

interface ChatMessageSkeletonProps {
  count?: number
}

export function ChatMessageSkeleton({ count = 1 }: ChatMessageSkeletonProps) {
  const { settings } = usePersonalizationContext()
  
  return (
    <div className="mx-auto w-full max-w-[var(--thread-max-width)] space-y-6 px-2 py-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-start gap-3 px-2">
          {/* Animated Icon */}
          <div className="relative flex-shrink-0 mt-1">
            <div 
              className="w-7 h-7 rounded-full flex items-center justify-center animate-pulse"
              style={{ backgroundColor: `${settings.primaryColor}15` }}
            >
              <Sparkles 
                className="w-4 h-4 animate-pulse" 
                style={{ color: settings.primaryColor }}
              />
            </div>
          </div>

          {/* Shimmer Lines */}
          <div className="flex-1 space-y-3 py-1">
            {/* Shimmer effect with gradient */}
            <div className="relative overflow-hidden h-4 bg-gray-100 rounded-md w-3/4">
              <div 
                className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent"
                style={{
                  animation: 'shimmer 2s infinite'
                }}
              />
            </div>
            <div className="relative overflow-hidden h-4 bg-gray-100 rounded-md w-full">
              <div 
                className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent"
                style={{
                  animation: 'shimmer 2s infinite 0.2s'
                }}
              />
            </div>
            <div className="relative overflow-hidden h-4 bg-gray-100 rounded-md w-5/6">
              <div 
                className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/60 to-transparent"
                style={{
                  animation: 'shimmer 2s infinite 0.4s'
                }}
              />
            </div>
          </div>
        </div>
      ))}
      
      {/* Add shimmer keyframes to global styles */}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  )
}