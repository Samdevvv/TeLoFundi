// src/api/auth/auth.controller.js
const authService = require('../../services/authService');
const logger = require('../../utils/logger');

/**
 * Controlador para gestionar las rutas de autenticación
 */
class AuthController {
  /**
   * Registra un nuevo usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async register(req, res) {
    try {
      const { email, password, username } = req.body;
      const role = 'cliente'; // Por defecto registramos como cliente
      
      // Validar datos requeridos
      if (!email || !password || !username) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos (email, password, username)',
        });
      }

      // Registrar el usuario
      const result = await authService.registerUser(
        { email, password, username },
        role
      );

      return res.status(201).json({
        success: true,
        message: 'Usuario registrado con éxito',
        userId: result.user.id,
      });
    } catch (error) {
      logger.error(`Error en registro: ${error.message}`, { error });
      
      // Manejar errores específicos
      if (error.message.includes('ya está registrado')) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error al registrar el usuario',
        error: error.message,
      });
    }
  }

  /**
   * Registra un nuevo perfil (acompañante)
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async registerProfile(req, res) {
    try {
      const { email, password, username, gender } = req.body;
      const role = 'perfil'; // Registro como perfil (acompañante)
      
      // Validar datos requeridos
      if (!email || !password || !username) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos (email, password, username)',
        });
      }

      // Registrar el usuario
      const result = await authService.registerUser(
        { email, password, username, gender },
        role
      );

      return res.status(201).json({
        success: true,
        message: 'Perfil registrado con éxito',
        userId: result.user.id,
        profileId: result.profile.id,
        slug: result.profile.slug,
      });
    } catch (error) {
      logger.error(`Error en registro de perfil: ${error.message}`, { error });
      
      // Manejar errores específicos
      if (error.message.includes('ya está registrado')) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error al registrar el perfil',
        error: error.message,
      });
    }
  }

  /**
   * Registra una nueva agencia
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async registerAgency(req, res) {
    try {
      const { email, password, name, description } = req.body;
      const role = 'agencia'; // Registro como agencia
      
      // Validar datos requeridos
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: 'Todos los campos son requeridos (email, password, name)',
        });
      }

      // Registrar la agencia
      const result = await authService.registerUser(
        { email, password, username: name, description },
        role
      );

      return res.status(201).json({
        success: true,
        message: 'Solicitud de registro de agencia enviada con éxito',
        userId: result.user.id,
        agencyId: result.profile.id,
        solicitudId: result.profile.id, // Mismo ID para mantener compatibilidad con el front
      });
    } catch (error) {
      logger.error(`Error en registro de agencia: ${error.message}`, { error });
      
      // Manejar errores específicos
      if (error.message.includes('ya está registrado')) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error al registrar la agencia',
        error: error.message,
      });
    }
  }

  /**
   * Inicia sesión de un usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async login(req, res) {
    try {
      const { email, password, rememberMe } = req.body;
      
      // Validar datos requeridos
      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email y contraseña son requeridos',
        });
      }

      // Capturar IP y User-Agent para seguridad
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];

      // Actualizar estos datos en el usuario para seguimiento
      await authService.updateUserMetadata(email, { ipAddress, userAgent });

      // Realizar el login
      const loginResult = await authService.login(email, password);

      // Configurar duración del token según rememberMe
      const tokenExpiration = rememberMe ? '7d' : '1d';

      return res.status(200).json({
        success: true,
        AccessToken: loginResult.accessToken,
        RefreshToken: loginResult.refreshToken,
        SessionToken: loginResult.sessionToken,
        UserId: loginResult.userId,
        Email: loginResult.email,
        TipoUsuario: loginResult.role,
        IsVip: loginResult.isVip,
        expiration: tokenExpiration,
        ProfileInfo: loginResult.profileInfo
      });
    } catch (error) {
      logger.error(`Error en login: ${error.message}`, { error });
      
      // Manejar errores específicos
      if (error.message.includes('Credenciales inválidas') || 
          error.message.includes('temporalmente bloqueada')) {
        return res.status(401).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Error al iniciar sesión',
        error: error.message,
      });
    }
  }

  /**
   * Inicia sesión con Google
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async googleLogin(req, res) {
    try {
      const { tokenId, userType = 'cliente' } = req.body;
      
      if (!tokenId) {
        return res.status(400).json({
          success: false,
          message: 'Token de Google es requerido',
        });
      }

      // Obtener datos del usuario desde el token
      // En un escenario real, verificaríamos el token con Google
      // Pero para simplificar usamos los datos que envía el cliente
      const userData = req.body.userData || {};
      
      // Iniciar sesión o registrar usuario con Google
      const result = await authService.socialLogin(
        {
          id: userData.id || `google_${Date.now()}`,
          email: userData.email,
          name: userData.name,
          picture: userData.picture,
          tokenId
        },
        'google',
        userType
      );

      return res.status(200).json({
        success: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        sessionToken: result.sessionToken,
        userId: result.userId,
        email: result.email,
        tipoUsuario: result.role,
        isVip: result.isVip,
        status: result.status,
        profileInfo: result.profileInfo
      });
    } catch (error) {
      logger.error(`Error en login con Google: ${error.message}`, { error });
      
      return res.status(500).json({
        success: false,
        message: 'Error al iniciar sesión con Google',
        error: error.message,
      });
    }
  }

  /**
   * Refresca el token de acceso
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Token de refresco requerido',
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);

      return res.status(200).json({
        success: true,
        accessToken: result.accessToken,
      });
    } catch (error) {
      logger.error(`Error al refrescar token: ${error.message}`, { error });
      
      return res.status(401).json({
        success: false,
        message: 'Error al refrescar el token',
        error: error.message,
      });
    }
  }

  /**
   * Cierra la sesión del usuario
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async logout(req, res) {
    try {
      const { sessionToken } = req.body;
      
      if (!sessionToken) {
        return res.status(400).json({
          success: false,
          message: 'Token de sesión requerido',
        });
      }

      const result = await authService.logout(sessionToken);

      return res.status(200).json({
        success: result,
        message: result ? 'Sesión cerrada con éxito' : 'Error al cerrar sesión',
      });
    } catch (error) {
      logger.error(`Error en logout: ${error.message}`, { error });
      
      return res.status(500).json({
        success: false,
        message: 'Error al cerrar sesión',
        error: error.message,
      });
    }
  }

  /**
   * Solicita un restablecimiento de contraseña
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async requestPasswordReset(req, res) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({
          success: false,
          message: 'Correo electrónico requerido',
        });
      }

      await authService.requestPasswordReset(email);

      // Siempre devolver éxito por seguridad, incluso si el email no existe
      return res.status(200).json({
        success: true,
        message: 'Si la dirección existe, recibirás un correo con instrucciones',
      });
    } catch (error) {
      logger.error(`Error al solicitar reset: ${error.message}`, { error });
      
      // Para no revelar si el email existe, siempre retornar éxito
      return res.status(200).json({
        success: true,
        message: 'Si la dirección existe, recibirás un correo con instrucciones',
      });
    }
  }

  /**
   * Restablece la contraseña con un token
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async resetPassword(req, res) {
    try {
      const { token, password } = req.body;
      
      if (!token || !password) {
        return res.status(400).json({
          success: false,
          message: 'Token y nueva contraseña son requeridos',
        });
      }

      const result = await authService.resetPassword(token, password);

      return res.status(200).json({
        success: result,
        message: 'Contraseña restablecida con éxito',
      });
    } catch (error) {
      logger.error(`Error al resetear contraseña: ${error.message}`, { error });
      
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }

  /**
   * Verifica un token de correo electrónico
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  async verifyEmail(req, res) {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token de verificación requerido',
        });
      }

      const result = await authService.verifyEmail(token);

      return res.status(200).json({
        success: true,
        message: 'Correo electrónico verificado con éxito',
      });
    } catch (error) {
      logger.error(`Error al verificar email: ${error.message}`, { error });
      
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  }
}

module.exports = new AuthController();