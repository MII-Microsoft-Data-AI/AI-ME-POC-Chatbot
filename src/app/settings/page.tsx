'use client'

import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/select'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Check, Monitor, Moon, Sun } from 'lucide-react'

// --- Types & Constants ---

type SettingSection = 'general' | 'account' | 'privacy' | 'billing' | 'capabilities' | 'connectors'

interface NavItem {
  id: SettingSection
  label: string
}

const NAV_ITEMS: NavItem[] = [
  { id: 'general', label: 'General' },
  { id: 'account', label: 'Account' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'billing', label: 'Billing' },
  { id: 'capabilities', label: 'Capabilities' },
  { id: 'connectors', label: 'Connectors' },
]

export default function SettingsPage() {
  const [activeSection, setActiveSection] = useState<SettingSection>('general')

  // Form State
  const [profile, setProfile] = useState({
    fullName: 'Ananda Affan Fattahila',
    claudeName: 'Ananda Affan Fattahila',
    work: 'engineering',
    preferences: '',
  })

  const [notifications, setNotifications] = useState({
    responseCompletions: false,
  })

  const [theme, setTheme] = useState<'light' | 'auto' | 'dark'>('light')

  return (
    <div className="min-h-screen bg-[#FBFBFB] text-slate-900 font-sans">
      <div className="max-w-6xl mx-auto px-6 py-12 md:py-20">
        
        {/* Page Header */}
        <h1 className="text-3xl font-serif text-[#333] mb-12 font-medium tracking-tight">
          Settings
        </h1>

        <div className="flex flex-col md:flex-row gap-12">
          
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 flex-shrink-0">
            <nav className="flex flex-col gap-1">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={cn(
                    "text-left px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200",
                    activeSection === item.id
                      ? "bg-[#EFECE6] text-slate-900"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 max-w-2xl">
            {activeSection === 'general' && (
              <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Profile Section */}
                <section className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-slate-600 font-normal">Full name</Label>
                      <div className="flex gap-3">
                        <Avatar className="w-10 h-10 bg-slate-800 text-white">
                            <AvatarFallback className="bg-[#333] text-white text-xs font-medium">AA</AvatarFallback>
                        </Avatar>
                        <Input 
                          id="fullName"
                          value={profile.fullName}
                          onChange={(e) => setProfile(prev => ({ ...prev, fullName: e.target.value }))}
                          className="flex-1 bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400" 
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                       <Label htmlFor="claudeName" className="text-slate-600 font-normal">What should Claude call you?</Label>
                       <Input 
                          id="claudeName"
                          value={profile.claudeName}
                          onChange={(e) => setProfile(prev => ({ ...prev, claudeName: e.target.value }))}
                          className="bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400" 
                        />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-600 font-normal">What best describes your work?</Label>
                    <Select 
                      value={profile.work} 
                      onChange={(e) => setProfile(prev => ({ ...prev, work: e.target.value }))}
                      className="bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400"
                    >
                      <option value="engineering">Engineering</option>
                      <option value="design">Design</option>
                      <option value="product">Product</option>
                      <option value="marketing">Marketing</option>
                      <option value="other">Other</option>
                    </Select>
                  </div>

                  <div className="space-y-2">
                     <Label className="text-slate-600 font-normal">
                       What <span className="underline decoration-slate-300 underline-offset-4">personal preferences</span> should Claude consider in responses?
                     </Label>
                     <p className="text-xs text-slate-500">
                       Your preferences will apply to all conversations, within <a href="#" className="underline">Anthropic's guidelines</a>.
                     </p>
                     <Textarea 
                       placeholder="e.g. ask clarifying questions before giving detailed answers"
                       value={profile.preferences}
                       onChange={(e) => setProfile(prev => ({ ...prev, preferences: e.target.value }))}
                       className="min-h-[120px] bg-white border-slate-200 text-slate-900 focus-visible:ring-slate-400 resize-none p-4"
                     />
                  </div>
                </section>

                <hr className="border-slate-100" />

                {/* Notifications Section */}
                <section className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">Notifications</h2>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-medium text-slate-900">Response completions</Label>
                      <p className="text-sm text-slate-500 max-w-lg">
                        Get notified when Claude has finished a response. Most useful for long-running tasks like tool calls and Research.
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.responseCompletions} 
                      onCheckedChange={(c) => setNotifications(prev => ({ ...prev, responseCompletions: c }))}
                    />
                  </div>
                </section>

                <hr className="border-slate-100" />

                {/* Appearance Section */}
                <section className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">Appearance</h2>
                  
                  <div className="space-y-3">
                    <Label className="text-slate-600 font-normal">Color mode</Label>
                    <div className="flex gap-4">
                      {/* Light Mode */}
                      <ThemeCard 
                        active={theme === 'light'} 
                        onClick={() => setTheme('light')}
                        label="Light" 
                        preview={<div className="w-full h-full bg-[#FAFAFA] border border-slate-200 flex flex-col p-2 gap-1 rounded-sm"><div className="h-2 w-1/2 bg-slate-200 rounded-full mb-1"></div><div className="h-10 w-full bg-white border border-slate-200 rounded-sm"></div></div>}
                      />
                       {/* Auto Mode */}
                       <ThemeCard 
                        active={theme === 'auto'} 
                        onClick={() => setTheme('auto')}
                        label="Auto" 
                        preview={<div className="w-full h-full flex rounded-sm overflow-hidden border border-slate-500"><div className="w-1/2 bg-[#FAFAFA] flex flex-col p-2 gap-1"><div className="h-2 w-1/2 bg-slate-200 rounded-full mb-1"></div><div className="h-10 w-full bg-white border border-slate-200 rounded-sm"></div></div><div className="w-1/2 bg-[#2D2D2D] flex flex-col p-2 gap-1"><div className="h-2 w-1/2 bg-slate-600 rounded-full mb-1"></div><div className="h-10 w-full bg-[#3D3D3D] border border-slate-600 rounded-sm"></div></div></div>}
                      />
                       {/* Dark Mode */}
                       <ThemeCard 
                        active={theme === 'dark'} 
                        onClick={() => setTheme('dark')}
                        label="Dark" 
                        preview={<div className="w-full h-full bg-[#1F1F1F] border border-slate-700 flex flex-col p-2 gap-1 rounded-sm"><div className="h-2 w-1/2 bg-slate-700 rounded-full mb-1"></div><div className="h-10 w-full bg-[#2D2D2D] border border-slate-600 rounded-sm"></div></div>}
                      />
                    </div>
                  </div>
                </section>
              </div>
            )}
            
            {activeSection !== 'general' && (
              <div className="py-20 text-center text-slate-500 animate-in fade-in">
                <p>This section is under development.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  )
}

// Helper Component for Theme Cards
function ThemeCard({ active, onClick, label, preview }: { active: boolean; onClick: () => void; label: string; preview: React.ReactNode }) {
  return (
    <div 
      className="flex flex-col items-center gap-2 cursor-pointer group"
      onClick={onClick}
    >
      <div className={cn(
        "w-32 h-20 rounded-lg p-1 transition-all duration-200 border-2",
        active 
          ? "border-blue-500 ring-2 ring-blue-200 bg-white" 
          : "border-transparent hover:bg-slate-100"
      )}>
        <div className="w-full h-full rounded overflow-hidden relative">
            {preview}
            {active && (
                <div className="absolute bottom-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            )}
        </div>
      </div>
      <span className={cn(
        "text-sm",
        active ? "text-slate-900 font-medium" : "text-slate-500"
      )}>
        {label}
      </span>
    </div>
  )
}