'use client'

import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Palette, RotateCcw } from 'lucide-react'

const COLOR_PRESETS = [
  { name: 'MII Green', value: '#00765a' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Pink', value: '#ec4899' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Teal', value: '#14b8a6' },
]

export default function PersonalizationPage() {
  const [personalization, setPersonalization] = useState({
    siteName: 'MII Chat',
    siteIcon: 'https://www.mii.co.id/cfind/source/images/logo.png',
    primaryColor: '#00765a',
  })

  useEffect(() => {
    const saved = localStorage.getItem('personalization')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setPersonalization(parsed)
      } catch (e) {
        console.error('Failed to parse personalization settings:', e)
      }
    }
  }, [])

  const handleSave = () => {
    localStorage.setItem('personalization', JSON.stringify(personalization))
    alert('Settings saved successfully!')
    window.location.reload()
  }

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Personalization Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-200">
        <Palette className="w-6 h-6 text-slate-700" />
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Personalization</h2>
          <p className="text-sm text-slate-500 mt-1">Customize the appearance of your chat interface</p>
        </div>
      </div>

      {/* Site Name */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">T</span>
          <h3 className="text-base font-semibold text-slate-900">Site Name</h3>
        </div>
        <Input 
          value={personalization.siteName}
          onChange={(e) => setPersonalization(prev => ({ ...prev, siteName: e.target.value }))}
          className="bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400"
        />
        <p className="text-xs text-slate-500">This will appear in the header and browser title</p>
      </section>

      <hr className="border-slate-100" />

      {/* Site Icon & Favicon */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🖼</span>
          <h3 className="text-base font-semibold text-slate-900">Site Icon & Favicon</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-lg border-2 border-slate-200 flex items-center justify-center bg-white overflow-hidden flex-shrink-0">
            {personalization.siteIcon ? (
              <img src={personalization.siteIcon} alt="Site Icon" className="w-8 h-8 object-contain" />
            ) : (
              <Palette className="w-6 h-6 text-slate-400" />
            )}
          </div>
          <div className="flex-1">
            <Input 
              value={personalization.siteIcon}
              onChange={(e) => setPersonalization(prev => ({ ...prev, siteIcon: e.target.value }))}
              placeholder="https://www.mii.co.id/cfind/source/images/logo.png"
              className="bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400"
            />
            <p className="text-xs text-slate-500 mt-2">Enter a URL to an image (PNG, JPG, or SVG recommended)</p>
          </div>
        </div>
      </section>

      <hr className="border-slate-100" />

      {/* Primary Color */}
      <section className="space-y-4">
        <h3 className="text-base font-semibold text-slate-900">Primary Color</h3>
        
        <div className="flex items-center gap-4">
          {/* Color Preview Box */}
          <div 
            className="w-16 h-16 rounded-lg border-2 border-slate-200 flex-shrink-0 shadow-sm"
            style={{ backgroundColor: personalization.primaryColor }}
          />
          
          {/* Color Gradient Display (decorative) */}
          <div 
            className="w-24 h-16 rounded-lg shadow-sm"
            style={{ 
              background: `linear-gradient(135deg, ${personalization.primaryColor} 0%, ${personalization.primaryColor}dd 100%)`
            }}
          />
          
          {/* Hex Input */}
          <Input 
            value={personalization.primaryColor}
            onChange={(e) => setPersonalization(prev => ({ ...prev, primaryColor: e.target.value }))}
            className="flex-1 bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400 font-mono"
            placeholder="#00765a"
          />
        </div>

        {/* Quick Presets */}
        <div className="space-y-3">
          <Label className="text-sm text-slate-600">Quick presets:</Label>
          <div className="flex flex-wrap gap-3">
            {COLOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setPersonalization(prev => ({ ...prev, primaryColor: preset.value }))}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all duration-200",
                  personalization.primaryColor.toLowerCase() === preset.value.toLowerCase()
                    ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                )}
              >
                <div 
                  className="w-5 h-5 rounded-md border border-slate-200"
                  style={{ backgroundColor: preset.value }}
                />
                <span className={cn(
                  "text-sm font-medium",
                  personalization.primaryColor.toLowerCase() === preset.value.toLowerCase()
                    ? "text-slate-900"
                    : "text-slate-600"
                  )}>
                  {preset.name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Reset Button */}
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setPersonalization({
            siteName: 'MII Chat',
            siteIcon: 'https://www.mii.co.id/cfind/source/images/logo.png',
            primaryColor: '#00765a' 
          })}
          className="flex items-center gap-2 text-slate-600 hover:text-slate-900"
        >
          <RotateCcw className="w-4 h-4" />
          Reset to Default
        </Button>
      </section>

      <hr className="border-slate-100" />

      {/* Preview Section */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Preview</h3>
          <p className="text-sm text-slate-500 mt-1">See how your changes will look</p>
        </div>
        
        <div className="bg-white border-2 border-slate-200 rounded-xl p-6 space-y-4">
          {/* Preview Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-md overflow-hidden flex items-center justify-center bg-slate-50">
                {personalization.siteIcon ? (
                  <img src={personalization.siteIcon} alt="Preview Icon" className="w-6 h-6 object-contain" />
                ) : (
                  <Palette className="w-5 h-5 text-slate-400" />
                )}
              </div>
              <div>
                <h4 className="font-semibold text-slate-900">{personalization.siteName || 'Your Site Name'}</h4>
                <p className="text-xs text-slate-500">Your AI Assistant</p>
              </div>
            </div>
            <Button 
              size="sm"
              style={{ backgroundColor: personalization.primaryColor }}
              className="text-white hover:opacity-90 transition-opacity"
            >
              Primary Button
            </Button>
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end pt-6">
        <Button 
          size="lg"
          onClick={handleSave}
          style={{ backgroundColor: personalization.primaryColor }}
          className="text-white hover:opacity-90 transition-opacity px-8"
        >
          Save Changes
        </Button>
      </div>

    </div>
  )
}
