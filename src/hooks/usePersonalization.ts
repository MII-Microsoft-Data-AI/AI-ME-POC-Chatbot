import { useState, useEffect } from 'react'

export interface PersonalizationSettings {
  siteIcon: string
  primaryColor: string
  siteName: string
}

const DEFAULT_SETTINGS: PersonalizationSettings = {
  siteIcon: 'https://www.mii.co.id/cfind/source/images/logo.png',
  primaryColor: '#00765a',
  siteName: 'MII Chat'
}

const STORAGE_KEY = 'mii-chat-personalization'

export function usePersonalization() {
  const [settings, setSettings] = useState<PersonalizationSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as PersonalizationSettings
        setSettings(parsed)
        applySettings(parsed)
      }
    } catch (error) {
      console.error('Failed to load personalization settings:', error)
    } finally {
      setIsLoaded(true)
    }
  }, [])

  // Save settings to localStorage and apply them
  const updateSettings = (newSettings: Partial<PersonalizationSettings>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
      applySettings(updated)
    } catch (error) {
      console.error('Failed to save personalization settings:', error)
    }
  }

  // Reset to default settings
  const resetSettings = () => {
    setSettings(DEFAULT_SETTINGS)
    try {
      localStorage.removeItem(STORAGE_KEY)
      applySettings(DEFAULT_SETTINGS)
    } catch (error) {
      console.error('Failed to reset personalization settings:', error)
    }
  }

  return {
    settings,
    updateSettings,
    resetSettings,
    isLoaded
  }
}

// Apply settings to the document
function applySettings(settings: PersonalizationSettings) {
  // Update CSS custom property for primary color
  document.documentElement.style.setProperty('--primary', settings.primaryColor)
  
  // Update favicon
  updateFavicon(settings.siteIcon)
  
  // Update document title if we're on a basic page
  updateDocumentTitle(settings.siteName)
}

// Update the favicon dynamically
function updateFavicon(iconUrl: string) {
  // Remove existing favicon
  const existingLinks = document.querySelectorAll("link[rel*='icon']")
  existingLinks.forEach(link => link.remove())
  
  // Add new favicon
  const link = document.createElement('link')
  link.rel = 'icon'
  link.type = 'image/png'
  link.href = iconUrl
  document.head.appendChild(link)
}

// Update document title for basic pages
function updateDocumentTitle(siteName: string) {
  const currentTitle = document.title
  
  // Only update if it's a basic title pattern like "Page | Site Name"
  if (currentTitle.includes(' | ') || currentTitle.endsWith('MII Chat')) {
    const parts = currentTitle.split(' | ')
    if (parts.length > 1) {
      // Replace the site name part
      document.title = `${parts[0]} | ${siteName}`
    } else {
      // Handle titles that just end with the old site name
      document.title = currentTitle.replace(/MII Chat$/, siteName)
    }
  }
}