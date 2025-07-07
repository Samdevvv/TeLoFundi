const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { 
  generateToken, 
  generateRefreshToken, 
  verifyRefreshToken 
} = require('../middleware/auth');
const { 
  isEmailUnique, 
  isUsernameUnique, 
  sanitizeString 
} = require('../utils/validators');
const { 
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendAgencyPendingEmail
} = require('../services/authService');
const logger = require('../utils/logger');

// âœ… HELPER MEJORADO PARA CALCULAR COMPLETITUD DEL PERFIL
const calculateInitialProfileCompleteness = (userData, userType) => {
  let completeness = 0;
  const fields = ['firstName', 'lastName', 'bio', 'phone'];
  
  if (userType === 'AGENCY') {
    fields.push('website', 'companyName', 'businessLicense', 'contactPerson', 'address');
  }
  
  fields.forEach(field => {
    if (userData[field]) {
      completeness += 100 / fields.length;
    }
  });
  
  return Math.round(completeness);
};

// âœ… FUNCIÃ“N PARA GENERAR USERNAME AUTOMÃTICAMENTE
const generateUniqueUsername = async (firstName, email) => {
  const namePart = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const emailPart = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    const randomNum = Math.floor(Math.random() * 9999) + 1;
    
    let username;
    switch (attempts) {
      case 0:
        username = `${namePart}${randomNum}`;
        break;
      case 1:
        username = `${namePart}_${randomNum}`;
        break;
      case 2:
        username = `${emailPart}${randomNum}`;
        break;
      case 3:
        username = `${namePart}${emailPart}${randomNum}`.substring(0, 20);
        break;
      default:
        username = `user_${Date.now()}${randomNum}`.substring(0, 20);
    }
    
    if (username.length < 3) {
      username = `user${randomNum}`;
    }
    
    const isUnique = await isUsernameUnique(username);
    if (isUnique) {
      logger.info('âœ… Username Ãºnico generado:', { username, attempts: attempts + 1 });
      return username;
    }
    
    attempts++;
  }
  
  const fallbackUsername = `user_${Date.now()}_${Math.floor(Math.random() * 999)}`;
  logger.warn('âš ï¸ Usando username fallback:', fallbackUsername);
  return fallbackUsername;
};

// âœ… HELPER FUNCTION PARA CREAR RESPUESTA DE USUARIO ESTÃNDAR
const createUserResponse = (user) => {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName || '',
    avatar: user.avatar,
    userType: user.userType,
    phone: user.phone || '',
    bio: user.bio || '',
    website: user.website || '',
    isActive: user.isActive,
    profileViews: user.profileViews,
    lastLogin: user.lastLogin,
    createdAt: user.createdAt,
    location: user.location,
    settings: user.settings,
    reputation: user.reputation,
    [user.userType.toLowerCase()]: user[user.userType.toLowerCase()],
    profileIncomplete: !user.lastName || !user.bio || !user.phone
  };
};

// âœ… HELPER FUNCTION PARA CREAR RESPUESTA ESPECÃFICA DE AGENCIA
const createAgencyResponse = (user, agencyData, agencyRequest) => {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    userType: user.userType,
    accountStatus: user.accountStatus,
    canLogin: user.canLogin,
    agencyData: {
      companyName: agencyData.companyName,
      businessLicense: agencyData.businessLicense,
      contactPerson: agencyData.contactPerson,
      address: agencyData.address,
      verificationStatus: 'PENDING',
      requestId: agencyRequest.id
    }
  };
};

