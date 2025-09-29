'use client'

/**
 * Settings page with personalization features
 * 
 * Features:
 * - Change site name (appears in header and browser title)
 * - Change site icon/logo and favicon
 * - Change primary color theme
 * - Real-time preview of changes
 * - Persistent storage in localStorage
 * - Automatic application of settings across the app
 * 
 * Usage:
 * 1. Site Name: Enter custom name for your chat application
 * 2. Site Icon: Provide image URL (PNG/JPG/SVG) for logo and favicon
 * 3. Primary Color: Use color picker or enter hex code for theme color
 * 4. Preview changes in real-time before saving
 * 5. Save changes to persist across sessions
 */

import { useState, useEffect } from 'react'
import { usePersonalizationContext } from '@/contexts/PersonalizationContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Palette, ImageIcon, RotateCcw, Type } from 'lucide-react'

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, isLoaded } = usePersonalizationContext()
  const [tempSettings, setTempSettings] = useState(settings)
  const [isUnsaved, setIsUnsaved] = useState(false)

  // Sync temp settings when saved settings change
  useEffect(() => {
    setTempSettings(settings)
    setIsUnsaved(false)
  }, [settings])

  // Update temp settings and mark as unsaved
  const handleTempChange = (key: keyof typeof settings, value: string) => {
    setTempSettings((prev: typeof settings) => ({ ...prev, [key]: value }))
    setIsUnsaved(true)
  }

  // Save changes
  const handleSave = () => {
    updateSettings(tempSettings)
    setIsUnsaved(false)
  }

  // Reset to saved state
  const handleCancel = () => {
    setTempSettings(settings)
    setIsUnsaved(false)
  }

  // Reset to defaults
  const handleReset = () => {
    resetSettings()
    // tempSettings will be updated by the useEffect when settings change
    setIsUnsaved(false)
  }

  // Predefined color options
  const colorPresets = [
    { name: 'MII Green', color: '#00765a' },
    { name: 'Blue', color: '#3b82f6' },
    { name: 'Purple', color: '#8b5cf6' },
    { name: 'Red', color: '#ef4444' },
    { name: 'Orange', color: '#f97316' },
    { name: 'Pink', color: '#ec4899' },
    { name: 'Indigo', color: '#6366f1' },
    { name: 'Teal', color: '#14b8a6' },
  ]

  if (!isLoaded) {
    return (
      <div className="flex-1 p-8 pt-20 md:pt-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-32 mb-8"></div>
            <div className="h-48 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 p-8 pt-20 md:pt-8 max-h-screen overflow-y-scroll" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--foreground)' }}>
          Settings
        </h1>

        <div className="space-y-6">
          {/* Personalization Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Personalization
              </CardTitle>
              <CardDescription>
                Customize the appearance of your chat interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Site Name Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  <Label htmlFor="site-name" className="text-sm font-medium">
                    Site Name
                  </Label>
                </div>
                <div>
                  <Input
                    id="site-name"
                    type="text"
                    value={tempSettings.siteName}
                    onChange={(e) => handleTempChange('siteName', e.target.value)}
                    placeholder="Enter site name"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will appear in the header and browser title
                  </p>
                </div>
              </div>

              {/* Site Icon Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" />
                  <Label htmlFor="site-icon" className="text-sm font-medium">
                    Site Icon & Favicon
                  </Label>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img 
                      src={tempSettings.siteIcon} 
                      alt="Site icon preview" 
                      className="w-12 h-12 object-contain border rounded p-1"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <Input
                      id="site-icon"
                      type="url"
                      value={tempSettings.siteIcon}
                      onChange={(e) => handleTempChange('siteIcon', e.target.value)}
                      placeholder="Enter image URL"
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Enter a URL to an image (PNG, JPG, or SVG recommended)
                    </p>
                  </div>
                </div>
              </div>

              {/* Primary Color Section */}
              <div className="space-y-4">
                <Label htmlFor="primary-color" className="text-sm font-medium">
                  Primary Color
                </Label>
                <div className="space-y-4">
                  {/* Color Input */}
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 border rounded flex-shrink-0" 
                      style={{ backgroundColor: tempSettings.primaryColor }}
                    />
                    <Input
                      id="primary-color"
                      type="color"
                      value={tempSettings.primaryColor}
                      onChange={(e) => handleTempChange('primaryColor', e.target.value)}
                      className="w-20 h-12 p-1 border rounded cursor-pointer"
                    />
                    <Input
                      type="text"
                      value={tempSettings.primaryColor}
                      onChange={(e) => handleTempChange('primaryColor', e.target.value)}
                      placeholder="#000000"
                      className="flex-1"
                    />
                  </div>
                  
                  {/* Color Presets */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Quick presets:</p>
                    <div className="flex flex-wrap gap-2">
                      {colorPresets.map((preset) => (
                        <button
                          key={preset.name}
                          onClick={() => handleTempChange('primaryColor', preset.color)}
                          className={`flex items-center gap-2 px-3 py-2 rounded border text-sm hover:bg-gray-50 transition-colors ${
                            tempSettings.primaryColor === preset.color ? 'ring-2 ring-blue-500' : ''
                          }`}
                          title={`${preset.name} (${preset.color})`}
                        >
                          <div 
                            className="w-4 h-4 rounded border"
                            style={{ backgroundColor: preset.color }}
                          />
                          <span>{preset.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset to Default
                </Button>
                
                <div className="flex gap-2">
                  {isUnsaved && (
                    <Button variant="outline" onClick={handleCancel}>
                      Cancel
                    </Button>
                  )}
                  <Button 
                    onClick={handleSave}
                    disabled={!isUnsaved}
                    style={{ 
                      backgroundColor: isUnsaved ? tempSettings.primaryColor : undefined 
                    }}
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Preview Card */}
          <Card>
            <CardHeader>
              <CardTitle>Preview</CardTitle>
              <CardDescription>
                See how your changes will look
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 p-4 border rounded-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img 
                  src={tempSettings.siteIcon} 
                  alt="Logo preview" 
                  className="w-8 h-8 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                  }}
                />
                <div>
                  <h3 className="font-medium">{tempSettings.siteName}</h3>
                  <p className="text-sm text-muted-foreground">Your AI Assistant</p>
                </div>
                <div className="ml-auto">
                  <Button 
                    size="sm"
                    style={{ backgroundColor: tempSettings.primaryColor }}
                  >
                    Primary Button
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}