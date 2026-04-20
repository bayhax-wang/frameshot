import { Container, getContainer } from "@cloudflare/containers";

export class FrameshotContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "30m";
}

// ============ Auth ============
async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid API key', status: 401 };
  }
  const apiKey = authHeader.substring(7);
  const keyData = await env.FRAMESHOT_KEYS.get(apiKey);
  if (!keyData) return { error: 'Invalid API key', status: 401 };

  const parsedKey = JSON.parse(keyData);
  const limits = { free: 50, pro: 5000, scale: 50000 };
  if (parsedKey.usage >= (limits[parsedKey.tier] || 50)) {
    return { error: 'Usage limit exceeded', status: 429 };
  }
  return { key: parsedKey, apiKeyStr: apiKey };
}

// ============ Helpers ============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function corsJson(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
function corsError(status, message) {
  return corsJson({ error: message }, status);
}

const TTL_BY_TIER = {
  free: 7 * 24 * 3600,
  pro: 30 * 24 * 3600,
  scale: 90 * 24 * 3600,
};

const IMAGE_PROXY_BASE = 'https://frameshot-images.vod-mates.workers.dev';

// ============ Key management (proxied from API worker or direct) ============
async function handleKeyRequest(request, env) {
  const url = new URL(request.url);
  
  // POST /api/v1/keys/request — send verification code
  if (url.pathname === '/api/v1/keys/request' && request.method === 'POST') {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return corsError(400, 'Valid email is required');
    }
    const existingKey = await env.FRAMESHOT_KEYS.get(`email:${email}`);
    if (existingKey) {
      return corsError(409, 'This email already has an API key. Check your inbox for the original email.');
    }

    // Rate limit
    const rlKey = `ratelimit:${email}`;
    const rlData = await env.FRAMESHOT_KEYS.get(rlKey);
    if (rlData) {
      const rl = JSON.parse(rlData);
      if (rl.count >= 3) return corsError(429, 'Too many requests. Please try again later.');
      rl.count += 1;
      await env.FRAMESHOT_KEYS.put(rlKey, JSON.stringify(rl), { expirationTtl: 3600 });
    } else {
      await env.FRAMESHOT_KEYS.put(rlKey, JSON.stringify({ count: 1 }), { expirationTtl: 3600 });
    }

    const code = Array.from(crypto.getRandomValues(new Uint8Array(3)))
      .map(b => (b % 10).toString()).join('').padEnd(6, '0').slice(0, 6);

    await env.FRAMESHOT_KEYS.put(`verify:${email}`, JSON.stringify({
      code, email, createdAt: Date.now(), attempts: 0,
    }), { expirationTtl: 600 });

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Frameshot <noreply@team.kaze.ai>',
        to: [email],
        subject: 'Your Frameshot API Verification Code',
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#6366f1;font-size:24px">Frameshot</h1>
          <p style="color:#666">Your verification code:</p>
          <div style="background:#f4f4f5;border-radius:12px;padding:24px;text-align:center;margin:24px 0">
            <span style="font-size:36px;font-weight:bold;letter-spacing:8px;color:#18181b">${code}</span>
          </div>
          <p style="color:#999;font-size:14px">This code expires in 10 minutes.</p>
        </div>`,
      }),
    });
    if (!emailRes.ok) return corsError(500, 'Failed to send verification email.');
    return corsJson({ success: true, message: 'Verification code sent to your email' });
  }

  // POST /api/v1/keys — verify code + create key
  if (url.pathname === '/api/v1/keys' && request.method === 'POST') {
    const body = await request.json();
    const email = body.email?.trim().toLowerCase();
    const code = body.code?.trim();
    const tier = body.tier || 'free';
    if (!email || !code) return corsError(400, 'Email and verification code are required');

    const existingKey = await env.FRAMESHOT_KEYS.get(`email:${email}`);
    if (existingKey) return corsError(409, 'This email already has an API key.');

    const verifyData = await env.FRAMESHOT_KEYS.get(`verify:${email}`);
    if (!verifyData) return corsError(400, 'Verification code expired. Please request a new one.');

    const verification = JSON.parse(verifyData);
    if (verification.attempts >= 5) {
      await env.FRAMESHOT_KEYS.delete(`verify:${email}`);
      return corsError(429, 'Too many failed attempts. Please request a new code.');
    }
    if (verification.code !== code) {
      verification.attempts += 1;
      await env.FRAMESHOT_KEYS.put(`verify:${email}`, JSON.stringify(verification), { expirationTtl: 600 });
      return corsError(400, `Invalid code. ${5 - verification.attempts} attempts remaining.`);
    }

    const apiKey = 'fs_' + Array.from(crypto.getRandomValues(new Uint8Array(24)))
      .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 32);

    await env.FRAMESHOT_KEYS.put(apiKey, JSON.stringify({ tier, usage: 0, resetDate: new Date().toISOString(), email }));
    await env.FRAMESHOT_KEYS.put(`email:${email}`, apiKey);
    await env.FRAMESHOT_KEYS.delete(`verify:${email}`);

    // Send key via email
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Frameshot <noreply@team.kaze.ai>',
        to: [email],
        subject: 'Your Frameshot API Key',
        html: `<div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
          <h1 style="color:#6366f1">Frameshot</h1>
          <p style="color:#666">Your API key:</p>
          <div style="background:#f4f4f5;border-radius:12px;padding:20px;margin:16px 0">
            <code style="font-size:16px;color:#6366f1;word-break:break-all">${apiKey}</code>
          </div>
          <p style="color:#666;font-size:14px"><strong>Plan:</strong> ${tier} &nbsp; <strong>Limit:</strong> ${tier === 'free' ? '50' : tier === 'pro' ? '5,000' : '50,000'}/month</p>
          <p style="color:#999;font-size:13px">Keep this key safe.</p>
        </div>`,
      }),
    });

    const limits = { free: 50, pro: 5000, scale: 50000 };
    return corsJson({ api_key: apiKey, tier, max_requests: limits[tier] || 50 });
  }

  return null; // not a key route
}

// ============ Main ============
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Health
    if (url.pathname === '/health') {
      return corsJson({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Key management routes
    if (url.pathname.startsWith('/api/v1/keys')) {
      const keyResponse = await handleKeyRequest(request, env);
      if (keyResponse) return keyResponse;
    }

    // Extract frame
    if ((url.pathname === '/extract' || url.pathname === '/api/v1/extract') && request.method === 'POST') {
      try {
        const authResult = await authenticate(request, env);
        if (authResult.error) return corsError(authResult.status, authResult.error);

        // Parse query params
        const persist = url.searchParams.get('persist');  // true | permanent | (absent = default store with TTL)
        const raw = url.searchParams.get('raw');          // true = return binary instead of JSON

        const sessionId = 'default';
        const containerInstance = getContainer(env.FRAMESHOT_CONTAINER, sessionId);

        // Normalize body: video_url → url for container express
        let forwardBody = request.body;
        const ct = request.headers.get('Content-Type') || '';
        if (ct.includes('application/json')) {
          const body = await request.json();
          if (body.video_url && !body.url) {
            body.url = body.video_url;
            delete body.video_url;
          }
          forwardBody = JSON.stringify(body);
        }

        const clonedRequest = new Request('https://container/extract', {
          method: 'POST',
          headers: { 'Content-Type': ct || 'application/json' },
          body: forwardBody,
        });
        const response = await containerInstance.fetch(clonedRequest);

        if (!response.ok) {
          const errText = await response.text();
          return corsError(response.status, `Extraction failed: ${errText.slice(0, 200)}`);
        }

        const result = await response.json();
        if (!result.success || !result.image_data) return corsJson(result);

        const imageBuffer = Uint8Array.from(atob(result.image_data), c => c.charCodeAt(0));
        const mimeType = `image/${result.format || 'jpg'}`;
        const tier = authResult.key.tier || 'free';

        // Update usage
        authResult.key.usage += 1;
        await env.FRAMESHOT_KEYS.put(authResult.apiKeyStr, JSON.stringify(authResult.key));

        // Determine TTL
        const isPermanent = persist === 'permanent';
        const ttlSeconds = isPermanent ? 0 : (TTL_BY_TIER[tier] || TTL_BY_TIER.free);
        const expiresAt = isPermanent ? 'never' : new Date(Date.now() + ttlSeconds * 1000).toISOString();

        // Default behavior: store to R2 + return JSON with URL
        // persist=false: skip R2, return binary
        if (persist === 'false' || raw === 'true') {
          // Raw binary mode — no R2
          return new Response(imageBuffer, {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': mimeType,
              'X-Image-Size': String(result.size),
              'Content-Disposition': `inline; filename="${result.filename}"`,
            },
          });
        }

        // Store to R2
        const key = `thumbnails/${result.filename}`;
        await env.THUMBNAILS.put(key, imageBuffer, {
          httpMetadata: { contentType: mimeType },
          customMetadata: { tier, expiresAt, createdAt: new Date().toISOString() },
        });

        const thumbnailUrl = `${IMAGE_PROXY_BASE}/${key}`;

        // Return JSON with URL
        return corsJson({
          thumbnail_url: thumbnailUrl,
          size: result.size,
          format: result.format,
          expires_at: expiresAt,
        });

      } catch (error) {
        console.error('Processing error:', error.message, error.stack);
        return corsError(500, 'Processing failed: ' + error.message);
      }
    }

    return corsError(404, 'Not Found');
  },

  // Cron: keepalive + R2 cleanup
  async scheduled(event, env, ctx) {
    try {
      const sessionId = 'default';
      const containerInstance = getContainer(env.FRAMESHOT_CONTAINER, sessionId);
      await containerInstance.fetch(new Request('https://container/health'));

      // Cleanup expired R2 objects
      const listed = await env.THUMBNAILS.list({ limit: 100, prefix: 'thumbnails/' });
      const now = new Date();
      for (const obj of listed.objects) {
        const head = await env.THUMBNAILS.head(obj.key);
        if (head?.customMetadata?.expiresAt && head.customMetadata.expiresAt !== 'never') {
          if (now > new Date(head.customMetadata.expiresAt)) {
            await env.THUMBNAILS.delete(obj.key);
          }
        }
      }
    } catch (e) {
      console.error('Scheduled task error:', e);
    }
  },
};
