import { Router, json, error } from 'itty-router';

export interface Env {
  FRAMESHOT_KEYS: KVNamespace;
  THUMBNAILS: R2Bucket;
  CONTAINER: Fetcher;
  MAX_FREE_REQUESTS: string;
  MAX_PRO_REQUESTS: string;
  MAX_SCALE_REQUESTS: string;
  RESEND_API_KEY: string;
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
  email?: string;
}

interface EmailVerification {
  code: string;
  email: string;
  createdAt: number;
  attempts: number;
}

const router = Router();

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Wrap response with CORS
function corsJson(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function corsError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Rate limiting and authentication middleware
async function authenticate(request: Request, env: Env): Promise<ApiKey | Response> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return corsError(401, 'Missing or invalid API key');
  }

  const apiKey = authHeader.substring(7);
  const keyData = await env.FRAMESHOT_KEYS.get(apiKey);
  
  if (!keyData) {
    return corsError(401, 'Invalid API key');
  }

  const parsedKey: ApiKey = JSON.parse(keyData);
  
  const maxRequests = parseInt(
    parsedKey.tier === 'free' ? env.MAX_FREE_REQUESTS :
    parsedKey.tier === 'pro' ? env.MAX_PRO_REQUESTS :
    env.MAX_SCALE_REQUESTS
  );

  if (parsedKey.usage >= maxRequests) {
    return corsError(429, 'Usage limit exceeded');
  }

  return parsedKey;
}

// Handle preflight requests
router.options('*', () => new Response(null, { headers: corsHeaders }));

// Health check
router.get('/health', () => corsJson({ status: 'ok', timestamp: new Date().toISOString() }));

// ============ Email Verification Flow ============

// Step 1: Request verification code
router.post('/api/v1/keys/request', async (request, env: Env) => {
  try {
    const body = await request.json() as { email?: string };
    const email = body.email?.trim().toLowerCase();

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return corsError(400, 'Valid email is required');
    }

    // Check if this email already has a key
    const existingKey = await env.FRAMESHOT_KEYS.get(`email:${email}`);
    if (existingKey) {
      return corsError(409, 'This email already has an API key. Check your inbox for the original email, or contact support.');
    }

    // Rate limit: max 3 verification requests per email per hour
    const rateLimitKey = `ratelimit:${email}`;
    const rateLimitData = await env.FRAMESHOT_KEYS.get(rateLimitKey);
    if (rateLimitData) {
      const rl = JSON.parse(rateLimitData);
      if (rl.count >= 3) {
        return corsError(429, 'Too many requests. Please try again later.');
      }
      rl.count += 1;
      await env.FRAMESHOT_KEYS.put(rateLimitKey, JSON.stringify(rl), { expirationTtl: 3600 });
    } else {
      await env.FRAMESHOT_KEYS.put(rateLimitKey, JSON.stringify({ count: 1 }), { expirationTtl: 3600 });
    }

    // Generate 6-digit code
    const code = Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map(b => (b % 10).toString())
      .join('')
      .padEnd(6, '0')
      .slice(0, 6);

    // Store verification (expires in 10 minutes)
    const verification: EmailVerification = {
      code,
      email,
      createdAt: Date.now(),
      attempts: 0,
    };
    await env.FRAMESHOT_KEYS.put(`verify:${email}`, JSON.stringify(verification), { expirationTtl: 600 });

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Frameshot <noreply@team.kaze.ai>',
        to: [email],
        subject: 'Your Frameshot API Verification Code',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #6366f1; font-size: 24px; margin-bottom: 8px;">Frameshot</h1>
            <p style="color: #666; font-size: 16px; margin-bottom: 32px;">Your verification code:</p>
            <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #18181b;">${code}</span>
            </div>
            <p style="color: #999; font-size: 14px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      }),
    });

    if (!emailResponse.ok) {
      console.error('Resend error:', await emailResponse.text());
      return corsError(500, 'Failed to send verification email. Please try again.');
    }

    return corsJson({ success: true, message: 'Verification code sent to your email' });
  } catch (err) {
    console.error('Request key error:', err);
    return corsError(500, 'Internal server error');
  }
});