// âœ… REGISTRO UNIFICADO - MANEJA TANTO ESCORTS/CLIENTES COMO AGENCIAS
const register = catchAsync(async (req, res) => {
  console.log('ðŸš€ REGISTRO - DATOS RECIBIDOS:', JSON.stringify(req.body, null, 2));
  console.log('ðŸ“„ ARCHIVOS RECIBIDOS:', {
    files: req.files ? Object.keys(req.files) : 'No files',
    uploadedFiles: req.uploadedFiles ? Object.keys(req.uploadedFiles) : 'No uploadedFiles',
    file: req.file ? 'Single file exists' : 'No single file'
  });

  const {
    email,
    firstName,
    password,
    userType,
    companyName,
    businessLicense,
    contactPerson,
    address,
    phone,
    bio,
    website,
    locationId
  } = req.body;

  logger.info('ðŸ” INICIANDO REGISTRO:', {
    email,
    firstName,
    userType,
    hasCompanyName: !!companyName,
    hasFiles: !!(req.uploadedFiles && Object.keys(req.uploadedFiles).length > 0)
  });

  // âœ… VALIDACIONES ESPECÃFICAS PARA AGENCIAS
  if (userType === 'AGENCY') {
    console.log('ðŸ¢ Validando datos de agencia...');
    
    if (!companyName?.trim()) {
      throw new AppError('El nombre de la empresa es obligatorio para agencias', 400, 'COMPANY_NAME_REQUIRED');
    }
    
    if (!contactPerson?.trim()) {
      throw new AppError('El nombre de la persona de contacto es obligatorio para agencias', 400, 'CONTACT_PERSON_REQUIRED');
    }
    
    if (!address?.trim()) {
      throw new AppError('La direcciÃ³n es obligatoria para agencias', 400, 'ADDRESS_REQUIRED');
    }

    console.log('ðŸ” Verificando archivos de cÃ©dula:', {
      uploadedFiles: req.uploadedFiles,
      hasUploadedFiles: !!req.uploadedFiles,
      keys: req.uploadedFiles ? Object.keys(req.uploadedFiles) : 'N/A'
    });

    if (!req.uploadedFiles || Object.keys(req.uploadedFiles).length === 0) {
      console.error('âŒ No se encontraron archivos procesados');
      throw new AppError('No se pudieron procesar las fotos de cÃ©dula. Verifica que los archivos sean JPG, PNG o GIF y menores a 5MB.', 400, 'NO_FILES_UPLOADED');
    }

    if (!req.uploadedFiles.cedulaFrente || !req.uploadedFiles.cedulaFrente.secure_url) {
      console.error('âŒ cedulaFrente no procesada correctamente');
      throw new AppError('La foto frontal de la cÃ©dula no se pudo procesar correctamente', 400, 'CEDULA_FRENTE_REQUIRED');
    }

    if (!req.uploadedFiles.cedulaTrasera || !req.uploadedFiles.cedulaTrasera.secure_url) {
      console.error('âŒ cedulaTrasera no procesada correctamente');
      throw new AppError('La foto posterior de la cÃ©dula no se pudo procesar correctamente', 400, 'CEDULA_TRASERA_REQUIRED');
    }

    console.log('âœ… Archivos de cÃ©dula validados correctamente');
  }

  const emailIsUnique = await isEmailUnique(email);
  if (!emailIsUnique) {
    logger.warn('âŒ Email ya existe:', email);
    throw new AppError('Este email ya estÃ¡ registrado', 409, 'EMAIL_EXISTS');
  }

  const username = await generateUniqueUsername(firstName, email);
  logger.info('âœ… Username generado automÃ¡ticamente:', username);

  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  const isAgency = userType === 'AGENCY';
  
  const userData = {
    email: email.toLowerCase(),
    username: username.toLowerCase(),
    firstName: sanitizeString(firstName),
    lastName: '',
    password: hashedPassword,
    userType,
    phone: phone || '',
    bio: bio || '',
    website: website || '',
    locationId: locationId || null,
    isActive: true,
    lastActiveAt: new Date(),
    accountStatus: isAgency ? 'PENDING_APPROVAL' : 'ACTIVE',
    canLogin: !isAgency,
    emailVerified: !isAgency
  };

  try {
    let cedulaUrls = {};
    if (userType === 'AGENCY' && req.uploadedFiles) {
      try {
        cedulaUrls = {
          cedulaFrente: req.uploadedFiles.cedulaFrente?.secure_url || null,
          cedulaTrasera: req.uploadedFiles.cedulaTrasera?.secure_url || null
        };
        
        console.log('ðŸ“„ URLs de cÃ©dula obtenidas:', cedulaUrls);

        if (!cedulaUrls.cedulaFrente || !cedulaUrls.cedulaTrasera) {
          throw new AppError('Error procesando las imÃ¡genes de cÃ©dula', 500, 'CEDULA_UPLOAD_ERROR');
        }
      } catch (error) {
        console.error('âŒ Error procesando archivos de cÃ©dula:', error);
        throw new AppError('Error procesando las imÃ¡genes de cÃ©dula', 500, 'CEDULA_PROCESSING_ERROR');
      }
    }

    const finalBusinessLicense = businessLicense || (isAgency ? `${companyName.replace(/\s+/g, '-').toUpperCase()}-${Date.now()}` : null);

    const user = await prisma.user.create({
      data: {
        ...userData,
        ...(userType === 'ESCORT' && {
          escort: {
            create: {
              age: null,
              services: null,
              maxPosts: 3,
              currentPosts: 0,
              isVerified: false
            }
          }
        }),
        ...(userType === 'AGENCY' && {
          agency: {
            create: {
              companyName: sanitizeString(companyName),
              businessLicense: finalBusinessLicense,
              contactPerson: sanitizeString(contactPerson),
              address: sanitizeString(address),
              cedulaFrente: cedulaUrls.cedulaFrente,
              cedulaTrasera: cedulaUrls.cedulaTrasera,
              isVerified: false,
              totalEscorts: 0,
              verifiedEscorts: 0,
              totalVerifications: 0,
              activeEscorts: 0,
              verificationStatus: 'PENDING'
            }
          }
        }),
        ...(userType === 'CLIENT' && {
          client: {
            create: {
              points: 10,
              isPremium: false,
              premiumTier: 'BASIC',
              dailyMessageLimit: 5,
              canViewPhoneNumbers: false,
              canSendImages: false,
              canSendVoiceMessages: false,
              canAccessPremiumProfiles: false,
              prioritySupport: false,
              canSeeOnlineStatus: false,
              messagesUsedToday: 0,
              lastMessageReset: new Date(),
              maxFavorites: 5,
              currentFavorites: 0
            }
          }
        }),
        settings: {
          create: {
            emailNotifications: true,
            pushNotifications: true,
            messageNotifications: true,
            likeNotifications: true,
            boostNotifications: true,
            showOnline: true,
            showLastSeen: true,
            allowDirectMessages: true,
            showPhoneNumber: false,
            showInDiscovery: userType !== 'CLIENT',
            showInTrending: userType !== 'CLIENT',
            showInSearch: true,
            contentFilter: 'MODERATE'
          }
        },
        reputation: {
          create: {
            overallScore: 50.0,
            responseRate: 0.0,
            profileCompleteness: calculateInitialProfileCompleteness({
              ...userData,
              companyName,
              businessLicense: finalBusinessLicense,
              contactPerson,
              address
            }, userType),
            trustScore: isAgency ? 15.0 : 25.0,
            discoveryScore: isAgency ? 0.0 : 10.0,
            trendingScore: 0.0,
            qualityScore: 30.0
          }
        }
      },
      include: {
        escort: true,
        agency: true,
        client: true,
        settings: true,
        reputation: true,
        location: true
      }
    });

    console.log('âœ… Usuario creado exitosamente:', {
      id: user.id,
      username: user.username,
      userType: user.userType,
      accountStatus: user.accountStatus
    });

    if (userType === 'AGENCY') {
      const agencyRequest = await prisma.agencyRegistrationRequest.create({
        data: {
          userId: user.id,
          fullName: `${firstName} ${contactPerson}`.trim(),
          documentNumber: finalBusinessLicense,
          businessEmail: email,
          businessPhone: phone || '',
          documentFrontImage: cedulaUrls.cedulaFrente,
          documentBackImage: cedulaUrls.cedulaTrasera,
          status: 'PENDING',
          submittedAt: new Date()
        }
      });

      console.log('âœ… Solicitud de agencia creada:', {
        requestId: agencyRequest.id,
        userId: user.id,
        status: 'PENDING'
      });

      try {
        const admins = await prisma.user.findMany({
          where: { userType: 'ADMIN' },
          select: { id: true }
        });

        if (admins.length > 0) {
          const adminNotifications = admins.map(admin => ({
            userId: admin.id,
            type: 'SYSTEM',
            title: 'Nueva agencia pendiente de verificaciÃ³n',
            message: `${companyName} (${firstName}) solicita verificaciÃ³n como agencia`,
            priority: 'HIGH',
            data: {
              agencyUserId: user.id,
              requestId: agencyRequest.id,
              companyName,
              businessLicense: finalBusinessLicense,
              contactPerson,
              address,
              cedulaFrente: cedulaUrls.cedulaFrente,
              cedulaTrasera: cedulaUrls.cedulaTrasera,
              submittedAt: new Date().toISOString()
            }
          }));

          await prisma.notification.createMany({
            data: adminNotifications
          });

          logger.info('âœ… Notificaciones enviadas a admins para nueva agencia:', {
            agencyUserId: user.id,
            requestId: agencyRequest.id,
            companyName,
            adminsNotified: admins.length
          });
        }
      } catch (notificationError) {
        logger.warn('âš ï¸ No se pudieron enviar notificaciones a admins:', notificationError.message);
      }

      try {
        await sendAgencyPendingEmail(user, {
          companyName,
          businessLicense: finalBusinessLicense,
          contactPerson,
          address
        });
        logger.info('âœ… Email de solicitud pendiente enviado a agencia');
      } catch (emailError) {
        logger.warn('âš ï¸ No se pudo enviar email de solicitud pendiente:', emailError.message);
      }

      const agencyUserResponse = createAgencyResponse(user, {
        companyName,
        businessLicense: finalBusinessLicense,
        contactPerson,
        address
      }, agencyRequest);

      logger.info('âœ… Solicitud de agencia registrada:', {
        userId: user.id,
        requestId: agencyRequest.id,
        companyName,
        userType: user.userType,
        status: 'PENDING_APPROVAL'
      });

      return res.status(201).json({
        success: true,
        message: 'Solicitud de agencia recibida. Te notificaremos cuando sea aprobada.',
        data: {
          user: agencyUserResponse,
          applicationStatus: 'PENDING_APPROVAL',
          estimatedReviewTime: '24-48 horas',
          nextSteps: [
            'Nuestro equipo revisarÃ¡ tu documentaciÃ³n',
            'Verificaremos la informaciÃ³n proporcionada',
            'Te notificaremos por email sobre la decisiÃ³n',
            'Una vez aprobado, podrÃ¡s acceder a todas las funcionalidades'
          ]
        },
        timestamp: new Date().toISOString()
      });
    }

    try {
      await sendWelcomeEmail(user);
      logger.info('âœ… Email de bienvenida enviado exitosamente');
    } catch (emailError) {
      logger.warn('âš ï¸ No se pudo enviar email de bienvenida:', emailError.message);
    }

    if (userType === 'CLIENT') {
      try {
        await prisma.pointTransaction.create({
          data: {
            clientId: user.client.id,
            amount: 10,
            type: 'REGISTRATION',
            description: 'Puntos de bienvenida por registro',
            balanceBefore: 0,
            balanceAfter: 10
          }
        });
        logger.info('âœ… Puntos de bienvenida agregados al cliente');
      } catch (pointsError) {
        logger.warn('âš ï¸ No se pudieron agregar puntos de bienvenida:', pointsError.message);
      }
    }

    const token = generateToken(user.id);
    const refreshToken = generateRefreshToken(user.id);

    logger.logAuth('register', user.id, user.email, true, {
      userType,
      method: 'email_password',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      usernameGenerated: true
    });

    const normalUserResponse = {
      ...createUserResponse(user),
      nextSteps: [
        'Completa tu perfil',
        'Agrega una foto',
        'Completa tu descripciÃ³n',
        userType === 'ESCORT' ? 'Crea tu primer anuncio' : 'Explora perfiles'
      ]
    };

    logger.info('âœ… Registro completado exitosamente:', {
      userId: user.id,
      username: user.username,
      userType: user.userType,
      generatedUsername: true
    });

    res.status(201).json({
      success: true,
      message: 'Usuario registrado exitosamente',
      data: {
        user: normalUserResponse,
        token,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('ðŸ’¥ Error en registro de usuario:', {
      email,
      firstName,
      userType,
      companyName: userType === 'AGENCY' ? companyName : undefined,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
});

// âœ… FUNCIÃ“N ESPECÃFICA PARA AGENCIAS
const registerAgency = catchAsync(async (req, res) => {
  console.log('ðŸ¢ REGISTRO DE AGENCIA - ENDPOINT ESPECÃFICO');
  console.log('ðŸ“„ Body recibido:', JSON.stringify(req.body, null, 2));
  console.log('ðŸ“„ Files recibidos:', {
    files: req.files ? Object.keys(req.files) : 'No files',
    uploadedFiles: req.uploadedFiles ? Object.keys(req.uploadedFiles) : 'No uploadedFiles'
  });

  req.body.userType = 'AGENCY';

  if (!req.body.businessLicense && req.body.companyName) {
    req.body.businessLicense = `${req.body.companyName.replace(/\s+/g, '-').toUpperCase()}-${Date.now()}`;
    console.log('âœ… BusinessLicense generado automÃ¡ticamente:', req.body.businessLicense);
  }

  return register(req, res);
});

// âœ… LOGIN NORMAL
const login = catchAsync(async (req, res) => {
  const { email, password, rememberMe } = req.body;

  console.log('ðŸ” LOGIN NORMAL - DATOS RECIBIDOS:', { email, hasPassword: !!password, rememberMe });

  logger.info('ðŸ” INICIANDO LOGIN NORMAL:', { email, rememberMe: !!rememberMe, ip: req.ip });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: {
      escort: true,
      agency: true,
      client: true,
      admin: true,
      settings: true,
      reputation: true,
      location: true
    }
  });

  if (!user) {
    logger.warn('âŒ Usuario no encontrado:', email);
    logger.logAuth('login', null, email, false, {
      reason: 'user_not_found',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Credenciales invÃ¡lidas', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);
  if (!isPasswordValid) {
    logger.warn('âŒ ContraseÃ±a invÃ¡lida para usuario:', user.username);
    logger.logAuth('login', user.id, email, false, {
      reason: 'invalid_password',
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    throw new AppError('Credenciales invÃ¡lidas', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.isActive) {
    logger.warn('âŒ Cuenta inactiva:', user.username);
    throw new AppError('Cuenta desactivada', 401, 'ACCOUNT_INACTIVE');
  }

  if (user.isBanned) {
    logger.warn('âŒ Cuenta baneada:', user.username);
    throw new AppError(`Cuenta suspendida: ${user.banReason}`, 403, 'ACCOUNT_BANNED');
  }

  if (user.userType === 'AGENCY') {
    console.log('ðŸ¢ VALIDANDO ACCESO DE AGENCIA:', {
      userId: user.id,
      accountStatus: user.accountStatus,
      canLogin: user.canLogin,
      agencyVerificationStatus: user.agency?.verificationStatus,
      isVerified: user.agency?.isVerified
    });

    if (user.accountStatus === 'PENDING_APPROVAL') {
      logger.warn('âŒ Agencia pendiente de aprobaciÃ³n:', {
        userId: user.id,
        username: user.username,
        accountStatus: user.accountStatus
      });
      throw new AppError('Tu solicitud estÃ¡ siendo revisada. Te notificaremos cuando sea aprobada.', 403, 'AGENCY_PENDING_APPROVAL');
    }

    if (!user.canLogin) {
      logger.warn('âŒ Agencia sin permisos de login:', {
        userId: user.id,
        username: user.username,
        canLogin: user.canLogin
      });
      throw new AppError('Tu solicitud estÃ¡ siendo revisada. Te notificaremos cuando sea aprobada.', 403, 'AGENCY_PENDING_APPROVAL');
    }

    if (user.agency?.verificationStatus === 'REJECTED') {
      logger.warn('âŒ Agencia rechazada:', {
        userId: user.id,
        username: user.username,
        verificationStatus: user.agency.verificationStatus
      });
      throw new AppError('Tu solicitud de agencia fue rechazada. Contacta al soporte para mÃ¡s informaciÃ³n.', 403, 'AGENCY_REJECTED');
    }

    if (user.accountStatus === 'SUSPENDED') {
      logger.warn('âŒ Agencia suspendida:', {
        userId: user.id,
        username: user.username,
        accountStatus: user.accountStatus
      });
      throw new AppError('Tu cuenta de agencia ha sido suspendida temporalmente.', 403, 'AGENCY_SUSPENDED');
    }

    if (user.accountStatus !== 'ACTIVE' || !user.agency?.isVerified) {
      logger.warn('âŒ Agencia no aprobada o no verificada:', {
        userId: user.id,
        username: user.username,
        accountStatus: user.accountStatus,
        isVerified: user.agency?.isVerified,
        verificationStatus: user.agency?.verificationStatus
      });
      throw new AppError('Tu solicitud estÃ¡ siendo revisada. Te notificaremos cuando sea aprobada.', 403, 'AGENCY_PENDING_APPROVAL');
    }

    console.log('âœ… Agencia verificada, permitiendo acceso:', {
      userId: user.id,
      username: user.username,
      accountStatus: user.accountStatus,
      isVerified: user.agency.isVerified
    });
  }

  if (user.userType === 'CLIENT' && user.client) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const lastLogin = user.lastLogin ? new Date(user.lastLogin) : null;
      const lastLoginToday = lastLogin && lastLogin >= today;

      if (!lastLoginToday) {
        await prisma.pointTransaction.create({
          data: {
            clientId: user.client.id,
            amount: 5,
            type: 'DAILY_LOGIN',
            description: 'Puntos por login diario',
            balanceBefore: user.client.points,
            balanceAfter: user.client.points + 5
          }
        });

        await prisma.client.update({
          where: { id: user.client.id },
          data: { points: { increment: 5 } }
        });

        logger.info('âœ… Puntos de login diario agregados:', {
          userId: user.id,
          pointsAdded: 5,
          newBalance: user.client.points + 5
        });
      }
    } catch (pointsError) {
      logger.warn('âš ï¸ No se pudieron agregar puntos de login diario:', pointsError.message);
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      lastLogin: new Date(),
      lastActiveAt: new Date(),
      lastLoginIP: req.ip
    }
  });

  const tokenExpiration = rememberMe ? '30d' : (process.env.JWT_EXPIRES_IN || '7d');
  const token = generateToken(user.id, tokenExpiration);
  const refreshTokenGen = generateRefreshToken(user.id);

  logger.logAuth('login', user.id, email, true, {
    userType: user.userType,
    verificationStatus: user.agency?.verificationStatus || null,
    accountStatus: user.accountStatus,
    rememberMe,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  const loginUserResponse = createUserResponse(user);

  logger.info('âœ… Login normal completado exitosamente:', {
    userId: user.id,
    username: user.username,
    userType: user.userType,
    verificationStatus: user.agency?.verificationStatus || 'N/A',
    accountStatus: user.accountStatus
  });

  res.status(200).json({
    success: true,
    message: 'Login exitoso',
    data: {
      user: loginUserResponse,
      token,
      refreshToken: refreshTokenGen,
      expiresIn: tokenExpiration,
      ...(user.userType === 'AGENCY' && {
        verificationStatus: user.agency?.verificationStatus || 'PENDING',
        accountStatus: user.accountStatus
      })
    },
    timestamp: new Date().toISOString()
  });
});

// âœ… GOOGLE AUTH CON AUTO-DETECCIÃ“N
const googleAuth = catchAsync(async (req, res, next) => {
  let userType = req.query.userType || 'CLIENT';
  
  console.log('ðŸš€ GOOGLE AUTH INICIADO:', { userType, ip: req.ip });
  
  if (!['ESCORT', 'AGENCY', 'CLIENT'].includes(userType)) {
    logger.warn('âŒ Tipo de usuario no vÃ¡lido para Google OAuth:', userType);
    return res.status(400).json({
      success: false,
      message: 'Tipo de usuario no vÃ¡lido',
      errorCode: 'INVALID_USER_TYPE',
      timestamp: new Date().toISOString()
    });
  }

  logger.info('ðŸ” Iniciando Google OAuth (auto-detecciÃ³n en callback):', {
    userType,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  req.session.pendingUserType = userType;
  
 const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${process.env.GOOGLE_CLIENT_ID}&` +
    `redirect_uri=${encodeURIComponent(process.env.GOOGLE_CALLBACK_URL)}&` +
    `response_type=code&` +
    `scope=openid email profile&` +
    `access_type=offline&` +
    `prompt=consent`;
  
res.redirect(googleAuthUrl);
});

// âœ… GOOGLE CALLBACK CON AUTO-DETECCIÃ“N COMPLETA
const googleCallback = catchAsync(async (req, res, next) => {
  const { code } = req.query;
  let userType = req.session?.pendingUserType || 'CLIENT';

  console.log('ðŸ“² Google OAuth Callback - Datos recibidos:', {
    hasCode: !!code,
    requestedUserType: userType,
    sessionData: req.session?.pendingUserType
  });

  if (!code) {
    logger.warn('âŒ Google OAuth: No authorization code received');
    return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('No se recibiÃ³ cÃ³digo de autorizaciÃ³n')}&autoShowLogin=true`);
  }

  try {
    const axios = require('axios');
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: process.env.GOOGLE_CALLBACK_URL
    });

    const { access_token } = tokenResponse.data;

    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const googleUser = userResponse.data;

    console.log('âœ… Google user data received:', {
      id: googleUser.id,
      email: googleUser.email,
      name: googleUser.name,
      requestedUserType: userType
    });

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: googleUser.email },
          { googleId: googleUser.id }
        ]
      },
      include: {
        escort: true,
        agency: true,
        client: true,
        admin: true,
        settings: true,
        reputation: true,
        location: true
      }
    });

    if (user) {
      console.log('ðŸ‘¤ Usuario existente encontrado:', {
        id: user.id,
        userType: user.userType,
        accountStatus: user.accountStatus,
        requestedUserType: userType
      });

      // âœ… AUTO-DETECTAR TIPO: Usar el tipo del usuario existente
      if (user.userType !== userType) {
        console.log('ðŸ”„ AUTO-DETECCIÃ“N: Usando tipo de usuario existente:', {
          requestedType: userType,
          actualType: user.userType,
          email: googleUser.email
        });
        
        userType = user.userType;
        
        logger.info('âœ… Tipo de usuario auto-detectado:', {
          email: googleUser.email,
          detectedUserType: userType,
          originalRequest: req.session?.pendingUserType
        });
      }

      if (user.userType === 'AGENCY') {
        console.log('ðŸ¢ VALIDANDO ACCESO DE AGENCIA VÃA GOOGLE OAUTH:', {
          userId: user.id,
          accountStatus: user.accountStatus,
          canLogin: user.canLogin,
          agencyVerificationStatus: user.agency?.verificationStatus,
          isVerified: user.agency?.isVerified
        });

        if (user.accountStatus === 'PENDING_APPROVAL') {
          logger.warn('âŒ Agencia pendiente - Google OAuth bloqueado:', {
            userId: user.id,
            username: user.username,
            accountStatus: user.accountStatus
          });
          return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Tu solicitud estÃ¡ siendo revisada. Te notificaremos cuando sea aprobada.')}&autoShowLogin=true`);
        }

        if (!user.canLogin) {
          logger.warn('âŒ Agencia sin permisos de login - Google OAuth bloqueado:', {
            userId: user.id,
            username: user.username,
            canLogin: user.canLogin
          });
          return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Tu solicitud estÃ¡ siendo revisada. Te notificaremos cuando sea aprobada.')}&autoShowLogin=true`);
        }

        if (user.agency?.verificationStatus === 'REJECTED') {
          logger.warn('âŒ Agencia rechazada - Google OAuth bloqueado:', {
            userId: user.id,
            username: user.username,
            verificationStatus: user.agency.verificationStatus
          });
          return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Tu solicitud de agencia fue rechazada. Contacta al soporte.')}&autoShowLogin=true`);
        }

        if (user.accountStatus === 'SUSPENDED') {
          logger.warn('âŒ Agencia suspendida - Google OAuth bloqueado:', {
            userId: user.id,
            username: user.username,
            accountStatus: user.accountStatus
          });
          return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Tu cuenta de agencia ha sido suspendida temporalmente.')}&autoShowLogin=true`);
        }

        if (user.accountStatus !== 'ACTIVE' || !user.agency?.isVerified) {
          logger.warn('âŒ Agencia no aprobada o no verificada - Google OAuth bloqueado:', {
            userId: user.id,
            username: user.username,
            accountStatus: user.accountStatus,
            isVerified: user.agency?.isVerified,
            verificationStatus: user.agency?.verificationStatus
          });
          return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Tu solicitud estÃ¡ siendo revisada. Te notificaremos cuando sea aprobada.')}&autoShowLogin=true`);
        }

        console.log('âœ… Agencia verificada, permitiendo acceso vÃ­a Google OAuth:', {
          userId: user.id,
          username: user.username,
          accountStatus: user.accountStatus,
          isVerified: user.agency.isVerified
        });
      }

      if (!user.isActive) {
        logger.warn('âŒ Cuenta inactiva - Google OAuth bloqueado:', {
          userId: user.id,
          username: user.username
        });
        return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Cuenta desactivada')}&autoShowLogin=true`);
      }

      if (user.isBanned) {
        logger.warn('âŒ Cuenta baneada - Google OAuth bloqueado:', {
          userId: user.id,
          username: user.username,
          banReason: user.banReason
        });
        return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent(`Cuenta suspendida: ${user.banReason}`)}&autoShowLogin=true`);
      }

      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: googleUser.id,
          avatar: user.avatar || googleUser.picture,
          lastLogin: new Date(),
          lastActiveAt: new Date(),
          lastLoginIP: req.ip
        },
        include: {
          escort: true,
          agency: true,
          client: true,
          admin: true,
          settings: true,
          reputation: true,
          location: true
        }
      });

    } else {
      if (userType === 'AGENCY') {
        logger.warn('âŒ Google OAuth no permitido para registro de agencias nuevas:', {
          email: googleUser.email,
          userType
        });
        return res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Las agencias deben registrarse con el formulario especÃ­fico que incluye documentos de verificaciÃ³n.')}&autoShowLogin=true`);
      }

      console.log('ðŸ‘¤ Creando nuevo usuario desde Google OAuth:', {
        email: googleUser.email,
        userType
      });

      const baseUsername = googleUser.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      let username = baseUsername;
      let counter = 1;

      while (true) {
        const existingUser = await prisma.user.findUnique({
          where: { username }
        });
        if (!existingUser) break;
        username = `${baseUsername}${counter}`;
        counter++;
      }

      user = await prisma.user.create({
        data: {
          email: googleUser.email.toLowerCase(),
          username,
          firstName: googleUser.given_name || googleUser.name || 'Usuario',
          lastName: googleUser.family_name || '',
          avatar: googleUser.picture,
          googleId: googleUser.id,
          password: '$GOOGLE_OAUTH_NO_PASSWORD$',
          userType,
          isActive: true,
          emailVerified: true,
          lastLogin: new Date(),
          lastActiveAt: new Date(),
          lastLoginIP: req.ip,
          accountStatus: 'ACTIVE',
          canLogin: true,
          ...(userType === 'ESCORT' && {
            escort: {
              create: {
                age: null,
                services: null,
                maxPosts: 3,
                currentPosts: 0,
                isVerified: false
              }
            }
          }),
          ...(userType === 'CLIENT' && {
            client: {
              create: {
                points: 10,
                isPremium: false,
                premiumTier: 'BASIC',
                dailyMessageLimit: 5,
                canViewPhoneNumbers: false,
                canSendImages: false,
                canSendVoiceMessages: false,
                canAccessPremiumProfiles: false,
                prioritySupport: false,
                canSeeOnlineStatus: false,
                messagesUsedToday: 0,
                lastMessageReset: new Date(),
                maxFavorites: 5,
                currentFavorites: 0
              }
            }
          }),
          settings: {
            create: {
              emailNotifications: true,
              pushNotifications: true,
              messageNotifications: true,
              likeNotifications: true,
              boostNotifications: true,
              showOnline: true,
              showLastSeen: true,
              allowDirectMessages: true,
              showPhoneNumber: false,
              showInDiscovery: userType !== 'CLIENT',
              showInTrending: userType !== 'CLIENT',
              showInSearch: true,
              contentFilter: 'MODERATE'
            }
          },
          reputation: {
            create: {
              overallScore: 50.0,
              responseRate: 0.0,
              profileCompleteness: 25.0,
              trustScore: 25.0,
              discoveryScore: userType === 'CLIENT' ? 0.0 : 10.0,
              trendingScore: 0.0,
              qualityScore: 30.0
            }
          }
        },
        include: {
          escort: true,
          client: true,
          settings: true,
          reputation: true,
          location: true
        }
      });

      if (userType === 'CLIENT' && user.client) {
        try {
          await prisma.pointTransaction.create({
            data: {
              clientId: user.client.id,
              amount: 10,
              type: 'REGISTRATION',
              description: 'Puntos de bienvenida por registro con Google',
              balanceBefore: 0,
              balanceAfter: 10
            }
          });
          logger.info('âœ… Puntos de bienvenida agregados al cliente (Google OAuth)');
        } catch (pointsError) {
          logger.warn('âš ï¸ No se pudieron agregar puntos de bienvenida:', pointsError.message);
        }
      }

      console.log('âœ… Nuevo usuario creado exitosamente:', {
        id: user.id,
        username: user.username,
        userType: user.userType
      });
    }

    const token = generateToken(user.id);
    const refreshTokenGen = generateRefreshToken(user.id);

    logger.logAuth('google_oauth', user.id, user.email, true, {
      userType: user.userType,
      verificationStatus: user.agency?.verificationStatus || null,
      accountStatus: user.accountStatus,
      isNewUser: !user.lastLogin,
      autoDetectedType: req.session?.pendingUserType !== user.userType,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    const googleUserResponse = createUserResponse(user);

    const redirectParams = new URLSearchParams({
      auth: 'success',
      token,
      refreshToken: refreshTokenGen,
      user: JSON.stringify(googleUserResponse)
    });

    logger.info('âœ… Google OAuth completado exitosamente:', {
      userId: user.id,
      username: user.username,
      userType: user.userType,
      verificationStatus: user.agency?.verificationStatus || 'N/A',
      accountStatus: user.accountStatus,
      autoDetected: req.session?.pendingUserType !== user.userType
    });

    delete req.session.pendingUserType;

    res.redirect(`${process.env.FRONTEND_URL}?${redirectParams.toString()}`);

  } catch (error) {
    logger.error('ðŸ’¥ Error en Google OAuth callback:', {
      error: error.message,
      stack: error.stack,
      ip: req.ip
    });

    console.error('ðŸ’¥ Google OAuth callback error:', error);

    res.redirect(`${process.env.FRONTEND_URL}#auth=error&message=${encodeURIComponent('Error en autenticaciÃ³n con Google')}&autoShowLogin=true`);
  }
});

const logout = catchAsync(async (req, res) => {
  logger.info('ðŸ” LOGOUT:', {
    userId: req.user.id,
    username: req.user.username,
    ip: req.ip
  });

  await prisma.user.update({
    where: { id: req.user.id },
    data: { lastActiveAt: new Date() }
  });

  logger.logAuth('logout', req.user.id, req.user.email, true, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    message: 'SesiÃ³n cerrada exitosamente',
    timestamp: new Date().toISOString()
  });
});

const refreshToken = catchAsync(async (req, res) => {
  const { refreshToken: token } = req.body;

  if (!token) {
    throw new AppError('Refresh token requerido', 400, 'REFRESH_TOKEN_REQUIRED');
  }

  try {
    const decoded = verifyRefreshToken(token);
    
    if (decoded.type !== 'refresh') {
      throw new AppError('Token invÃ¡lido', 401, 'INVALID_REFRESH_TOKEN');
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        isActive: true,
        isBanned: true,
        canLogin: true,
        accountStatus: true
      }
    });

    if (!user || !user.isActive || user.isBanned || !user.canLogin) {
      throw new AppError('Usuario no vÃ¡lido', 401, 'INVALID_USER');
    }

    const newToken = generateToken(user.id);
    const newRefreshToken = generateRefreshToken(user.id);

    logger.logAuth('refresh_token', user.id, user.email, true, { ip: req.ip });

    res.status(200).json({
      success: true,
      message: 'Token renovado exitosamente',
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.logAuth('refresh_token', null, null, false, {
      error: error.message,
      ip: req.ip
    });
    
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      throw new AppError('Refresh token invÃ¡lido o expirado', 401, 'INVALID_REFRESH_TOKEN');
    }
    throw error;
  }
});

