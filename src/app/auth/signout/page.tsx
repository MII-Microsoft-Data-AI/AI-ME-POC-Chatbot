'use client'

import { signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Logo from "@/components/Logo"
import { usePersonalizationContext } from "@/contexts/PersonalizationContext"
import { getPersonalizedSiteConfig } from "@/lib/personalized-config"

export default function SignOut() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSignedOut, setIsSignedOut] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const { settings } = usePersonalizationContext()
  const siteConfig = getPersonalizedSiteConfig(settings)

  useEffect(() => {
    // Automatically sign out the user when the page loads
    const performSignOut = async () => {
      try {
        await signOut({ 
          callbackUrl: '/auth/signin',
          redirect: false  // Handle redirect manually
        })
        setIsSignedOut(true)
        setIsLoading(false)
        
        // Redirect after a short delay to show success message
        setTimeout(() => {
          router.push('/auth/signin')
        }, 2000)
      } catch (error) {
        console.error('Sign out error:', error)
        setError("Failed to sign out. Please try again.")
        setIsLoading(false)
      }
    }

    performSignOut()
  }, [router])

  const handleGoToSignIn = () => {
    router.push('/auth/signin')
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: 'var(--background)' }}>
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto">
            <Logo className="justify-center" />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold" style={{ color: 'var(--primary)' }}>
            {isLoading ? 'Signing Out...' : isSignedOut ? 'Signed Out' : 'Sign Out Error'}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {isLoading && (
              <>
                Please wait while we sign you out
                <br />
                <span className="text-xs text-gray-500 mt-1 block">
                  This will only take a moment
                </span>
              </>
            )}
            {isSignedOut && (
              <>
                You have been successfully signed out
                <br />
                <span className="text-xs text-gray-500 mt-1 block">
                  Redirecting to sign in page...
                </span>
              </>
            )}
            {error && (
              <>
                {error}
                <br />
                <span className="text-xs text-gray-500 mt-1 block">
                  Please try signing out again or contact support
                </span>
              </>
            )}
          </p>
        </div>

        {isLoading && (
          <div className="mt-8 flex justify-center">
            <svg className="animate-spin h-12 w-12" style={{ color: 'var(--primary)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}

        {isSignedOut && (
          <div className="mt-8 text-center">
            <div className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-green-800 bg-green-100">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Successfully signed out
            </div>
          </div>
        )}

        {error && (
          <div className="mt-8 space-y-4">
            <button
              onClick={handleGoToSignIn}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{ backgroundColor: 'var(--primary)' }}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Go to Sign In
            </button>
          </div>
        )}

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 text-gray-500" style={{ backgroundColor: 'var(--background)' }}>
                {isLoading ? 'Processing...' : isSignedOut ? 'Redirecting in 2s' : 'Error occurred'}
              </span>
            </div>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400">
            {siteConfig.title} • Sign Out
          </p>
        </div>
      </div>
    </div>
  )
}