import { Router, json, error } from 'itty-router';

export interface Env {
  FRAMESHOT_KEYS: KVNamespace;
  THUMBNAILS: R2Bucket;
  CONTAINER_URL: string;
  MAX_FREE_REQUESTS: string;
  MAX_PRO_REQUESTS: string;
  MAX_SCALE_REQUESTS: string;
}

interface ExtractRequest {
  url?: string;
  timestamp?: string | number;
  format?: 'jpg' | 'png' | 'webp';
  width?: number;
  file?: File;
}

interface ApiKey {
  tier: 'free' | 'pro' | 'scale';
  usage: number;
  resetDate: string;
}

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Rate limiting and authentication middleware
async function authenticate(request: Request, env: Env): Promise<ApiKey | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return error(401, 'Missing or invalid API key');
  }

  const apiKey = authHeader.substring(7);
  const keyData = await env.FRAMESHOT_KEYS.get(apiKey);
  
  if (!keyData) {
    return error(401, 'Invalid API key');
  }

  const parsedKey: ApiKey = JSON.parse(keyData);
  
  // Check if usage limit exceeded
  const maxRequests = parseInt(
    parsedKey.tier === 'free' ? env.MAX_FREE_REQUESTS :
    parsedKey.tier === 'pro' ? env.MAX_PRO_REQUESTS :
    env.MAX_SCALE_REQUESTS
  );

  if (parsedKey.usage >= maxRequests) {
    return error(429, 'Usage limit exceeded');
  }

  return parsedKey;
}

// Handle preflight requests
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/health', () => json({ status: 'ok', timestamp: new Date().toISOString() }));

// Extract frame endpoint
router.post('/api/v1/extract', async (request, env: Env) => {
  try {
    // Authenticate request
    const authResult = await authenticate(request, env);
    if (authResult instanceof Response) {
      return authResult;
    }

    const formData = await request.formData();
    const extractRequest: ExtractRequest = {};
    
    // Parse form data
    const url = formData.get('url');
    const timestamp = formData.get('timestamp');
    const format = formData.get('format');
    const width = formData.get('width');
    const file = formData.get('file');

    if (url) extractRequest.url = url as string;
    if (timestamp) extractRequest.timestamp = timestamp as string;
    if (format) extractRequest.format = format as 'jpg' | 'png' | 'webp';
    if (width) extractRequest.width = parseInt(width as string);
    if (file) extractRequest.file = file as File;

    // Validate input
    if (!extractRequest.url && !extractRequest.file) {
      return error(400, 'Either url or file must be provided');
    }

    // Set defaults
    extractRequest.timestamp = extractRequest.timestamp || 'auto';
    extractRequest.format = extractRequest.format || 'jpg';
    extractRequest.width = extractRequest.width || 1280;

    // Forward request to container
    const containerResponse = await fetch(env.CONTAINER_URL + '/extract', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': request.headers.get('Authorization') || '',
      }
    });

    if (!containerResponse.ok) {
      return error(containerResponse.status, 'Frame extraction failed');
    }

    const result = await containerResponse.json() as { thumbnail_url: string };

    // Update usage counter
    const authHeader = request.headers.get('Authorization')!;
    const apiKey = authHeader.substring(7);
    const keyData = await env.FRAMESHOT_KEYS.get(apiKey);
    const parsedKey: ApiKey = JSON.parse(keyData!);
    
    parsedKey.usage += 1;
    await env.FRAMESHOT_KEYS.put(apiKey, JSON.stringify(parsedKey));

    return json(result, { headers: corsHeaders });
  } catch (err) {
    console.error('Extract error:', err);
    return error(500, 'Internal server error');
  }
});

// Create API key endpoint (for demo purposes)
router.post('/api/v1/keys', async (request, env: Env) => {
  try {
    const { tier = 'free' } = await request.json() as { tier?: 'free' | 'pro' | 'scale' };
    
    // Generate random API key
    const apiKey = 'fs_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 32);

    const keyData: ApiKey = {
      tier,
      usage: 0,
      resetDate: new Date().toISOString(),
    };

    await env.FRAMESHOT_KEYS.put(apiKey, JSON.stringify(keyData));

    return json({ 
      api_key: apiKey, 
      tier,
      max_requests: parseInt(
        tier === 'free' ? env.MAX_FREE_REQUESTS :
        tier === 'pro' ? env.MAX_PRO_REQUESTS :
        env.MAX_SCALE_REQUESTS
      )
    }, { headers: corsHeaders });
  } catch (err) {
    return error(500, 'Failed to create API key');
  }
});

export default {
  fetch: router.handle,
};