const getUserProfile = catchAsync(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: {
      escort: true,
      agency: true,
      client: true,
      admin: true,
      settings: true,
      reputation: true,
      location: true,
      posts: {
        where: { isActive: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          images: true,
          views: true,
          likes: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          posts: { where: { isActive: true } },
          favorites: true,
          likes: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  const profileUserResponse = {
    ...createUserResponse(user),
    posts: user.posts,
    stats: user._count
  };

  res.status(200).json({
    success: true,
    data: profileUserResponse,
    timestamp: new Date().toISOString()
  });
});

const forgotPassword = catchAsync(async (req, res) => {
  const { email } = req.body;

  console.log('ðŸ” FORGOT PASSWORD SOLICITADO:', { email, ip: req.ip });
  logger.info('ðŸ” INICIANDO FORGOT PASSWORD:', { email, ip: req.ip });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() }
  });

  const successResponse = {
    success: true,
    message: 'Si el email existe, se ha enviado un enlace de restablecimiento',
    timestamp: new Date().toISOString()
  };

  if (!user) {
    logger.logAuth('forgot_password', null, email, false, {
      reason: 'email_not_found',
      ip: req.ip
    });
    console.log('âŒ Usuario no encontrado para email:', email);
    return res.status(200).json(successResponse);
  }

  console.log('âœ… Usuario encontrado:', { id: user.id, email: user.email, firstName: user.firstName });

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

  console.log('ðŸ”‘ Token generado:', { resetToken, expiry: resetTokenExpiry });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: resetToken,
      passwordResetExpiry: resetTokenExpiry
    }
  });

  console.log('ðŸ’¾ Token guardado en base de datos');

  try {
    console.log('ðŸ“§ Intentando enviar email de reset...');
    
    const emailSent = await sendPasswordResetEmail(user, resetToken);
    
    if (emailSent) {
      console.log('âœ… Email de reset enviado exitosamente');
      logger.info('âœ… Email de reset enviado exitosamente:', {
        userId: user.id,
        email: user.email,
        ip: req.ip
      });
    } else {
      console.log('âŒ No se pudo enviar email de reset');
      logger.warn('âŒ No se pudo enviar email de reset:', {
        userId: user.id,
        email: user.email,
        reason: 'email_service_error'
      });
      
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
          success: false,
          message: 'Error enviando email de restablecimiento',
          error: 'EMAIL_SEND_FAILED',
          debug: {
            emailConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
            userFound: true,
            tokenGenerated: true
          },
          timestamp: new Date().toISOString()
        });
      }
    }
  } catch (emailError) {
    console.error('ðŸ’¥ Error enviando email de reset:', emailError);
    logger.error('ðŸ’¥ Error enviando email de reset:', {
      userId: user.id,
      email: user.email,
      error: emailError.message,
      code: emailError.code
    });
    
    if (process.env.NODE_ENV === 'development') {
      return res.status(500).json({
        success: false,
        message: 'Error enviando email de restablecimiento',
        error: emailError.message,
        code: emailError.code,
        debug: {
          emailConfigured: !!process.env.EMAIL_USER && !!process.env.EMAIL_PASS,
          userFound: true,
          tokenGenerated: true,
          errorType: emailError.code || 'UNKNOWN'
        },
        timestamp: new Date().toISOString()
      });
    }
  }

  logger.logAuth('forgot_password', user.id, email, true, { ip: req.ip });

  res.status(200).json(successResponse);
});

