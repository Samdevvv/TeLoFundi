// src/utils/apiConfig.js

// Configuración centralizada de la API
const API_CONFIG = {
  // URL base de la API - ajusta según tu entorno
  BASE_URL: 'http://localhost:5000',
  
  // Endpoints de autenticación
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    PROFILE_REGISTER: '/api/auth/profile/register',
    AGENCY_REGISTER: '/api/auth/agency/register',
    GOOGLE_AUTH: '/api/auth/google',
    REFRESH_TOKEN: '/api/auth/refresh-token',
    LOGOUT: '/api/auth/logout',
    FORGOT_PASSWORD: '/api/auth/forgot-password',
    RESET_PASSWORD: '/api/auth/reset-password',
  },
  
  // Headers comunes para todas las peticiones
  getHeaders: (includeToken = true) => {
    const headers = {
      'Content-Type': 'application/json',
    };
    
    if (includeToken) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    return headers;
  },
  
  // Función para hacer las peticiones fetch
  fetchApi: async (endpoint, options = {}) => {
    try {
      const url = `${API_CONFIG.BASE_URL}${endpoint}`;
      const includeToken = options.includeToken !== false;
      
      const fetchOptions = {
        method: options.method || 'GET',
        headers: {
          ...API_CONFIG.getHeaders(includeToken),
          ...options.headers
        },
        ...options
      };
      
      // No podemos incluir 'includeToken' en las opciones de fetch
      if (fetchOptions.includeToken) delete fetchOptions.includeToken;
      
      console.log(`📡 Fetching: ${fetchOptions.method} ${url}`, fetchOptions);
      
      const response = await fetch(url, fetchOptions);
      
      // Log para debugging
      console.log(`📡 Response: ${response.status} from ${url}`);
      
      // Si el status es 401 (No autorizado) y tenemos un refreshToken,
      // intentamos refrescar el token y reintentamos la petición
      if (response.status === 401 && localStorage.getItem('refreshToken')) {
        const refreshed = await API_CONFIG.refreshToken();
        
        if (refreshed) {
          // Actualizamos el header con el nuevo token
          fetchOptions.headers = {
            ...API_CONFIG.getHeaders(includeToken),
            ...options.headers
          };
          
          // Reintentamos la petición
          return fetch(url, fetchOptions);
        }
      }
      
      return response;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },
  
  // Función para refrescar el token
  refreshToken: async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      
      if (!refreshToken) return false;
      
      const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.AUTH.REFRESH_TOKEN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken })
      });
      
      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('accessToken', data.accessToken);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    }
  }
};

export default API_CONFIG;