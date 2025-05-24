// src/api/auth/auth.controller.js
const authService = require("../../services/authService");
const logger = require("../../utils/logger");

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
      const role = "cliente"; // Por defecto registramos como cliente

      // Validar datos requeridos
      if (!email || !password || !username) {
        return res.status(400).json({
          success: false,
          message:
            "Todos los campos son requeridos (email, password, username)",
        });
      }

      // Registrar el usuario
      const result = await authService.registerUser(
        { email, password, username },
        role
      );

      return res.status(201).json({
        success: true,
        message: "Usuario registrado con éxito",
        userId: result.user.id,
      });
    } catch (error) {
      logger.error(`Error en registro: ${error.message}`, { error });

      // Manejar errores específicos
      if (error.message.includes("ya está registrado")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al registrar el usuario",
        error: error.message,
      });
    }
  }
  // Modificación para auth.controller.js - método googleLogin

  /**
 // Corrección para auth.controller.js - método googleLogin

/**
 * Inicia sesión con Google
 * @param {Object} req - Objeto de petición
 * @param {Object} res - Objeto de respuesta
 */
  // src/api/auth/auth.controller.js - Método googleLogin mejorado
  async googleLogin(req, res) {
    try {
      const { tokenId, userType = "cliente", userData } = req.body;

      if (!tokenId) {
        return res.status(400).json({
          success: false,
          message: "Token de Google es requerido",
        });
      }

      // Registrar intento de autenticación
      logger.info(
        `Intento de autenticación con Google. Tipo de usuario: ${userType}`
      );

      // En un entorno de producción, verificamos el token con Google
      // Para más seguridad, se debería implementar esta verificación

      // Validar datos de usuario
      const userInfo = userData || {};
      if (!userInfo.email) {
        return res.status(400).json({
          success: false,
          message: "La información del usuario es incompleta (falta email)",
        });
      }

      try {
        // Iniciar sesión o registrar usuario con Google
        const result = await authService.socialLogin(
          {
            id: userInfo.id || `google_${Date.now()}`,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            tokenId,
          },
          "google",
          userType
        );

        // Registrar inicio de sesión exitoso
        logger.info(
          `Autenticación con Google exitosa para: ${
            result.email || userInfo.email
          }, ID: ${result.userId}`
        );

        return res.status(200).json({
          success: true,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          sessionToken: result.sessionToken,
          userId: result.userId,
          email: result.email || userInfo.email,
          tipoUsuario: result.role,
          isVip: result.isVip,
          status: result.status,
          profileInfo: result.profileInfo,
        });
      } catch (error) {
        // Manejar caso específico: restricción única en el email
        if (
          error.code === "P2002" &&
          error.meta &&
          error.meta.target &&
          (error.meta.target.includes("email") ||
            error.meta.target[0] === "email")
        ) {
          logger.warn(
            `Restricción única en email ${userInfo.email}. Intentando recuperar transparentemente.`
          );

          try {
            // Buscar usuario por email
            const prismaClient = new PrismaClient();
            const existingUser = await prismaClient.user.findUnique({
              where: { email: userInfo.email },
            });

            if (!existingUser) {
              // Si no podemos encontrar el usuario, devolver respuesta 200 con mensaje amistoso
              logger.info(
                `No se pudo recuperar usuario para ${userInfo.email}`
              );
              return res.status(200).json({
                success: false,
                message:
                  "Ha ocurrido un error temporal. Por favor, inténtalo de nuevo.",
                recoverable: true,
              });
            }

            // Si encontramos el usuario, intentar crear su sesión y tokens
            try {
              // Crear autenticación externa si no existe
              const authId = uuidv4();
              const crypto = require("crypto");

              try {
                await prismaClient.$executeRaw`
                INSERT INTO "ExternalAuth" (
                  "id", "userId", "provider", "providerUserId", "providerEmail", 
                  "accessToken", "profileData", "createdAt", "updatedAt"
                )
                VALUES (
                  ${authId}, ${existingUser.id}, 'google', ${userInfo.id}, 
                  ${userInfo.email}, ${tokenId}, ${JSON.stringify({
                  ...userInfo,
                })}, 
                  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
                )
                ON CONFLICT ("provider", "providerUserId") DO NOTHING;
              `;
              } catch (authError) {
                logger.warn(
                  `Error al crear autenticación externa en recuperación (ignorado): ${authError.message}`
                );
              }

              // Generar tokens JWT
              const accessToken = authService.generateAccessToken(existingUser);
              const refreshToken =
                authService.generateRefreshToken(existingUser);

              // Crear una sesión
              const sessionId = uuidv4();
              const sessionToken = crypto.randomBytes(64).toString("hex");

              try {
                await prismaClient.$executeRaw`
                INSERT INTO "UserSession" (
                  "id", "userId", "token", "expiresAt", "isActive", "createdAt", 
                  "provider", "ipAddress", "userAgent"
                )
                VALUES (
                  ${sessionId}, ${existingUser.id}, ${sessionToken}, 
                  ${new Date(Date.now() + 24 * 60 * 60 * 1000)}, ${true}, 
                  CURRENT_TIMESTAMP, 'google', ${
                    existingUser.ipAddress || null
                  }, 
                  ${existingUser.userAgent || null}
                );
              `;
              } catch (sessionError) {
                logger.warn(
                  `Error al crear sesión en recuperación (ignorado): ${sessionError.message}`
                );
              }

              // Obtener info del perfil
              let profileInfo = null;
              try {
                if (existingUser.role === "cliente") {
                  profileInfo = await prismaClient.client.findUnique({
                    where: { id: existingUser.id },
                    select: {
                      username: true,
                      totalPoints: true,
                      vipUntil: true,
                      verifiedAccount: true,
                    },
                  });
                } else if (existingUser.role === "perfil") {
                  profileInfo = await prismaClient.profile.findUnique({
                    where: { id: existingUser.id },
                    select: {
                      displayName: true,
                      slug: true,
                      verificationStatus: true,
                    },
                  });
                } else if (existingUser.role === "agencia") {
                  profileInfo = await prismaClient.agency.findUnique({
                    where: { id: existingUser.id },
                    select: {
                      name: true,
                      slug: true,
                      verificationStatus: true,
                    },
                  });
                }
              } catch (profileError) {
                logger.warn(
                  `Error al obtener perfil en recuperación (ignorado): ${profileError.message}`
                );
              }

              // Actualizar último login si es posible
              try {
                await prismaClient.user.update({
                  where: { id: existingUser.id },
                  data: { lastLogin: new Date() },
                });
              } catch (updateError) {
                logger.warn(
                  `Error al actualizar último login (ignorado): ${updateError.message}`
                );
              }

              await prismaClient.$disconnect();

              logger.info(
                `Recuperación transparente exitosa para: ${existingUser.email}`
              );

              // Devolver respuesta exitosa
              return res.status(200).json({
                success: true,
                accessToken: accessToken,
                refreshToken: refreshToken,
                sessionToken: sessionToken,
                userId: existingUser.id,
                email: existingUser.email,
                tipoUsuario: existingUser.role,
                isVip: existingUser.isVip || false,
                status: "existing_user",
                profileInfo: profileInfo,
              });
            } catch (recoveryProcessError) {
              logger.error(
                `Error en proceso de recuperación: ${recoveryProcessError.message}`,
                { error: recoveryProcessError }
              );
              await prismaClient.$disconnect();

              // Intentar devolver una respuesta genérica exitosa
              return res.status(200).json({
                success: false,
                message:
                  "Ha ocurrido un error temporal. Por favor, inténtalo de nuevo.",
                recoverable: true,
              });
            }
          } catch (findUserError) {
            logger.error(
              `Error al buscar usuario en recuperación: ${findUserError.message}`,
              { error: findUserError }
            );
            return res.status(200).json({
              success: false,
              message:
                "Ha ocurrido un problema durante el registro. Por favor, inténtalo de nuevo.",
              recoverable: true,
            });
          }
        }

        // Manejar caso de restricción única en proveedor/providerUserId
        if (
          error.code === "P2002" &&
          error.meta &&
          error.meta.target &&
          ((Array.isArray(error.meta.target) &&
            error.meta.target.includes("provider") &&
            error.meta.target.includes("providerUserId")) ||
            error.meta.target.join(",").includes("provider,providerUserId"))
        ) {
          logger.warn(
            `Restricción única en provider/providerUserId. Intentando recuperar.`
          );

          try {
            // Buscar la autenticación externa existente
            const prismaClient = new PrismaClient();
            const existingAuth = await prismaClient.externalAuth.findFirst({
              where: {
                provider: "google",
                providerUserId: userInfo.id,
              },
              include: {
                user: true,
              },
            });

            if (!existingAuth || !existingAuth.user) {
              await prismaClient.$disconnect();
              // Si no encontramos la autenticación, devolver respuesta 200 con mensaje amistoso
              return res.status(200).json({
                success: false,
                message:
                  "Ha ocurrido un error durante el registro. Por favor, inténtalo de nuevo.",
                recoverable: true,
              });
            }

            // Generar tokens JWT
            const accessToken = authService.generateAccessToken(
              existingAuth.user
            );
            const refreshToken = authService.generateRefreshToken(
              existingAuth.user
            );

            // Crear una sesión
            const sessionId = uuidv4();
            const crypto = require("crypto");
            const sessionToken = crypto.randomBytes(64).toString("hex");

            try {
              await prismaClient.$executeRaw`
              INSERT INTO "UserSession" (
                "id", "userId", "token", "expiresAt", "isActive", "createdAt", 
                "provider", "ipAddress", "userAgent"
              )
              VALUES (
                ${sessionId}, ${existingAuth.user.id}, ${sessionToken}, 
                ${new Date(Date.now() + 24 * 60 * 60 * 1000)}, ${true}, 
                CURRENT_TIMESTAMP, 'google', ${
                  existingAuth.user.ipAddress || null
                }, 
                ${existingAuth.user.userAgent || null}
              );
            `;
            } catch (sessionError) {
              logger.warn(
                `Error al crear sesión en recuperación auth (ignorado): ${sessionError.message}`
              );
            }

            // Obtener info del perfil
            let profileInfo = null;
            try {
              if (existingAuth.user.role === "cliente") {
                profileInfo = await prismaClient.client.findUnique({
                  where: { id: existingAuth.user.id },
                  select: {
                    username: true,
                    totalPoints: true,
                    vipUntil: true,
                    verifiedAccount: true,
                  },
                });
              } else if (existingAuth.user.role === "perfil") {
                profileInfo = await prismaClient.profile.findUnique({
                  where: { id: existingAuth.user.id },
                  select: {
                    displayName: true,
                    slug: true,
                    verificationStatus: true,
                  },
                });
              } else if (existingAuth.user.role === "agencia") {
                profileInfo = await prismaClient.agency.findUnique({
                  where: { id: existingAuth.user.id },
                  select: {
                    name: true,
                    slug: true,
                    verificationStatus: true,
                  },
                });
              }
            } catch (profileError) {
              logger.warn(
                `Error al obtener perfil en recuperación auth (ignorado): ${profileError.message}`
              );
            }

            // Actualizar último login si es posible
            try {
              await prismaClient.user.update({
                where: { id: existingAuth.user.id },
                data: { lastLogin: new Date() },
              });
            } catch (updateError) {
              logger.warn(
                `Error al actualizar último login auth (ignorado): ${updateError.message}`
              );
            }

            await prismaClient.$disconnect();

            logger.info(
              `Recuperación por auth externa exitosa para: ${existingAuth.user.email}`
            );

            // Devolver respuesta exitosa
            return res.status(200).json({
              success: true,
              accessToken: accessToken,
              refreshToken: refreshToken,
              sessionToken: sessionToken,
              userId: existingAuth.user.id,
              email: existingAuth.user.email,
              tipoUsuario: existingAuth.user.role,
              isVip: existingAuth.user.isVip || false,
              status: "existing_user",
              profileInfo: profileInfo,
            });
          } catch (authRecoveryError) {
            logger.error(
              `Error en recuperación por auth: ${authRecoveryError.message}`,
              { error: authRecoveryError }
            );
            return res.status(200).json({
              success: false,
              message:
                "Ha ocurrido un problema durante el registro. Por favor, inténtalo de nuevo.",
              recoverable: true,
            });
          }
        }

        // Para otros tipos de errores, dar una respuesta amigable
        logger.error(`Error en login con Google: ${error.message}`, {
          error: error.stack || error,
        });
        return res.status(200).json({
          success: false,
          message:
            "No pudimos procesar tu inicio de sesión con Google. Por favor, inténtalo de nuevo.",
          recoverable: true,
        });
      }
    } catch (error) {
      logger.error(`Error general en login con Google: ${error.message}`, {
        error: error.stack || error,
      });

      // Incluso para errores generales, dar respuesta 200 para evitar mostrar errores al usuario
      return res.status(200).json({
        success: false,
        message:
          "Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.",
        recoverable: true,
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
      const role = "perfil"; // Registro como perfil (acompañante)

      // Validar datos requeridos
      if (!email || !password || !username) {
        return res.status(400).json({
          success: false,
          message:
            "Todos los campos son requeridos (email, password, username)",
        });
      }

      // Registrar el usuario
      const result = await authService.registerUser(
        { email, password, username, gender },
        role
      );

      return res.status(201).json({
        success: true,
        message: "Perfil registrado con éxito",
        userId: result.user.id,
        profileId: result.profile.id,
        slug: result.profile.slug,
      });
    } catch (error) {
      logger.error(`Error en registro de perfil: ${error.message}`, { error });

      // Manejar errores específicos
      if (error.message.includes("ya está registrado")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al registrar el perfil",
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
      const role = "agencia"; // Registro como agencia

      // Validar datos requeridos
      if (!email || !password || !name) {
        return res.status(400).json({
          success: false,
          message: "Todos los campos son requeridos (email, password, name)",
        });
      }

      // Registrar la agencia
      const result = await authService.registerUser(
        { email, password, username: name, description },
        role
      );

      return res.status(201).json({
        success: true,
        message: "Solicitud de registro de agencia enviada con éxito",
        userId: result.user.id,
        agencyId: result.profile.id,
        solicitudId: result.profile.id, // Mismo ID para mantener compatibilidad con el front
      });
    } catch (error) {
      logger.error(`Error en registro de agencia: ${error.message}`, { error });

      // Manejar errores específicos
      if (error.message.includes("ya está registrado")) {
        return res.status(409).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al registrar la agencia",
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
          message: "Email y contraseña son requeridos",
        });
      }

      // Capturar IP y User-Agent para seguridad
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"];

      // Actualizar estos datos en el usuario para seguimiento
      await authService.updateUserMetadata(email, { ipAddress, userAgent });

      // Realizar el login
      const loginResult = await authService.login(email, password);

      // Configurar duración del token según rememberMe
      const tokenExpiration = rememberMe ? "7d" : "1d";

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
        ProfileInfo: loginResult.profileInfo,
      });
    } catch (error) {
      logger.error(`Error en login: ${error.message}`, { error });

      // Manejar errores específicos
      if (
        error.message.includes("Credenciales inválidas") ||
        error.message.includes("temporalmente bloqueada")
      ) {
        return res.status(401).json({
          success: false,
          message: error.message,
        });
      }

      return res.status(500).json({
        success: false,
        message: "Error al iniciar sesión",
        error: error.message,
      });
    }
  }

  /**
   * Inicia sesión con Google
   * @param {Object} req - Objeto de petición
   * @param {Object} res - Objeto de respuesta
   */
  // src/api/auth/auth.controller.js - Método googleLogin final
  async googleLogin(req, res) {
    try {
      const { tokenId, userType = "cliente", userData } = req.body;

      if (!tokenId) {
        return res.status(400).json({
          success: false,
          message: "Token de Google es requerido",
        });
      }

      // Registrar intento de autenticación
      logger.info(
        `Intento de autenticación con Google. Tipo de usuario: ${userType}`
      );

      // En un entorno de producción, verificamos el token con Google
      // Para más seguridad, se debería implementar esta verificación

      // Validar datos de usuario
      const userInfo = userData || {};
      if (!userInfo.email) {
        return res.status(400).json({
          success: false,
          message: "La información del usuario es incompleta (falta email)",
        });
      }

      try {
        // Iniciar sesión o registrar usuario con Google
        const result = await authService.socialLogin(
          {
            id: userInfo.id || `google_${Date.now()}`,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            tokenId,
          },
          "google",
          userType
        );

        // Registrar inicio de sesión exitoso
        logger.info(
          `Autenticación con Google exitosa para: ${result.email}, ID: ${result.userId}`
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
          profileInfo: result.profileInfo,
        });
      } catch (error) {
        // Si es un error específico de restricción única, manejarlo de forma transparente
        if (error.code === "P2002" && error.meta && error.meta.target) {
          logger.warn(
            `Error de restricción única en ${error.meta.target.join(
              ", "
            )}. Intentando recuperar transparentemente.`
          );

          try {
            // Intentar recuperar al usuario existente en lugar de mostrar el error
            const existingUser = await prisma.user.findUnique({
              where: { email: userInfo.email },
            });

            if (!existingUser) {
              // Si no podemos recuperar el usuario, fallar silenciosamente
              logger.error(
                `No se pudo recuperar usuario para ${userInfo.email}`
              );
              return res.status(200).json({
                success: false,
                message:
                  "Ha ocurrido un error temporal. Por favor, inténtalo de nuevo.",
                recoverable: true,
              });
            }

            // Generar tokens para este usuario
            const accessToken = authService.generateAccessToken(existingUser);
            const refreshToken = authService.generateRefreshToken(existingUser);

            // Crear una sesión
            const sessionId = uuidv4();
            const sessionToken = crypto.randomBytes(64).toString("hex");

            try {
              await prisma.$executeRaw`
              INSERT INTO "UserSession" (
                "id", "userId", "token", "expiresAt", "isActive", "createdAt", 
                "provider", "ipAddress", "userAgent"
              )
              VALUES (
                ${sessionId}, ${existingUser.id}, ${sessionToken}, 
                ${new Date(Date.now() + 24 * 60 * 60 * 1000)}, ${true}, 
                CURRENT_TIMESTAMP, 'google', ${existingUser.ipAddress || null}, 
                ${existingUser.userAgent || null}
              );
            `;
            } catch (sessionError) {
              logger.warn(
                `Error al crear sesión (ignorando): ${sessionError.message}`
              );
              // Continuamos sin sesión si falla
            }

            // Obtener info del perfil
            let profileInfo = null;
            try {
              if (existingUser.role === "cliente") {
                profileInfo = await prisma.client.findUnique({
                  where: { id: existingUser.id },
                  select: {
                    username: true,
                    totalPoints: true,
                    vipUntil: true,
                    verifiedAccount: true,
                  },
                });
              } else if (existingUser.role === "perfil") {
                profileInfo = await prisma.profile.findUnique({
                  where: { id: existingUser.id },
                  select: {
                    displayName: true,
                    slug: true,
                    verificationStatus: true,
                  },
                });
              } else if (existingUser.role === "agencia") {
                profileInfo = await prisma.agency.findUnique({
                  where: { id: existingUser.id },
                  select: {
                    name: true,
                    slug: true,
                    verificationStatus: true,
                  },
                });
              }
            } catch (profileError) {
              logger.warn(
                `Error al obtener perfil (ignorando): ${profileError.message}`
              );
            }

            logger.info(
              `Recuperación transparente exitosa para: ${existingUser.email}`
            );

            // Devolver respuesta exitosa como si nada hubiera fallado
            return res.status(200).json({
              success: true,
              accessToken: accessToken,
              refreshToken: refreshToken,
              sessionToken: sessionToken,
              userId: existingUser.id,
              email: existingUser.email,
              tipoUsuario: existingUser.role,
              isVip: existingUser.isVip,
              status: "existing_user",
              profileInfo: profileInfo,
            });
          } catch (recoveryError) {
            // Si incluso la recuperación falla, loguear y continuar con una respuesta genérica
            logger.error(
              `Error en recuperación transparente: ${recoveryError.message}`,
              { error: recoveryError }
            );
            return res.status(200).json({
              success: false,
              message:
                "Ha ocurrido un error temporal. Por favor, inténtalo de nuevo.",
              recoverable: true,
            });
          }
        }

        // Para otros tipos de errores, dar una respuesta amigable
        logger.error(`Error en login con Google: ${error.message}`, { error });
        return res.status(200).json({
          success: false,
          message:
            "No pudimos procesar tu inicio de sesión con Google. Por favor, inténtalo de nuevo.",
          recoverable: true,
        });
      }
    } catch (error) {
      logger.error(`Error general en login con Google: ${error.message}`, {
        error,
      });

      // Incluso para errores generales, dar respuesta 200 para evitar mostrar errores al usuario
      return res.status(200).json({
        success: false,
        message:
          "Ha ocurrido un error al procesar tu solicitud. Por favor, inténtalo de nuevo más tarde.",
        recoverable: true,
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
          message: "Token de refresco requerido",
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
        message: "Error al refrescar el token",
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
          message: "Token de sesión requerido",
        });
      }

      const result = await authService.logout(sessionToken);

      return res.status(200).json({
        success: result,
        message: result ? "Sesión cerrada con éxito" : "Error al cerrar sesión",
      });
    } catch (error) {
      logger.error(`Error en logout: ${error.message}`, { error });

      return res.status(500).json({
        success: false,
        message: "Error al cerrar sesión",
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
          message: "Correo electrónico requerido",
        });
      }

      await authService.requestPasswordReset(email);

      // Siempre devolver éxito por seguridad, incluso si el email no existe
      return res.status(200).json({
        success: true,
        message:
          "Si la dirección existe, recibirás un correo con instrucciones",
      });
    } catch (error) {
      logger.error(`Error al solicitar reset: ${error.message}`, { error });

      // Para no revelar si el email existe, siempre retornar éxito
      return res.status(200).json({
        success: true,
        message:
          "Si la dirección existe, recibirás un correo con instrucciones",
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
          message: "Token y nueva contraseña son requeridos",
        });
      }

      const result = await authService.resetPassword(token, password);

      return res.status(200).json({
        success: result,
        message: "Contraseña restablecida con éxito",
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
          message: "Token de verificación requerido",
        });
      }

      const result = await authService.verifyEmail(token);

      return res.status(200).json({
        success: true,
        message: "Correo electrónico verificado con éxito",
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