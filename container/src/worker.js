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
          
          // If the container returned a local file path or buffer,
          // we would upload it to R2 here and update the URL
          // For now, pass through the response
          
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