const resetPassword = catchAsync(async (req, res) => {
  const { token, password } = req.body;

  console.log('ðŸ” RESET PASSWORD SOLICITADO:', { hasToken: !!token, hasPassword: !!password, ip: req.ip });

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpiry: {
        gt: new Date()
      }
    }
  });

  if (!user) {
    logger.warn('âŒ Token de reset invÃ¡lido o expirado:', { token, ip: req.ip });
    throw new AppError('Token de restablecimiento invÃ¡lido o expirado', 400, 'INVALID_RESET_TOKEN');
  }

  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      passwordResetToken: null,
      passwordResetExpiry: null,
      updatedAt: new Date()
    }
  });

  logger.info('âœ… ContraseÃ±a restablecida exitosamente:', {
    userId: user.id,
    email: user.email,
    ip: req.ip
  });

  logger.logAuth('reset_password', user.id, user.email, true, { ip: req.ip });

  res.status(200).json({
    success: true,
    message: 'ContraseÃ±a restablecida exitosamente',
    timestamp: new Date().toISOString()
  });
});

const verifyEmail = catchAsync(async (req, res) => {
  const { token } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      emailVerificationToken: token,
      emailVerified: false
    }
  });

  if (!user) {
    throw new AppError('Token de verificaciÃ³n invÃ¡lido', 400, 'INVALID_VERIFICATION_TOKEN');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerifiedAt: new Date()
    }
  });

  logger.logAuth('verify_email', user.id, user.email, true);

  res.status(200).json({
    success: true,
    message: 'Email verificado exitosamente',
    timestamp: new Date().toISOString()
  });
});

