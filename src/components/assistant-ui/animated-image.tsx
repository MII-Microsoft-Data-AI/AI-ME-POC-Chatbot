"use client";

import { useState } from "react";
import type React from "react";
import { cn } from "@/lib/utils";

export const AnimatedImage = ({
  className,
  alt,
  src,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement>) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <span className="block relative my-4 overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
      {/* Loading skeleton */}
      {!isLoaded && !hasError && (
        <span className="absolute inset-0 flex items-center justify-center animate-pulse bg-gray-200">
          <span className="text-sm text-gray-400">Loading image...</span>
        </span>
      )}

      {/* Actual image */}
      <img
        src={src}
        alt={alt || "Generated Image"}
        className={cn(
          "w-full h-auto object-contain transition-opacity duration-500",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        {...props}
      />

      {/* Error state */}
      {hasError && (
        <span className="absolute inset-0 flex items-center justify-center bg-red-50">
          <span className="text-sm text-red-500">Failed to load image</span>
        </span>
      )}
    </span>
  );
};
