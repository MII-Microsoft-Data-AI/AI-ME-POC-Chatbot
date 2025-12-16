# Image Generation API - DALL-E 3

## Overview
API endpoint untuk generate gambar menggunakan Azure OpenAI DALL-E 3.

## Environment Variables

Tambahkan ke `.env` file:

```bash
AZURE_OPENAI_DALLE_DEPLOYMENT_NAME=dall-e-3
```

## API Endpoint

### Generate Image

**Endpoint:** `POST /api/v1/generate-image`

**Request Body:**
```json
{
  "prompt": "A futuristic city with flying cars at sunset",
  "size": "1024x1024",
  "quality": "standard",
  "style": "vivid"
}
```

**Parameters:**
- `prompt` (required): Text description of the image to generate
- `size` (optional): Image dimensions
  - `1024x1024` (default) - Square
  - `1024x1792` - Portrait
  - `1792x1024` - Landscape
- `quality` (optional): Image quality
  - `standard` (default)
  - `hd`
- `style` (optional): Image style
  - `vivid` (default) - Hyper-realistic and dramatic
  - `natural` - More natural and less hyper-realistic

**Response:**
```json
{
  "url": "https://...",
  "revised_prompt": "A detailed futuristic cityscape..."
}
```

## Frontend Usage

### Using the Image Generation Panel

The chat page now has two tabs:
1. **Chat** - Regular chat interface
2. **Image Generation** - DALL-E 3 image generator

### Programmatic Usage

```typescript
import { generateImage } from '@/lib/integration/client/image-generation';

const result = await generateImage({
  prompt: "A beautiful sunset over mountains",
  size: "1024x1024",
  quality: "hd",
  style: "vivid"
});

console.log(result.url); // Image URL
console.log(result.revised_prompt); // AI-revised prompt
```

## Features

✅ Multiple image sizes (square, portrait, landscape)
✅ Quality options (standard, HD)
✅ Style options (vivid, natural)
✅ Beautiful UI with loading states
✅ Error handling
✅ Image preview
✅ Download/open generated images
✅ Shows AI-revised prompt

## Notes

- DALL-E 3 generates one image per request
- Image URLs are temporary and expire after some time
- HD quality uses more credits than standard
- The AI may revise your prompt for better results
