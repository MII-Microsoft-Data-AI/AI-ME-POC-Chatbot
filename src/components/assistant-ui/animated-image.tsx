import React, { useState } from 'react'
import Image from 'next/image'

interface AnimatedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

export const AnimatedImage: React.FC<AnimatedImageProps> = ({
  src,
  alt = 'Generated image',
  className,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true)

  // Handle Blob src type by converting to string
  let imageSrc = src
  if (src instanceof Blob) {
    imageSrc = URL.createObjectURL(src)
  }

  if (!imageSrc) {
    return null
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 animate-pulse" />
      )}
      <img
        src={String(imageSrc)}
        alt={alt}
        onLoad={() => setIsLoading(false)}
        className={`w-full h-auto rounded-lg fade-in ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity duration-500 ${className || ''}`}
        {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}
      />
    </div>
  )
}