const resendVerification = catchAsync(async (req, res) => {
  const user = req.user;

  if (user.emailVerified) {
    throw new AppError('El email ya estÃ¡ verificado', 400, 'EMAIL_ALREADY_VERIFIED');
  }

  const verificationToken = crypto.randomBytes(32).toString('hex');

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: verificationToken
    }
  });

  logger.info('Email verification resent', {
    userId: user.id,
    email: user.email
  });

  res.status(200).json({
    success: true,
    message: 'Email de verificaciÃ³n reenviado',
    timestamp: new Date().toISOString()
  });
});

const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = req.user;

  const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isCurrentPasswordValid) {
    logger.logAuth('change_password', user.id, user.email, false, {
      reason: 'invalid_current_password',
      ip: req.ip
    });
    throw new AppError('ContraseÃ±a actual incorrecta', 400, 'INVALID_CURRENT_PASSWORD');
  }

  const isSamePassword = await bcrypt.compare(newPassword, user.password);
  if (isSamePassword) {
    throw new AppError('La nueva contraseÃ±a debe ser diferente a la actual', 400, 'SAME_PASSWORD');
  }

  const saltRounds = 12;
  const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedNewPassword,
      updatedAt: new Date()
    }
  });

  logger.logAuth('change_password', user.id, user.email, true, { ip: req.ip });

  res.status(200).json({
    success: true,
    message: 'ContraseÃ±a cambiada exitosamente',
    timestamp: new Date().toISOString()
  });
});

