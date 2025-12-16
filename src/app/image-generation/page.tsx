'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function ImageGenerationPage() {
  const router = useRouter()
  
  useEffect(() => {
    // Redirect to chat page - user can toggle to image mode there
    router.replace('/chat')
  }, [router])

  return null
}

export default ImageGenerationPage
