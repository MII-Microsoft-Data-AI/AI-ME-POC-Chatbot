'use client'

import { usePersonalizationContext } from "@/contexts/PersonalizationContext"
import { useEffect } from "react"

interface SiteTitleProps {
  pageTitle?: string
  separator?: string
}

export default function SiteTitle({ 
  pageTitle, 
  separator = " | " 
}: SiteTitleProps) {
  const { settings, isLoaded } = usePersonalizationContext()
  
  useEffect(() => {
    if (isLoaded) {
      const title = pageTitle 
        ? `${pageTitle}${separator}${settings.siteName}`
        : settings.siteName
        
      document.title = title
    }
  }, [pageTitle, separator, settings.siteName, isLoaded])
  
  return null // This component doesn't render anything
}