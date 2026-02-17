"use client";

import type { Toolkit } from "@assistant-ui/react";
import { z } from "zod";

import { GenerateImageToolCard } from "@/components/assistant-ui/tool-ui/ImageGeneration";

export const appToolkit: Toolkit = {
  generate_image: {
    description: "Generate an image from a prompt (HITL approval required).",
    parameters: z.object({
      prompt: z.string().min(1).describe("Prompt for image generation"),
      size: z
        .string()
        .min(1)
        .describe("Image size, e.g. 1024x1024"),
      style: z
        .string()
        .min(1)
        .describe("Image style, e.g. vivid or natural"),
    }),
    render: (props) => <GenerateImageToolCard {...props} />,
  },
};