// Step 2: Verify code and create API key
router.post('/api/v1/keys', async (request, env: Env) => {
  try {
    const body = await request.json() as { email?: string; code?: string; tier?: string };
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();
    const tier = (body.tier || 'free') as 'free' | 'pro' | 'scale';

    if (!email || !code) {
      return corsError(400, 'Email and verification code are required');
    }

    // Check if email already has a key
    const existingKey = await env.FRAMESHOT_KEYS.get(`email:${email}`);
    if (existingKey) {
      return corsError(409, 'This email already has an API key.');
    }

    // Get verification data
    const verifyData = await env.FRAMESHOT_KEYS.get(`verify:${email}`);
    if (!verifyData) {
      return corsError(400, 'Verification code expired or not found. Please request a new one.');
    }

    const verification: EmailVerification = JSON.parse(verifyData);

    // Check attempts (max 5)
    if (verification.attempts >= 5) {
      await env.FRAMESHOT_KEYS.delete(`verify:${email}`);
      return corsError(429, 'Too many failed attempts. Please request a new code.');
    }

    // Verify code
    if (verification.code !== code) {
      verification.attempts += 1;
      await env.FRAMESHOT_KEYS.put(`verify:${email}`, JSON.stringify(verification), { expirationTtl: 600 });
      return corsError(400, `Invalid verification code. ${5 - verification.attempts} attempts remaining.`);
    }

    // Generate API key
    const apiKey = 'fs_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(36).padStart(2, '0'))
      .join('')
      .slice(0, 32);

    const keyData: ApiKey = {
      tier,
      usage: 0,
      resetDate: new Date().toISOString(),
      email,
    };

    // Store: key -> data, email -> key (for dedup)
    await env.FRAMESHOT_KEYS.put(apiKey, JSON.stringify(keyData));
    await env.FRAMESHOT_KEYS.put(`email:${email}`, apiKey);

    // Clean up verification
    await env.FRAMESHOT_KEYS.delete(`verify:${email}`);

    // Send API key via email too
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Frameshot <noreply@team.kaze.ai>',
        to: [email],
        subject: 'Your Frameshot API Key',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #6366f1; font-size: 24px; margin-bottom: 8px;">Frameshot</h1>
            <p style="color: #666; font-size: 16px; margin-bottom: 24px;">Your API key is ready:</p>
            <div style="background: #f4f4f5; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
              <code style="font-size: 16px; color: #6366f1; word-break: break-all;">${apiKey}</code>
            </div>
            <p style="color: #666; font-size: 14px; margin-bottom: 8px;"><strong>Plan:</strong> ${tier.charAt(0).toUpperCase() + tier.slice(1)}</p>
            <p style="color: #666; font-size: 14px; margin-bottom: 24px;"><strong>Limit:</strong> ${tier === 'free' ? '50' : tier === 'pro' ? '5,000' : '50,000'} API calls/month</p>
            <p style="color: #999; font-size: 13px;">Keep this key safe. Do not share it publicly.</p>
            <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 24px 0;" />
            <p style="color: #999; font-size: 13px;">API Docs: <a href="https://frameshot-web.vod-mates.workers.dev/#docs" style="color: #6366f1;">frameshot-web.vod-mates.workers.dev</a></p>
          </div>
        `,
      }),
    });

    return corsJson({
      api_key: apiKey,
      tier,
      max_requests: parseInt(
        tier === 'free' ? env.MAX_FREE_REQUESTS :
        tier === 'pro' ? env.MAX_PRO_REQUESTS :
        env.MAX_SCALE_REQUESTS
      ),
    });
  } catch (err) {
    console.error('Create key error:', err);
    return corsError(500, 'Failed to create API key');
  }
});

// ============ Frame Extraction ============

// /api/v1/extract — proxy to container worker via Service Binding
// Container worker handles auth, extraction, R2 upload, and usage tracking
router.post('/api/v1/extract', async (request, env: Env) => {
  try {
    // Normalize: if JSON body has video_url, rewrite to url for container
    const contentType = request.headers.get('Content-Type') || '';
    let forwardBody: BodyInit;
    let forwardHeaders: Record<string, string> = {
      'Authorization': request.headers.get('Authorization') || '',
    };

    if (contentType.includes('application/json')) {
      const body = await request.json() as any;
      // Normalize video_url -> url
      const url = body.url || body.video_url;
      forwardBody = JSON.stringify({
        url,
        timestamp: body.timestamp || 'auto',
        format: body.format || 'jpg',
        width: body.width || 1280,
      });
      forwardHeaders['Content-Type'] = 'application/json';
    } else {
      forwardBody = await request.arrayBuffer();
      forwardHeaders['Content-Type'] = contentType;
    }

    const containerResponse = await env.CONTAINER.fetch('https://container/extract', {
      method: 'POST',
      body: forwardBody,
      headers: forwardHeaders,
    });

    // Pass through the response with CORS
    const respBody = await containerResponse.text();
    return new Response(respBody, {
      status: containerResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Extract proxy error:', err);
    return corsError(500, 'Internal server error');
  }
});

export default {
  fetch: router.handle,
};
