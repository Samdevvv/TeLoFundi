// src/components/googleAuthService.js
import { jwtDecode } from "jwt-decode";

// Configuración del servicio
const API_CONFIG = {
  BASE_URL: "http://localhost:5000",
  GOOGLE_CLIENT_ID: "679238023415-04u5ofnlmgu6ia4aicsnnaoa3v6sbho8.apps.googleusercontent.com" // Reemplazar con tu ID de cliente de Google
};

class GoogleAuthService {
  constructor() {
    this.googleAuth = null;
    this.initialized = false;
    this.googleScript = null;
  }

  /**
   * Inicializa la API de Google
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      // Evitar cargar múltiples scripts
      if (document.getElementById('google-auth-script')) {
        this.waitForGoogle(resolve, reject);
        return;
      }

      // Crear el script de Google
      this.googleScript = document.createElement('script');
      this.googleScript.id = 'google-auth-script';
      this.googleScript.src = 'https://accounts.google.com/gsi/client';
      this.googleScript.async = true;
      this.googleScript.defer = true;
      this.googleScript.onload = () => this.waitForGoogle(resolve, reject);
      this.googleScript.onerror = () => reject(new Error('Error al cargar la API de Google'));
      
      document.body.appendChild(this.googleScript);
    });
  }

  /**
   * Espera a que la API de Google esté lista
   */
  waitForGoogle(resolve, reject) {
    if (window.google && window.google.accounts) {
      this.initialized = true;
      console.log('Google Auth API cargada correctamente');
      resolve();
    } else {
      setTimeout(() => {
        if (window.google && window.google.accounts) {
          this.initialized = true;
          console.log('Google Auth API cargada correctamente (después de espera)');
          resolve();
        } else {
          console.error('No se pudo cargar la API de Google después de esperar');
          reject(new Error('Tiempo de espera agotado para cargar la API de Google'));
        }
      }, 1000);
    }
  }

  /**
   * Genera un nonce aleatorio para seguridad
   */
  generateNonce() {
    const array = new Uint8Array(16);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).substr(-2)).join('');
  }

  /**
   * Método principal: Usar redirección en lugar de popup
   * Este método reemplaza completamente signIn() para evitar problemas de popup
   */
  signIn() {
    return this.signInWithRedirect();
  }

  /**
   * Método para autenticación mediante redirección
   */
  signInWithRedirect() {
    if (!this.initialized) {
      this.initialize().then(() => {
        this._doRedirect();
      }).catch(error => {
        console.error('Error al inicializar Google Auth para redirección:', error);
        throw error;
      });
    } else {
      this._doRedirect();
    }
  }

  /**
   * Método interno para realizar la redirección
   */
  _doRedirect() {
    try {
      // Crear URL de autenticación para redirección
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const scope = 'email profile';
      const responseType = 'token id_token';
      const prompt = 'select_account';
      
      // Añadir un nonce para seguridad
      const nonce = this.generateNonce();
      localStorage.setItem('auth_nonce', nonce);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${
        API_CONFIG.GOOGLE_CLIENT_ID
      }&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=${responseType}&scope=${encodeURIComponent(
        scope
      )}&prompt=${prompt}&nonce=${nonce}`;
      
      // Guardar el estado actual para redirigir después de la autenticación
      localStorage.setItem('authRedirectState', window.location.pathname);
      
      // Redirigir a la página de autenticación de Google
      window.location.href = authUrl;
    } catch (error) {
      console.error('Error al redirigir a Google Auth:', error);
      throw error;
    }
  }

  /**
   * Autentica con el backend
   * @param {string} tokenId - Token de Google
   * @param {string} userType - Tipo de usuario (cliente, perfil, agencia)
   */
  async authenticateWithBackend(tokenId, userType = 'cliente') {
    try {
      // Opcionalmente, recuperar datos del usuario del token
      let userData = null;
      try {
        const decodedToken = jwtDecode(tokenId);
        userData = {
          id: decodedToken.sub,
          email: decodedToken.email,
          name: decodedToken.name,
          picture: decodedToken.picture
        };
      } catch (error) {
        console.warn('No se pudo decodificar el token:', error);
      }

      // Determinar la ruta adecuada basada en si es registro o login
      const endpoint = '/api/auth/google';

      // Preparar el payload
      const payload = {
        tokenId,
        userType,
        userData
      };

      // Hacer la solicitud al backend
      const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Error ${response.status}: No se pudo autenticar con el servidor`);
      }

      const authData = await response.json();
      
      // Transformar la respuesta del backend a un formato estándar
      return {
        success: authData.success === true || !!authData.accessToken,
        accessToken: authData.AccessToken || authData.accessToken,
        refreshToken: authData.RefreshToken || authData.refreshToken,
        sessionToken: authData.SessionToken || authData.sessionToken,
        userId: authData.UserId || authData.userId,
        tipoUsuario: authData.TipoUsuario || authData.tipoUsuario || authData.role,
        isVip: authData.IsVip || authData.isVip || false,
        profileInfo: authData.ProfileInfo || authData.profileInfo,
        status: authData.status || 'existing_user'
      };
    } catch (error) {
      console.error('Error al autenticar con el backend:', error);
      throw error;
    }
  }

  /**
   * Procesa la redirección de autenticación
   * Debe llamarse cuando se carga la página de redirección
   */
  async handleRedirect() {
    try {
      const params = new URLSearchParams(window.location.hash.substring(1));
      const idToken = params.get('id_token');
      const accessToken = params.get('access_token');
      
      if (!idToken) {
        throw new Error('No se encontró un token de ID en la redirección');
      }
      
      // Decodificar el token
      const decodedToken = jwtDecode(idToken);
      
      // Obtener y verificar el nonce
      const storedNonce = localStorage.getItem('auth_nonce');
      if (storedNonce && decodedToken.nonce && decodedToken.nonce !== storedNonce) {
        console.error('Error de seguridad: El nonce no coincide');
        throw new Error('Error de verificación de seguridad. Por favor, intenta nuevamente.');
      }
      
      // Limpiar el nonce almacenado
      localStorage.removeItem('auth_nonce');
      
      const user = {
        id: decodedToken.sub,
        email: decodedToken.email,
        name: decodedToken.name,
        picture: decodedToken.picture
      };
      
      // Recuperar el estado para redirigir después de procesar
      const redirectState = localStorage.getItem('authRedirectState') || '/';
      localStorage.removeItem('authRedirectState');
      
      return {
        tokenId: idToken,
        accessToken: accessToken,
        user,
        redirectPath: redirectState
      };
    } catch (error) {
      console.error('Error al procesar la redirección:', error);
      throw error;
    }
  }
}

// Exportar una instancia única del servicio
export default new GoogleAuthService();