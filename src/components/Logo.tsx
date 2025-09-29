'use client'

import { usePersonalizationContext } from "@/contexts/PersonalizationContext"
import { getPersonalizedSiteConfig } from "@/lib/personalized-config"
import Image from "next/image"

interface LogoProps {
  className?: string
  showText?: boolean
  textClassName?: string
}

export default function Logo({ 
  className = "", 
}: LogoProps) {
  const { settings } = usePersonalizationContext()
  const config = getPersonalizedSiteConfig(settings)

  return (
    <div className={`flex items-center justify-center space-x-3 ${className}`}>
      <div 
        className="rounded-lg flex items-center justify-center" 
        style={{ 
        }}
      >
      {
        config.logo.src && (
          <Image
            width={config.logo.width || 118}
            height={config.logo.height || 24}
            src={config.logo.src}
            alt={config.logo.alt}
            className="rounded max-h-8 w-auto"
          />
        )
      }
      </div>
    </div>
  )
}
