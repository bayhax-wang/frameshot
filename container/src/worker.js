import { Container, getContainer } from "@cloudflare/containers";

export class FrameshotContainer extends Container {
  defaultPort = 8080; // Port the container is listening on
  sleepAfter = "10m"; // Stop the instance if requests not sent for 10 minutes
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ 
        status: 'ok', 
        timestamp: new Date().toISOString() 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract frame endpoint
    if (url.pathname === '/extract' && request.method === 'POST') {
      try {
        // Use a session ID for container instance
        // For simplicity, use a default session for now
        const sessionId = 'default';
        
        // Get the container instance
        const containerInstance = getContainer(env.FRAMESHOT_CONTAINER, sessionId);
        
        // Pass the request to the container instance
        const response = await containerInstance.fetch(request);
        
        // Process the response and upload to R2 if needed
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.image_data) {
            try {
              // Convert base64 to buffer
              const imageBuffer = Uint8Array.from(atob(result.image_data), c => c.charCodeAt(0));
              
              // Upload to R2
              const key = `thumbnails/${result.filename}`;
              await env.THUMBNAILS.put(key, imageBuffer, {
                httpMetadata: {
                  contentType: `image/${result.format}`
                }
              });
              
              // Generate public URL using image proxy Worker
              const thumbnailUrl = `https://frameshot-images.vod-mates.workers.dev/${key}`;
              
              return new Response(JSON.stringify({ 
                thumbnail_url: thumbnailUrl,
                size: result.size,
                format: result.format
              }), {
                headers: { 'Content-Type': 'application/json' }
              });
            } catch (uploadError) {
              console.error('R2 upload failed:', uploadError);
              return new Response(JSON.stringify({ 
                error: 'Upload to storage failed',
                details: uploadError.message
              }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          }
          
          return new Response(JSON.stringify(result), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        
        return response;
        
      } catch (error) {
        return new Response(JSON.stringify({ 
          error: 'Container processing failed',
          details: error.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  },
};