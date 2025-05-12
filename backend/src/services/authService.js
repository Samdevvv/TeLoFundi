// src/services/authService.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const prisma = new PrismaClient();

class AuthService {
  /**
   * Registra un nuevo usuario en el sistema
   * @param {Object} userData - Datos del usuario a registrar
   * @param {string} userData.email - Correo electrónico del usuario
   * @param {string} userData.password - Contraseña del usuario
   * @param {string} userData.username - Nombre de usuario
   * @param {string} role - Rol del usuario (cliente, perfil, agencia)
   * @returns {Promise<Object>} - Usuario creado
   */
  async registerUser(userData, role) {
    try {
      // Verificar si el correo ya existe
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        throw new Error('El correo electrónico ya está registrado');
      }

      // Hashear la contraseña
      const passwordHash = await bcrypt.hash(userData.password, 10);

      // Generar token de verificación de correo
      const emailVerificationToken = crypto.randomBytes(32).toString('hex');
      const emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas

      // Crear el usuario
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash,
          role,
          emailVerificationToken,
          emailVerificationExpires,
        },
      });

      // Crear el perfil específico según el rol
      let profile;
      if (role === 'cliente') {
        profile = await prisma.client.create({
          data: {
            id: user.id,
            username: userData.username,
            referralCode: crypto.randomBytes(6).toString('hex')
          },
        });
      } else if (role === 'perfil') {
        // Generar un slug a partir del username
        const slug = this.generateSlug(userData.username);
        
        profile = await prisma.profile.create({
          data: {
            id: user.id,
            displayName: userData.username,
            slug,
            gender: userData.gender || 'otro', // Valor predeterminado
            isIndependent: true
          },
        });
      } else if (role === 'agencia') {
        // Generar un slug a partir del nombre
        const slug = this.generateSlug(userData.username);

        profile = await prisma.agency.create({
          data: {
            id: user.id,
            name: userData.username,
            slug
          },
        });
      }

      // TODO: Enviar correo de verificación

      return { user, profile };
    } catch (error) {
      logger.error(`Error en registro de usuario: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Inicia sesión de un usuario
   * @param {string} email - Correo electrónico
   * @param {string} password - Contraseña
   * @returns {Promise<Object>} - Datos de sesión (tokens, rol, etc.)
   */
  async login(email, password) {
    try {
      // Buscar usuario por email
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        throw new Error('Credenciales inválidas');
      }

      // Verificar si la cuenta está bloqueada
      if (user.accountLocked && user.accountLockedUntil && new Date() < user.accountLockedUntil) {
        throw new Error('La cuenta está temporalmente bloqueada. Intente más tarde.');
      }

      // Verificar contraseña
      const passwordValid = user.passwordHash ? 
        await bcrypt.compare(password, user.passwordHash) : false;

      if (!passwordValid) {
        // Incrementar contador de intentos fallidos
        const failedAttempts = user.failedLoginAttempts + 1;
        
        // Configuración del sistema (valores predeterminados)
        const maxAttempts = 5;
        const lockoutMinutes = 30;
        
        // Actualizar intentos fallidos
        const updateData = {
          failedLoginAttempts: failedAttempts
        };
        
        // Bloquear cuenta si supera el máximo de intentos
        if (failedAttempts >= maxAttempts) {
          const lockUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
          updateData.accountLocked = true;
          updateData.accountLockedUntil = lockUntil;
        }
        
        await prisma.user.update({
          where: { id: user.id },
          data: updateData
        });
        
        throw new Error('Credenciales inválidas');
      }

      // Resetear intentos fallidos y bloqueo si el login es exitoso
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          accountLocked: false,
          accountLockedUntil: null,
          lastLogin: new Date(),
          lastIpAddress: user.ipAddress // Mantener el último IP registrado
        }
      });

      // Crear sesión
      const sessionToken = crypto.randomBytes(64).toString('hex');
      const session = await prisma.userSession.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
          ipAddress: user.ipAddress,
          userAgent: user.userAgent
        }
      });

      // Generar tokens JWT
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Obtener información adicional según el rol
      let profileInfo = null;
      if (user.role === 'cliente') {
        profileInfo = await prisma.client.findUnique({
          where: { id: user.id },
          select: {
            username: true,
            totalPoints: true,
            vipUntil: true,
            verifiedAccount: true
          }
        });
      } else if (user.role === 'perfil') {
        profileInfo = await prisma.profile.findUnique({
          where: { id: user.id },
          select: {
            displayName: true,
            slug: true,
            verificationStatus: true
          }
        });
      } else if (user.role === 'agencia') {
        profileInfo = await prisma.agency.findUnique({
          where: { id: user.id },
          select: {
            name: true,
            slug: true,
            verificationStatus: true
          }
        });
      }

      return {
        accessToken,
        refreshToken,
        sessionToken: session.token,
        userId: user.id,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
        profileInfo
      };
    } catch (error) {
      logger.error(`Error en login: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Inicia sesión o registra un usuario usando un proveedor externo (Google, Facebook, etc.)
   * @param {Object} userData - Datos del usuario del proveedor externo
   * @param {string} provider - Nombre del proveedor (google, facebook, etc.)
   * @param {string} [role='cliente'] - Rol para registro si es nuevo usuario
   * @returns {Promise<Object>} - Datos de sesión
   */
  async socialLogin(userData, provider, role = 'cliente') {
    try {
      // Buscar si existe una autenticación externa para este proveedor y ID
      const existingAuth = await prisma.externalAuth.findFirst({
        where: {
          provider,
          providerUserId: userData.id,
        },
        include: {
          user: true,
        },
      });

      let user;
      let isNewUser = false;

      if (existingAuth) {
        // Usuario existente, actualizar token
        await prisma.externalAuth.update({
          where: { id: existingAuth.id },
          data: {
            accessToken: userData.tokenId,
            updatedAt: new Date(),
          },
        });

        user = existingAuth.user;
      } else {
        // Verificar si existe un usuario con el mismo email
        const existingUser = await prisma.user.findUnique({
          where: { email: userData.email },
        });

        if (existingUser) {
          // Vincular la cuenta externa con el usuario existente
          await prisma.externalAuth.create({
            data: {
              userId: existingUser.id,
              provider,
              providerUserId: userData.id,
              providerEmail: userData.email,
              accessToken: userData.tokenId,
              profileData: userData,
            },
          });

          user = existingUser;
        } else {
          // Crear nuevo usuario
          isNewUser = true;

          // Crear usuario
          user = await prisma.user.create({
            data: {
              email: userData.email,
              emailVerified: true,
              role,
              profileImageUrl: userData.picture,
            },
          });

          // Crear autenticación externa
          await prisma.externalAuth.create({
            data: {
              userId: user.id,
              provider,
              providerUserId: userData.id,
              providerEmail: userData.email,
              accessToken: userData.tokenId,
              profileData: userData,
            },
          });

          // Crear perfil específico según el rol
          if (role === 'cliente') {
            await prisma.client.create({
              data: {
                id: user.id,
                username: userData.name || `user_${crypto.randomBytes(4).toString('hex')}`,
                referralCode: crypto.randomBytes(6).toString('hex')
              },
            });
          } else if (role === 'perfil') {
            // Para acompañantes, se genera un slug único
            const slug = this.generateSlug(userData.name || `profile_${crypto.randomBytes(4).toString('hex')}`);
            
            await prisma.profile.create({
              data: {
                id: user.id,
                displayName: userData.name || `Profile ${crypto.randomBytes(4).toString('hex')}`,
                slug,
                gender: 'otro', // Valor predeterminado
                isIndependent: true
              },
            });
          } else if (role === 'agencia') {
            // Para agencias, también se genera un slug único
            const slug = this.generateSlug(userData.name || `agency_${crypto.randomBytes(4).toString('hex')}`);
            
            await prisma.agency.create({
              data: {
                id: user.id,
                name: userData.name || `Agency ${crypto.randomBytes(4).toString('hex')}`,
                slug
              },
            });
          }
        }
      }

      // Crear sesión
      const sessionToken = crypto.randomBytes(64).toString('hex');
      const session = await prisma.userSession.create({
        data: {
          userId: user.id,
          token: sessionToken,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 horas
        }
      });

      // Generar tokens
      const accessToken = this.generateAccessToken(user);
      const refreshToken = this.generateRefreshToken(user);

      // Actualizar último login
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date()
        }
      });

      // Obtener información del perfil
      let profileInfo = null;
      if (user.role === 'cliente') {
        profileInfo = await prisma.client.findUnique({
          where: { id: user.id },
          select: {
            username: true,
            totalPoints: true,
            vipUntil: true,
            verifiedAccount: true
          }
        });
      } else if (user.role === 'perfil') {
        profileInfo = await prisma.profile.findUnique({
          where: { id: user.id },
          select: {
            displayName: true,
            slug: true,
            verificationStatus: true
          }
        });
      } else if (user.role === 'agencia') {
        profileInfo = await prisma.agency.findUnique({
          where: { id: user.id },
          select: {
            name: true,
            slug: true,
            verificationStatus: true
          }
        });
      }

      return {
        accessToken,
        refreshToken,
        sessionToken,
        userId: user.id,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
        profileInfo,
        status: isNewUser ? 'new_user' : 'existing_user'
      };
    } catch (error) {
      logger.error(`Error en login social: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Genera un token de acceso JWT
   * @param {Object} user - Usuario para el que se generará el token
   * @returns {string} - Token JWT
   */
  generateAccessToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        isVip: user.isVip,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRATION || '1h' }
    );
  }

  /**
   * Genera un token de refresco JWT
   * @param {Object} user - Usuario para el que se generará el token
   * @returns {string} - Token JWT
   */
  generateRefreshToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        tokenType: 'refresh'
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  /**
   * Verifica un token JWT
   * @param {string} token - Token JWT a verificar
   * @returns {Object} - Payload del token decodificado
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Refresca un token de acceso usando un token de refresco
   * @param {string} refreshToken - Token de refresco
   * @returns {Promise<Object>} - Nuevo token de acceso
   */
  async refreshAccessToken(refreshToken) {
    try {
      // Verificar el token de refresco
      const decoded = this.verifyToken(refreshToken);
      
      if (!decoded.sub || decoded.tokenType !== 'refresh') {
        throw new Error('Token de refresco inválido');
      }

      // Buscar el usuario
      const user = await prisma.user.findUnique({
        where: { id: decoded.sub },
      });

      if (!user || !user.isActive) {
        throw new Error('Usuario no encontrado o inactivo');
      }

      // Generar un nuevo token de acceso
      const newAccessToken = this.generateAccessToken(user);

      return {
        accessToken: newAccessToken,
      };
    } catch (error) {
      logger.error(`Error al refrescar token: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Cierra la sesión del usuario
   * @param {string} sessionToken - Token de sesión a cerrar
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async logout(sessionToken) {
    try {
      await prisma.userSession.update({
        where: { token: sessionToken },
        data: { isActive: false },
      });
      return true;
    } catch (error) {
      logger.error(`Error en logout: ${error.message}`, { error });
      return false;
    }
  }

  /**
   * Genera un slug a partir de un texto
   * @param {string} text - Texto para generar el slug
   * @returns {string} - Slug generado
   */
  generateSlug(text) {
    // Convertir a minúsculas, reemplazar espacios por guiones y eliminar caracteres especiales
    let slug = text.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\-]+/g, '')
      .replace(/\-\-+/g, '-')
      .trim();
    
    // Añadir un sufijo único para evitar colisiones
    slug = `${slug}-${crypto.randomBytes(4).toString('hex')}`;
    
    return slug;
  }

  /**
   * Actualiza metadatos del usuario (IP, User-Agent)
   * @param {string} email - Email del usuario
   * @param {Object} metadata - Metadatos a actualizar
   * @returns {Promise<Object>} - Usuario actualizado
   */
  async updateUserMetadata(email, metadata = {}) {
    try {
      const { ipAddress, userAgent } = metadata;
      
      // Actualizar usuario con la nueva información
      const user = await prisma.user.update({
        where: { email },
        data: {
          ...(ipAddress && { ipAddress }),
          ...(userAgent && { userAgent }),
        },
      });
      
      return user;
    } catch (error) {
      // Si el usuario no existe, no hacer nada
      if (error.code === 'P2025') {
        logger.warn(`Intento de actualizar metadatos para usuario inexistente: ${email}`);
        return null;
      }
      
      logger.error(`Error al actualizar metadatos del usuario: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Solicita un restablecimiento de contraseña
   * @param {string} email - Correo electrónico del usuario
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async requestPasswordReset(email) {
    try {
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        // No revelar si el usuario existe o no por seguridad
        return true;
      }

      // Generar token de restablecimiento
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpires = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1 hora

      // Actualizar usuario con el token
      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: resetToken,
          resetPasswordExpires: resetTokenExpires,
        },
      });

      // TODO: Enviar correo con el token

      return true;
    } catch (error) {
      logger.error(`Error en solicitud de restablecimiento: ${error.message}`, { error });
      throw error;
    }
  }

  /**
   * Restablece la contraseña con un token
   * @param {string} token - Token de restablecimiento
   * @param {string} newPassword - Nueva contraseña
   * @returns {Promise<boolean>} - Resultado de la operación
   */
  async resetPassword(token, newPassword) {
    try {
      // Buscar usuario con el token válido
      const user = await prisma.user.findFirst({
        where: {
          resetPasswordToken: token,
          resetPasswordExpires: {
            gt: new Date(),
          },
        },
      });

      if (!user) {
        throw new Error('Token inválido o expirado');
      }

      // Hashear la nueva contraseña
      const passwordHash = await bcrypt.hash(newPassword, 10);

      // Actualizar usuario
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        },
      });

      return true;
    } catch (error) {
      logger.error(`Error en restablecimiento de contraseña: ${error.message}`, { error });
      throw error;
    }
  }
}

module.exports = new AuthService();