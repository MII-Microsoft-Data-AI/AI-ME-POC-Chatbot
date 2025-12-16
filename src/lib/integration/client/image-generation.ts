"use client";

/**
 * Image Generation Client Integration
 * Provides functions to interact with DALL-E 3 image generation API
 */

const API_BASE_URL = "/api/be/api/v1";

export interface ImageGenerationRequest {
  prompt: string;
  size?: "1024x1024" | "1024x1792" | "1792x1024";
  quality?: "standard" | "hd";
  style?: "vivid" | "natural";
}

export interface ImageGenerationResponse {
  url: string;
  revised_prompt: string;
}

/**
 * Generate an image using DALL-E 3
 */
export async function generateImage(
  request: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const response = await fetch(`${API_BASE_URL}/generate-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: request.prompt,
      size: request.size || "1024x1024",
      quality: request.quality || "standard",
      style: request.style || "vivid",
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || "Failed to generate image");
  }

  return response.json();
}