const testEmail = catchAsync(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('Endpoint de prueba no disponible en producciÃ³n', 403, 'TEST_DISABLED');
  }

  const { email, type } = req.body;

  if (!email) {
    throw new AppError('Email es requerido', 400, 'EMAIL_REQUIRED');
  }

  const testUser = {
    id: 'test-user-id',
    firstName: 'Usuario',
    lastName: 'Prueba',
    email: email,
    userType: 'CLIENT'
  };

  const testToken = 'test-token-123456789';

  try {
    let result = false;
    let emailType = '';

    switch (type) {
      case 'reset':
        result = await sendPasswordResetEmail(testUser, testToken);
        emailType = 'restablecimiento de contraseÃ±a';
        break;
      case 'welcome':
        const { sendWelcomeEmail } = require('../services/authService');
        result = await sendWelcomeEmail(testUser);
        emailType = 'bienvenida';
        break;
      case 'verification':
        const { sendVerificationEmail } = require('../services/authService');
        result = await sendVerificationEmail(testUser, testToken);
        emailType = 'verificaciÃ³n';
        break;
      case 'agency_pending':
        result = await sendAgencyPendingEmail(testUser, {
          companyName: 'Agencia de Prueba',
          businessLicense: 'TEST-123',
          contactPerson: 'Juan PÃ©rez',
          address: 'Calle Test 123'
        });
        emailType = 'solicitud de agencia pendiente';
        break;
      default:
        throw new AppError('Tipo de email no vÃ¡lido. Usa: reset, welcome, verification, agency_pending', 400, 'INVALID_TYPE');
    }

    if (result) {
      logger.info('âœ… Email de prueba enviado exitosamente:', {
        type: emailType,
        to: email,
        timestamp: new Date().toISOString()
      });

      res.status(200).json({
        success: true,
        message: `Email de ${emailType} enviado exitosamente`,
        data: {
          emailType,
          recipient: email,
          timestamp: new Date().toISOString()
        }
      });
    } else {
      throw new AppError(`Error enviando email de ${emailType}`, 500, 'EMAIL_SEND_ERROR');
    }
  } catch (error) {
    logger.error('âŒ Error en prueba de email:', {
      error: error.message,
      type,
      email,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
});

module.exports = {
  register,
  registerAgency,
  login,
  logout,
  refreshToken,
  getUserProfile,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  changePassword,
  googleAuth,
  googleCallback,
  testEmail
};