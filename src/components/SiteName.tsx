'use client'

import { usePersonalizationContext } from "@/contexts/PersonalizationContext"

interface SiteNameProps {
  className?: string
  fallback?: string
}

export default function SiteName({ className = "", fallback = "MII Chat" }: SiteNameProps) {
  const { settings, isLoaded } = usePersonalizationContext()
  
  // Show fallback while loading to prevent hydration issues
  if (!isLoaded) {
    return <span className={className}>{fallback}</span>
  }
  
  return <span className={className}>{settings.siteName}</span>
}