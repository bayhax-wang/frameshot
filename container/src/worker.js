import { Container, getContainer } from "@cloudflare/containers";

export class FrameshotContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";
}

// Auth
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

// TTL by tier (seconds)
const TTL_BY_TIER = {
  free: 7 * 24 * 3600,       // 7 days
  pro: 30 * 24 * 3600,       // 30 days
  scale: 90 * 24 * 3600,     // 90 days
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    // Health check (also used by cron keepalive)
    if (url.pathname === '/health') {
      return corsJson({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Extract frame
    if ((url.pathname === '/extract' || url.pathname === '/api/v1/extract') && request.method === 'POST') {
      try {
        const authResult = await authenticate(request, env);
        if (authResult.error) {
          return corsError(authResult.status, authResult.error);
        }

        // Parse persist param from query string or body
        const persistParam = url.searchParams.get('persist');

        const sessionId = 'default';
        const containerInstance = getContainer(env.FRAMESHOT_CONTAINER, sessionId);
        
        // Clone request body for container (original may have been consumed by auth)
        const clonedRequest = new Request('https://container/extract', {
          method: 'POST',
          headers: request.headers,
          body: request.body,
        });
        const response = await containerInstance.fetch(clonedRequest);
        
        if (!response.ok) {
          const errText = await response.text();
          return corsError(response.status, `Extraction failed: ${errText.slice(0, 200)}`);
        }

        const result = await response.json();
        
        if (!result.success || !result.image_data) {
          return corsJson(result);
        }

        const imageBuffer = Uint8Array.from(atob(result.image_data), c => c.charCodeAt(0));
        const mimeType = `image/${result.format || 'jpg'}`;

        // Update usage counter
        authResult.key.usage += 1;
        await env.FRAMESHOT_KEYS.put(authResult.apiKeyStr, JSON.stringify(authResult.key));

        // Determine if we should persist to R2
        const shouldPersist = persistParam === 'true' || persistParam === 'permanent';
        const isPermanent = persistParam === 'permanent';

        if (shouldPersist) {
          // Upload to R2 with custom metadata for TTL cleanup
          const key = `thumbnails/${result.filename}`;
          const tier = authResult.key.tier || 'free';
          const ttlSeconds = isPermanent ? 0 : (TTL_BY_TIER[tier] || TTL_BY_TIER.free);
          const expiresAt = isPermanent ? 'never' : new Date(Date.now() + ttlSeconds * 1000).toISOString();

          await env.THUMBNAILS.put(key, imageBuffer, {
            httpMetadata: { contentType: mimeType },
            customMetadata: { 
              tier,
              expiresAt,
              createdAt: new Date().toISOString(),
            },
          });
          
          const thumbnailUrl = `https://frameshot-images.vod-mates.workers.dev/${key}`;

          // Also return the image inline + the persistent URL
          return new Response(imageBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': mimeType,
              'X-Thumbnail-Url': thumbnailUrl,
              'X-Thumbnail-Expires': expiresAt,
              'X-Image-Size': String(result.size),
              'Content-Disposition': `inline; filename="${result.filename}"`,
            },
          });
        }

        // Default: return image directly (no R2 storage)
        return new Response(imageBuffer, {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': mimeType,
            'X-Image-Size': String(result.size),
            'Content-Disposition': `inline; filename="${result.filename}"`,
          },
        });

      } catch (error) {
        console.error('Processing error:', error.message, error.stack);
        return corsError(500, 'Processing failed: ' + error.message);
      }
    }
    
    return corsError(404, 'Not Found');
  },

  // Cron trigger: keep container warm
  async scheduled(event, env, ctx) {
    try {
      const sessionId = 'default';
      const containerInstance = getContainer(env.FRAMESHOT_CONTAINER, sessionId);
      await containerInstance.fetch(new Request('https://container/health'));
      
      // Also clean expired R2 objects (run once per trigger)
      const listed = await env.THUMBNAILS.list({ limit: 100, prefix: 'thumbnails/' });
      const now = new Date();
      
      for (const obj of listed.objects) {
        // Check custom metadata for expiration
        const head = await env.THUMBNAILS.head(obj.key);
        if (head && head.customMetadata && head.customMetadata.expiresAt) {
          if (head.customMetadata.expiresAt === 'never') continue;
          const expiresAt = new Date(head.customMetadata.expiresAt);
          if (now > expiresAt) {
            await env.THUMBNAILS.delete(obj.key);
          }
        }
      }
    } catch (e) {
      console.error('Scheduled task error:', e);
    }
  },
};
