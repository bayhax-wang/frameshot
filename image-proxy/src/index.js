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
    
    // Serve images from R2
    if (url.pathname.startsWith('/thumbnails/')) {
      const key = url.pathname.slice(1); // Remove leading slash
      
      try {
        const object = await env.THUMBNAILS.get(key);
        
        if (object === null) {
          return new Response('Image not found', { status: 404 });
        }
        
        // Get file extension to determine content type
        const ext = key.split('.').pop().toLowerCase();
        const contentType = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg', 
          'png': 'image/png',
          'webp': 'image/webp'
        }[ext] || 'application/octet-stream';
        
        const headers = new Headers();
        headers.set('Content-Type', contentType);
        headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        
        // Handle CORS
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Allow-Headers', 'Content-Type');
        
        return new Response(object.body, { headers });
        
      } catch (error) {
        console.error('Error serving image:', error);
        return new Response('Internal Server Error', { status: 500 });
      }
    }
    
    return new Response('Not Found', { status: 404 });
  },
};