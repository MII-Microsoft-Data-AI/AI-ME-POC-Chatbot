'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { usePersonalization, PersonalizationSettings } from '@/hooks/usePersonalization'

interface PersonalizationContextType {
  settings: PersonalizationSettings
  updateSettings: (settings: Partial<PersonalizationSettings>) => void
  resetSettings: () => void
  isLoaded: boolean
}

const PersonalizationContext = createContext<PersonalizationContextType | undefined>(undefined)

export function PersonalizationProvider({ children }: { children: ReactNode }) {
  const personalization = usePersonalization()

  return (
    <PersonalizationContext.Provider value={personalization}>
      {children}
    </PersonalizationContext.Provider>
  )
}

export function usePersonalizationContext() {
  const context = useContext(PersonalizationContext)
  if (context === undefined) {
    throw new Error('usePersonalizationContext must be used within a PersonalizationProvider')
  }
  return context
}