// src/services/googleAuthService.js

// Client ID de Google - REEMPLAZAR con tu ID real para producción
const GOOGLE_CLIENT_ID = '1051702199187-fcf13c2jfpab0r6g8ft3fjknio04ngcp.apps.googleusercontent.com';

class GoogleAuthService {
  constructor() {
    this.initialized = false;
    this.tokenClient = null;
  }

  /**
   * Carga el script de Google
   */
  loadGoogleScript() {
    return new Promise((resolve, reject) => {
      // Verificar si el script ya está cargado
      if (document.querySelector('script#google-gsi')) {
        console.log('Script de Google ya estaba cargado');
        resolve();
        return;
      }

      // Crear y añadir el script
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.id = 'google-gsi';
      script.async = true;
      script.defer = true;
      
      script.onload = () => {
        console.log('Script de Google cargado correctamente');
        resolve();
      };
      
      script.onerror = (error) => {
        console.error('Error al cargar el script de Google:', error);
        reject(new Error('No se pudo cargar la API de Google'));
      };
      
      document.head.appendChild(script);
    });
  }

  /**
   * Inicializa el servicio de Google
   */
  async initialize() {
    if (this.initialized && window.google && window.google.accounts) {
      console.log('Google Auth ya estaba inicializado');
      return;
    }

    try {
      await this.loadGoogleScript();
      
      // Esperar a que la API de Google esté disponible
      await new Promise(resolve => {
        const checkGoogleAPI = () => {
          if (window.google && window.google.accounts) {
            console.log('API de Google detectada');
            resolve();
          } else {
            console.log('Esperando API de Google...');
            setTimeout(checkGoogleAPI, 100);
          }
        };
        checkGoogleAPI();
      });
      
      this.initialized = true;
      console.log('Google Auth inicializado con éxito');
    } catch (error) {
      console.error('Error al inicializar el servicio de Google:', error);
      throw error;
    }
  }

  /**
   * Método principal de inicio de sesión con Google
   * Usa el método más moderno de Google Identity Services
   */
  async signIn() {
    try {
      // Asegurarse de que el servicio esté inicializado
      if (!this.initialized) {
        console.log('Inicializando Google Auth antes de iniciar sesión');
        await this.initialize();
      }

      // Verificar nuevamente que la API de Google esté disponible
      if (!window.google || !window.google.accounts) {
        console.error('La API de Google no está disponible después de la inicialización');
        throw new Error('La API de Google no está disponible');
      }

      return new Promise((resolve, reject) => {
        // Configurar cliente para la autenticación
        if (!this.tokenClient) {
          this.tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: 'email profile',
            callback: (tokenResponse) => {
              if (tokenResponse && tokenResponse.access_token) {
                // Obtener información del usuario con el token
                fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${tokenResponse.access_token}`)
                  .then(response => response.json())
                  .then(userInfo => {
                    resolve({
                      tokenId: tokenResponse.access_token,
                      user: {
                        id: userInfo.sub,
                        email: userInfo.email,
                        name: userInfo.name,
                        firstName: userInfo.given_name,
                        lastName: userInfo.family_name,
                        picture: userInfo.picture
                      }
                    });
                  })
                  .catch(error => {
                    console.error('Error al obtener información del usuario:', error);
                    reject(error);
                  });
              } else {
                reject(new Error('No se recibió token de acceso'));
              }
            },
            error_callback: (error) => {
              console.error('Error en la autenticación OAuth:', error);
              reject(new Error(`Error en OAuth: ${error.type}`));
            }
          });
        }

        // Solicitar el token (abre el popup)
        console.log('Solicitando token a Google...');
        this.tokenClient.requestAccessToken({prompt: 'select_account'});
      });
    } catch (error) {
      console.error('Error en el inicio de sesión con Google:', error);
      throw error;
    }
  }

  /**
   * Método alternativo que usa One Tap para iniciar sesión
   */
  async signInWithOneTap() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      return new Promise((resolve, reject) => {
        // Función para manejar la respuesta de Google
        const handleCredentialResponse = (response) => {
          if (response && response.credential) {
            // Decodificar la información del usuario del token JWT
            const userInfo = this.parseJwt(response.credential);
            
            resolve({
              tokenId: response.credential,
              user: {
                id: userInfo.sub,
                email: userInfo.email,
                name: userInfo.name,
                firstName: userInfo.given_name,
                lastName: userInfo.family_name,
                picture: userInfo.picture
              }
            });
          } else {
            reject(new Error('No se recibió credencial de Google'));
          }
        };

        // Configuración para One Tap
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true
        });

        // Mostrar el botón de One Tap
        window.google.accounts.id.renderButton(
          document.getElementById('google-button-container'), 
          { 
            theme: 'filled_blue', 
            size: 'large',
            width: '100%',
            text: 'continue_with'
          }
        );

        // También mostrar la interfaz de One Tap
        window.google.accounts.id.prompt((notification) => {
          if (notification.isNotDisplayed()) {
            console.warn('One Tap no se mostró:', notification.getNotDisplayedReason());
            // No rechazar aquí, ya que el botón renderizado aún funcionará
          } else if (notification.isSkippedMoment()) {
            console.warn('One Tap fue omitido:', notification.getSkippedReason());
          }
        });
      });
    } catch (error) {
      console.error('Error en One Tap:', error);
      throw error;
    }
  }

  /**
   * Método alternativo que usa redirección directa a OAuth
   */
  signInWithRedirect() {
    // Crear URL para OAuth 2.0
    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent('profile email');
    const responseType = 'token';
    
    // Construir URL de autorización
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=${responseType}&scope=${scope}`;
    
    // Redireccionar a Google
    window.location.href = authUrl;
  }

  /**
   * Decodifica el token JWT para obtener la información del usuario
   */
  parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error al decodificar el token JWT:', error);
      return {};
    }
  }

  /**
   * Cierra la sesión de Google
   */
  signOut() {
    if (window.google && window.google.accounts) {
      window.google.accounts.id.disableAutoSelect();
      // Revocar token si está disponible
      const token = localStorage.getItem('googleToken');
      if (token) {
        window.google.accounts.oauth2.revoke(token, () => {
          console.log('Token revocado');
        });
        localStorage.removeItem('googleToken');
      }
    }
  }

  /**
   * Método para simular la autenticación con el backend
   * En producción, esto se reemplazaría por una llamada fetch real
   */
  async authenticateWithBackend(tokenId, userType = 'cliente') {
    try {
      console.log(`Autenticando con backend (simulado): TokenID=${tokenId.substring(0, 15)}..., Tipo=${userType}`);
      
      // Simular una respuesta exitosa del backend
      return {
        success: true,
        userId: `google_${Math.floor(Math.random() * 10000)}`,
        tipoUsuario: userType,
        accessToken: `simulated_token_${Date.now()}`,
        refreshToken: `simulated_refresh_${Date.now()}`,
        status: Math.random() > 0.5 ? 'new_user' : 'existing_user'
      };
    } catch (error) {
      console.error('Error en autenticación con backend:', error);
      throw error;
    }
  }
}

export default new GoogleAuthService();