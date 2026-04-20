import { Container, getContainer } from "@cloudflare/containers";

export class FrameshotContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

// Shared auth logic
async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid API key', status: 401 };
  }

  const apiKey = authHeader.substring(7);
  const keyData = await env.FRAMESHOT_KEYS.get(apiKey);
  
  if (!keyData) {
    return { error: 'Invalid API key', status: 401 };
  }

  const parsedKey = JSON.parse(keyData);
  
  const limits = { free: 50, pro: 5000, scale: 50000 };
  const maxRequests = limits[parsedKey.tier] || 50;

  if (parsedKey.usage >= maxRequests) {
    return { error: 'Usage limit exceeded', status: 429 };
  }

  return { key: parsedKey, apiKeyStr: apiKey };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function corsError(status, message) {
  return corsJson({ error: message }, status);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check
    if (url.pathname === '/health') {
      return corsJson({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Extract frame endpoint - with auth
    if (url.pathname === '/extract' && request.method === 'POST') {
      try {
        // Authenticate
        const authResult = await authenticate(request, env);
        if (authResult.error) {
          return corsError(authResult.status, authResult.error);
        }

        // Forward to container (strip auth header to keep it clean)
        const sessionId = 'default';
        const containerInstance = getContainer(env.FRAMESHOT_CONTAINER, sessionId);
        
        const response = await containerInstance.fetch(request);
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.image_data) {
            try {
              const imageBuffer = Uint8Array.from(atob(result.image_data), c => c.charCodeAt(0));
              const key = `thumbnails/${result.filename}`;
              await env.THUMBNAILS.put(key, imageBuffer, {
                httpMetadata: { contentType: `image/${result.format}` }
              });
              
              const thumbnailUrl = `https://frameshot-images.vod-mates.workers.dev/${key}`;

              // Update usage counter
              authResult.key.usage += 1;
              await env.FRAMESHOT_KEYS.put(authResult.apiKeyStr, JSON.stringify(authResult.key));
              
              return corsJson({ 
                thumbnail_url: thumbnailUrl,
                size: result.size,
                format: result.format
              });
            } catch (uploadError) {
              return corsError(500, 'Upload to storage failed: ' + uploadError.message);
            }
          }
          
          return corsJson(result);
        }
        
        const errText = await response.text();
        return corsError(response.status, `Extraction failed: ${errText.slice(0, 200)}`);
        
      } catch (error) {
        return corsError(500, 'Processing failed: ' + error.message);
      }
    }

    // Also handle extract on /api/v1/extract path for compatibility
    if (url.pathname === '/api/v1/extract' && request.method === 'POST') {
      // Rewrite URL to /extract and reprocess
      const newUrl = new URL(request.url);
      newUrl.pathname = '/extract';
      const newRequest = new Request(newUrl.toString(), request);
      return this.fetch(newRequest, env);
    }
    
    return corsError(404, 'Not Found');
  },
};
