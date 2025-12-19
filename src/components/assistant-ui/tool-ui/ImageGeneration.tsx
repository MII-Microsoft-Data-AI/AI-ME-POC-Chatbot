import { makeAssistantToolUI } from "@assistant-ui/react";
import { AnimatedImage } from "../animated-image";
import { useState, useEffect } from "react";
import { Sparkles, TriangleAlert } from "lucide-react";

type GenerateImageArgs = {
  prompt: string
}

type GenerateImageResult = string; // URL of generated image

const loadingMessages = [
  "Imagining your prompt...",
  "Sketching the outlines...",
  "Adding colors and details...",
  "Refining the composition...",
  "Finalizing your masterpiece...",
];

const ImageGenerationLoading = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border bg-muted/30 shadow-sm">
      {/* Colorful animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10 animate-pulse" />
      
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg animate-pulse" />
          <div className="relative bg-card rounded-full p-3 border shadow-sm">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
        </div>
        
        <div className="space-y-1 z-10">
          <p className="text-sm font-semibold text-primary">
            Generating Image
          </p>
          <p className="text-xs text-muted-foreground min-h-[1.5em] transition-opacity duration-300">
            {loadingMessages[messageIndex]}
          </p>
        </div>
      </div>
    </div>
  );
};

const ImageGenerationFailed = () => {
  return (
    <div className="relative w-full max-w-md aspect-video rounded-2xl overflow-hidden border bg-destructive/5 shadow-sm">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-destructive/20 blur-lg" />
          <div className="relative bg-card rounded-full p-3 border shadow-sm">
            <TriangleAlert className="w-6 h-6 text-destructive" />
          </div>
        </div>
        
        <div className="space-y-1 z-10">
          <p className="text-sm font-semibold text-destructive">
            Image Generation Failed
          </p>
          <p className="text-xs text-muted-foreground">
            Please try again later.
          </p>
        </div>
      </div>
    </div>
  );
}

export const GenerateImageUI = makeAssistantToolUI<GenerateImageArgs, GenerateImageResult>({
  toolName: "generate_image", // Must match backend tool name
  render: (data) => {
    console.log(data)
    const { result, status } = data;
    // Tool outputs stream in; `result` will be `undefined` until the tool resolves.

    console.log("Image Generation Tool Status:", status);
    console.log("Image Generation Tool Result:", result);

    if (result) {
      return <AnimatedImage
        src={result}
      />
    }

    if (status.type === 'running') {
      return <ImageGenerationLoading />;
    }

   
    return <ImageGenerationFailed />;

  },
})
