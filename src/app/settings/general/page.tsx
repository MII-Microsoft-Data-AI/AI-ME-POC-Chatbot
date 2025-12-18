'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

export default function GeneralPage() {
  const { data: session } = useSession()
  const [profile, setProfile] = useState({
    fullName: '',
    claudeName: '',
    work: 'engineering',
    preferences: '',
  })
  const [isProfileInitialized, setIsProfileInitialized] = useState(false)

  useEffect(() => {
    if (session?.user && !isProfileInitialized) {
      setProfile(prev => ({
        ...prev,
        fullName: session.user.name || '',
        claudeName: session.user.name || '',
      }))
      setIsProfileInitialized(true)
    }
  }, [session, isProfileInitialized])

  const [notifications, setNotifications] = useState({
    responseCompletions: false,
  })

  const [theme, setTheme] = useState<'light' | 'auto' | 'dark'>('light')

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Profile Section */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="fullName" className="text-slate-600 font-normal">Full name</Label>
            <div className="flex gap-3">
              <Avatar className="w-10 h-10 bg-slate-800 text-white">
                <AvatarImage src={session?.user?.image || undefined} alt={session?.user?.name || "User"} />
                <AvatarFallback className="bg-[#333] text-white text-xs font-medium">
                  {session?.user?.name ? session.user.name.substring(0, 2).toUpperCase() : 'AA'}
                </AvatarFallback>
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
            <Label htmlFor="claudeName" className="text-slate-600 font-normal">What should MII AI Assistant call you?</Label>
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
          <div className="relative">
              <select
                value={profile.work}
                onChange={(e) => setProfile(prev => ({ ...prev, work: e.target.value }))}
                className="flex h-10 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-950 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="engineering">Engineering</option>
                <option value="design">Design</option>
                <option value="product">Product</option>
                <option value="marketing">Marketing</option>
                <option value="other">Other</option>
              </select>
            </div>
        </div>

        <div className="space-y-2">
          <Label className="text-slate-600 font-normal">
            What <span className="underline decoration-slate-300 underline-offset-4">personal preferences</span> should AI Assistant consider in responses?
          </Label>
          <p className="text-xs text-slate-500">
            Your preferences will apply to all conversations.
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
              Get notified when AI Assistant has finished a response. Most useful for long-running tasks like tool calls and Research.
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
  )
}

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
