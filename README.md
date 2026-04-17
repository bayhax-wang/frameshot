# Frameshot

Video frame extraction API service powered by Cloudflare Workers, Containers, and R2.

## Architecture

- **Workers**: API routing layer (authentication, rate limiting, request distribution)
- **Containers**: ffmpeg video processing (frame extraction)
- **R2**: Storage for extracted frame images
- **KV**: API key storage and usage tracking

## API

```
POST /api/v1/extract
{
  "url": "https://example.com/video.mp4",  // or upload file
  "timestamp": "auto",     // auto=first frame | number=specific second
  "format": "jpg",
  "width": 1280
}

Response:
{
  "thumbnail_url": "https://r2.frameshot.dev/abc123.jpg"
}
```

## Deploy

```bash
# Set environment variables
export CLOUDFLARE_API_TOKEN="your-token"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"

# Deploy Worker
cd worker
wrangler deploy

# Deploy Container
cd ../container
wrangler deploy

# Create R2 bucket and KV namespace
wrangler r2 bucket create frameshot-thumbnails
wrangler kv:namespace create frameshot-keys
```

## Tech Stack

- Cloudflare Workers (API layer)
- Cloudflare Containers (ffmpeg processing)
- Cloudflare R2 (image storage)
- Cloudflare KV (API key management)
- Next.js (frontend)