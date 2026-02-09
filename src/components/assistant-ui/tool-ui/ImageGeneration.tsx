import React from 'react'
import { makeAssistantToolUI } from '@assistant-ui/react'
import { AnimatedImage } from '@/components/assistant-ui/animated-image'
import { Loader2 } from 'lucide-react'

interface GenerateImageArgs {
  prompt: string
  size?: '1024x1024' | '1024x1792' | '1792x1024'
  style?: 'vivid' | 'natural'
}

const ImageGenerationLoading = ({ args }: { args: GenerateImageArgs }) => (
  <div className="w-full max-w-2xl mx-auto">
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Loader2 className="h-5 w-5 text-zinc-600 animate-spin" />
        <span className="text-sm text-zinc-700">Generating image...</span>
      </div>
      <p className="text-sm text-zinc-600 line-clamp-2">
        &quot;{args.prompt}&quot;
      </p>
    </div>
  </div>
)

const ImageGenerationFailed = ({ status }: { status: string }) => (
  <div className="w-full max-w-2xl mx-auto">
    <div className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-900">Failed to generate image</p>
      {status && <p className="text-xs text-red-700 mt-1">{status}</p>}
    </div>
  </div>
)

export const GenerateImageUI = makeAssistantToolUI<GenerateImageArgs, string>({
  toolName: 'generate_image',
  render: ({ args, result, status }) => {
    if (status.type === 'running') {
      return <ImageGenerationLoading args={args} />
    }

    if (status.type === 'incomplete') {
      return <ImageGenerationFailed status={status.reason || ''} />
    }

    if (result && typeof result === 'string') {
      return (
        <div className="w-full max-w-2xl mx-auto">
          <AnimatedImage src={result} alt={`Generated image: ${args.prompt}`} />
          <div className="mt-3 text-xs text-zinc-500 text-center">
            Prompt: {args.prompt}
          </div>
        </div>
      )
    }

    return null
  },
})

