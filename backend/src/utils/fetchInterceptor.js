// Interceptor para debuggear peticiones fetch
const originalFetch = window.fetch;

window.fetch = async function(...args) {
  const [resource, config] = args;
  
  // Log the request
  console.log(`🚀 Request: ${config?.method || 'GET'} ${resource}`, config);
  
  try {
    // Make the original request
    const response = await originalFetch(...args);
    
    // Clone the response to log it (because response body can only be consumed once)
    const responseClone = response.clone();
    
    // Try to parse and log the response body
    try {
      const body = await responseClone.json();
      console.log(`✅ Response: ${response.status} ${resource}`, body);
    } catch (e) {
      console.log(`✅ Response: ${response.status} ${resource} (no JSON body)`);
    }
    
    return response;
  } catch (error) {
    // Log errors
    console.error(`❌ Fetch Error: ${resource}`, error);
    throw error;
  }
};

export default {}; // Just to have something to import