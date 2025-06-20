const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const { uploadToCloudinary, getCloudinaryUsage, deleteFromCloudinary } = require('../services/uploadService');
const logger = require('../utils/logger');

// ✅ CORREGIDO: Obtener perfil del usuario autenticado
const getUserProfile = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;
  console.log('🔍 Obteniendo perfil para usuario:', userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      escort: true,
      agency: true,
      client: true,
      settings: true,
      reputation: true,
      location: true,
      _count: {
        select: {
          posts: { where: { isActive: true } },
          likes: true,
          favorites: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  console.log('✅ Usuario encontrado:', user.username, `(${user.userType})`);

  // Respuesta sin datos sensibles
  const userResponse = {
    id: user.id,
    email: user.email,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    phone: user.phone,
    bio: user.bio,
    website: user.website,
    profileViews: user.profileViews,
    isActive: user.isActive,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastActiveAt: user.lastActiveAt,
    location: user.location,
    settings: user.settings,
    reputation: user.reputation,
    stats: user._count,
    [user.userType.toLowerCase()]: user[user.userType.toLowerCase()]
  };

  res.status(200).json({
    success: true,
    data: userResponse,
    timestamp: new Date().toISOString()
  });
});

// ✅ SOLUCION COMPLETA: updateUserProfile corregido con transacciones
const updateUserProfile = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;
  console.log('🔍 Actualizando perfil para usuario:', userId);
  console.log('📥 Datos recibidos:', Object.keys(req.body));

  const {
    firstName,
    lastName,
    bio,
    phone,
    website,
    locationId,
    // Campos específicos para escorts
    age,
    height,
    weight,
    bodyType,
    ethnicity,
    hairColor,
    eyeColor,
    services,
    rates,
    availability,
    languages,
    specialties,
    hobbies,
    personalityTraits,
    outcallAreas,
    measurements,
    workingHours,
    socialMedia,
    aboutMe,
    education,
    incallLocation,
    experience,
    preferredClientType
  } = req.body;

  try {
    // ✅ PREPARAR DATOS DE ACTUALIZACIÓN BÁSICOS
    const updateData = {
      ...(firstName && { firstName: sanitizeString(firstName) }),
      ...(lastName && { lastName: sanitizeString(lastName) }),
      ...(bio !== undefined && { bio: sanitizeString(bio) || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(website !== undefined && { website: website || null }),
      ...(locationId !== undefined && { locationId: locationId || null }),
      updatedAt: new Date()
    };

    console.log('📤 Datos básicos a actualizar:', Object.keys(updateData));

    // ✅ USAR TRANSACCIÓN PARA ACTUALIZAR TODO JUNTO
    const result = await prisma.$transaction(async (tx) => {
      // 1. Actualizar datos básicos del usuario
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: updateData,
        include: {
          escort: true,
          agency: true,
          client: true,
          settings: true,
          reputation: true,
          location: true
        }
      });

      // 2. Si es ESCORT, actualizar/crear datos específicos
      if (req.user.userType === 'ESCORT') {
        console.log('🏷️ Procesando datos de ESCORT...');
        
        // Preparar datos específicos de escort
        const escortUpdateData = {};
        
        // Solo agregar campos que tienen valor
        if (age !== undefined && age !== '') escortUpdateData.age = parseInt(age) || null;
        if (height !== undefined && height !== '') escortUpdateData.height = parseInt(height) || null;
        if (weight !== undefined && weight !== '') escortUpdateData.weight = parseInt(weight) || null;
        if (bodyType !== undefined && bodyType !== '') escortUpdateData.bodyType = bodyType;
        if (ethnicity !== undefined && ethnicity !== '') escortUpdateData.ethnicity = ethnicity;
        if (hairColor !== undefined && hairColor !== '') escortUpdateData.hairColor = hairColor;
        if (eyeColor !== undefined && eyeColor !== '') escortUpdateData.eyeColor = eyeColor;
        if (experience !== undefined && experience !== '') escortUpdateData.experience = experience;
        if (preferredClientType !== undefined && preferredClientType !== '') escortUpdateData.preferredClientType = preferredClientType;
        if (aboutMe !== undefined && aboutMe !== '') escortUpdateData.aboutMe = sanitizeString(aboutMe) || null;
        if (education !== undefined && education !== '') escortUpdateData.education = sanitizeString(education) || null;
        if (incallLocation !== undefined && incallLocation !== '') escortUpdateData.incallLocation = sanitizeString(incallLocation) || null;

        // Arrays y objetos (solo si tienen contenido)
        if (services && Array.isArray(services) && services.length > 0) escortUpdateData.services = services;
        if (languages && Array.isArray(languages) && languages.length > 0) escortUpdateData.languages = languages;
        if (specialties && Array.isArray(specialties) && specialties.length > 0) escortUpdateData.specialties = specialties;
        if (hobbies && Array.isArray(hobbies) && hobbies.length > 0) escortUpdateData.hobbies = hobbies;
        if (personalityTraits && Array.isArray(personalityTraits) && personalityTraits.length > 0) escortUpdateData.personalityTraits = personalityTraits;
        if (outcallAreas && Array.isArray(outcallAreas) && outcallAreas.length > 0) escortUpdateData.outcallAreas = outcallAreas;

        if (rates && typeof rates === 'object' && Object.keys(rates).length > 0) escortUpdateData.rates = rates;
        if (availability && typeof availability === 'object' && Object.keys(availability).length > 0) escortUpdateData.availability = availability;
        if (measurements && typeof measurements === 'object' && Object.keys(measurements).length > 0) escortUpdateData.measurements = measurements;
        if (workingHours && typeof workingHours === 'object' && Object.keys(workingHours).length > 0) escortUpdateData.workingHours = workingHours;
        if (socialMedia && typeof socialMedia === 'object' && Object.keys(socialMedia).length > 0) escortUpdateData.socialMedia = socialMedia;

        console.log('📤 Datos de escort a actualizar:', Object.keys(escortUpdateData));

        // ✅ USAR UPSERT PARA CREAR O ACTUALIZAR REGISTRO DE ESCORT
        if (Object.keys(escortUpdateData).length > 0) {
          await tx.escort.upsert({
            where: { userId },
            update: escortUpdateData,
            create: {
              userId,
              ...escortUpdateData
            }
          });
          console.log('✅ Datos de escort actualizados/creados');
        }
      }

      // 3. Calcular nueva completitud del perfil
      const profileCompleteness = calculateProfileCompleteness(updatedUser);
      
      // 4. Actualizar score de reputación
      await tx.userReputation.upsert({
        where: { userId },
        update: {
          profileCompleteness,
          lastScoreUpdate: new Date()
        },
        create: {
          userId,
          profileCompleteness,
          overallScore: 50, // Score inicial
          trustScore: 50,
          discoveryScore: 50,
          trendingScore: 50,
          qualityScore: 50
        }
      });

      // 5. Obtener usuario final actualizado
      const finalUser = await tx.user.findUnique({
        where: { id: userId },
        include: {
          escort: true,
          agency: true,
          client: true,
          settings: true,
          reputation: true,
          location: true
        }
      });

      return finalUser;
    });

    logger.info('Profile updated', {
      userId,
      updatedFields: Object.keys(updateData),
      userType: req.user.userType
    });

    // ✅ RESPUESTA SIN DATOS SENSIBLES
    const userResponse = {
      id: result.id,
      email: result.email,
      username: result.username,
      firstName: result.firstName,
      lastName: result.lastName,
      avatar: result.avatar,
      userType: result.userType,
      phone: result.phone,
      bio: result.bio,
      website: result.website,
      profileViews: result.profileViews,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      location: result.location,
      settings: result.settings,
      reputation: result.reputation,
      [result.userType.toLowerCase()]: result[result.userType.toLowerCase()]
    };

    res.status(200).json({
      success: true,
      message: 'Perfil actualizado exitosamente',
      data: userResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error actualizando perfil:', error);
    
    // ✅ MANEJO ESPECÍFICO DE ERRORES DE PRISMA
    if (error.code === 'P2002') {
      throw new AppError('Ya existe un registro con estos datos únicos', 409, 'UNIQUE_CONSTRAINT_ERROR');
    } else if (error.code === 'P2025') {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    } else if (error.code === 'P2016') {
      throw new AppError('Error en la consulta a la base de datos', 400, 'QUERY_INTERPRETATION_ERROR');
    }
    
    throw new AppError('Error actualizando perfil', 500, 'UPDATE_PROFILE_ERROR');
  }
});

// ✅ SOLUCIÓN RÁPIDA: uploadProfilePicture SIN eliminación de avatar anterior
const uploadProfilePicture = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }
  const userId = req.user.id;
  if (!req.file) {
    throw new AppError('No se proporcionó ningún archivo', 400, 'NO_FILE');
  }
  // ✅ VERIFICAR QUE EL ARCHIVO SE SUBIÓ A CLOUDINARY CORRECTAMENTE
  if (!req.uploadedFile) {
    throw new AppError('Error procesando el archivo', 500, 'FILE_PROCESSING_ERROR');
  }
  try {
    // ✅ ACTUALIZAR AVATAR DEL USUARIO CON LA URL DE CLOUDINARY YA PROCESADA
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        avatar: req.uploadedFile.secure_url, // ✅ Usar la URL ya procesada por el middleware
        updatedAt: new Date()
      },
      select: {
        id: true,
        avatar: true,
        firstName: true,
        lastName: true,
        userType: true
      }
    });
    // ✅ COMENTAR TEMPORALMENTE LA ELIMINACIÓN DEL AVATAR ANTERIOR
    // TODO: Implementar eliminación de avatar anterior de forma segura
    /*
    if (currentUser.avatar && currentUser.avatar.includes('cloudinary.com')) {
      try {
        const publicId = extractPublicIdFromUrl(currentUser.avatar);
        if (publicId) {
          await deleteFromCloudinary(publicId);
        }
      } catch (deleteError) {
        logger.warn('Could not delete old avatar from Cloudinary', {
          userId,
          error: deleteError.message
        });
      }
    }
    */
    logger.info('Avatar uploaded successfully', {
      userId,
      avatarUrl: req.uploadedFile.secure_url,
      fileSize: req.file.size,
      publicId: req.uploadedFile.public_id
    });
    // ✅ RESPUESTA EXITOSA CON INFORMACIÓN COMPLETA
    res.status(200).json({
      success: true,
      message: 'Foto de perfil actualizada exitosamente',
      data: {
        user: updatedUser,
        avatar: req.uploadedFile.secure_url,
        cloudinary: {
          public_id: req.uploadedFile.public_id,
          format: req.uploadedFile.format,
          width: req.uploadedFile.width,
          height: req.uploadedFile.height,
          bytes: req.uploadedFile.bytes
        }
      },
      uploadedFile: {
        url: req.uploadedFile.secure_url,
        publicId: req.uploadedFile.public_id,
        size: req.uploadedFile.bytes,
        format: req.uploadedFile.format,
        width: req.uploadedFile.width,
        height: req.uploadedFile.height,
        optimized: req.uploadedFile.optimized || false
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Error in uploadProfilePicture:', {
      error: error.message,
      stack: error.stack,
      userId,
      hasUploadedFile: !!req.uploadedFile
    });
    
    // ✅ MEJOR MANEJO DE ERRORES
    if (error.code === 'P2025') {
      throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
    } else if (error.message && error.message.includes('Cloudinary')) {
      throw new AppError('Error procesando la imagen en Cloudinary', 500, 'CLOUDINARY_ERROR');
    }
    
    throw new AppError('Error actualizando foto de perfil', 500, 'AVATAR_UPDATE_ERROR');
  }
});

// Eliminar foto de perfil - MEJORADO
const deleteProfilePicture = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;
  
  // Obtener avatar actual
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true }
  });

  // Eliminar de Cloudinary si existe
  if (currentUser.avatar && currentUser.avatar.includes('cloudinary')) {
    try {
      const publicId = extractPublicIdFromUrl(currentUser.avatar);
      if (publicId) {
        await deleteFromCloudinary(publicId);
        logger.info('Avatar deleted from Cloudinary', { userId, publicId });
      }
    } catch (error) {
      logger.warn('Could not delete avatar from Cloudinary', {
        userId,
        avatar: currentUser.avatar,
        error: error.message
      });
    }
  }

  // Actualizar base de datos
  await prisma.user.update({
    where: { id: userId },
    data: { 
      avatar: null,
      updatedAt: new Date()
    }
  });

  logger.info('Profile picture deleted', { userId });

  res.status(200).json({
    success: true,
    message: 'Foto de perfil eliminada exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Obtener perfil de usuario por ID
const getUserById = catchAsync(async (req, res) => {
  const { userId } = req.params;
  const viewerId = req.user?.id;

  // Verificar si el usuario existe
  const user = await prisma.user.findUnique({
    where: { 
      id: userId,
      isActive: true
    },
    include: {
      escort: true,
      agency: true,
      client: false, // Los clientes no muestran perfil público
      settings: true,
      reputation: true,
      location: true,
      posts: {
        where: { 
          isActive: true,
          ...(req.user?.userType !== 'CLIENT' || req.user?.client?.canAccessPremiumProfiles ? {} : { premiumOnly: false })
        },
        take: 12,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          images: true,
          views: true,
          likes: {
            select: { id: true }
          },
          createdAt: true,
          isFeatured: true,
          premiumOnly: true
        }
      },
      _count: {
        select: {
          posts: { where: { isActive: true } },
          likes: true,
          favorites: true
        }
      }
    }
  });

  if (!user) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar configuraciones de privacidad
  if (!user.settings?.showInSearch && viewerId !== userId) {
    throw new AppError('Perfil no disponible', 403, 'PROFILE_PRIVATE');
  }

  // Los clientes no tienen perfil público
  if (user.userType === 'CLIENT' && viewerId !== userId) {
    throw new AppError('Perfil no disponible', 403, 'CLIENT_PROFILE_PRIVATE');
  }

  // Registrar vista del perfil (solo si no es el mismo usuario)
  if (viewerId && viewerId !== userId) {
    // Incrementar views del perfil
    await prisma.user.update({
      where: { id: userId },
      data: { profileViews: { increment: 1 } }
    });

    // Registrar interacción para algoritmos
    await prisma.userInteraction.create({
      data: {
        userId: viewerId,
        targetUserId: userId,
        type: 'PROFILE_VISIT',
        weight: 2.0,
        deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
        source: 'profile'
      }
    });

    // Actualizar métricas de reputación
    await prisma.userReputation.update({
      where: { userId },
      data: { 
        totalViews: { increment: 1 },
        lastScoreUpdate: new Date()
      }
    });

    logger.info('Profile viewed', {
      viewerId,
      profileId: userId,
      viewerType: req.user?.userType
    });
  }

  // Verificar si el viewer ya le dio like o lo tiene en favoritos
  let isLiked = false;
  let isFavorited = false;

  if (viewerId && viewerId !== userId) {
    const [likeExists, favoriteExists] = await Promise.all([
      prisma.like.findFirst({
        where: {
          userId: viewerId,
          post: {
            authorId: userId
          }
        }
      }),
      prisma.favorite.findFirst({
        where: {
          userId: viewerId,
          post: {
            authorId: userId
          }
        }
      })
    ]);

    isLiked = !!likeExists;
    isFavorited = !!favoriteExists;
  }

  // Preparar respuesta según el tipo de usuario
  const userResponse = {
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    bio: user.bio,
    profileViews: user.profileViews,
    createdAt: user.createdAt,
    location: user.location,
    reputation: {
      overallScore: user.reputation?.overallScore || 0,
      trustScore: user.reputation?.trustScore || 0,
      profileCompleteness: user.reputation?.profileCompleteness || 0
    },
    posts: user.posts.map(post => ({
      ...post,
      likesCount: post.likes.length,
      isLiked: post.likes.some(like => like.userId === viewerId)
    })),
    stats: {
      ...user._count,
      isLiked,
      isFavorited
    }
  };

  // Datos específicos según tipo de usuario
  if (user.userType === 'ESCORT' && user.escort) {
    userResponse.escort = {
      ...user.escort,
      // Ocultar información sensible según configuraciones
      ...(user.settings?.showPhoneNumber === false && { phone: null }),
    };
  } else if (user.userType === 'AGENCY' && user.agency) {
    userResponse.agency = user.agency;
    userResponse.website = user.website;
  }

  // Solo mostrar teléfono si está configurado para mostrarse
  if (user.settings?.showPhoneNumber) {
    userResponse.phone = user.phone;
  }

  res.status(200).json({
    success: true,
    data: userResponse,
    timestamp: new Date().toISOString()
  });
});

// Buscar usuarios
const searchUsers = catchAsync(async (req, res) => {
  const {
    q: query,
    userType,
    location,
    verified,
    page = 1,
    limit = 20,
    sortBy = 'relevance'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Construir filtros de búsqueda
  const whereClause = {
    isActive: true,
    isBanned: false,
    userType: userType ? userType.toUpperCase() : undefined,
    ...(query && {
      OR: [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { username: { contains: query, mode: 'insensitive' } },
        { bio: { contains: query, mode: 'insensitive' } }
      ]
    }),
    ...(location && {
      location: {
        OR: [
          { country: { contains: location, mode: 'insensitive' } },
          { city: { contains: location, mode: 'insensitive' } }
        ]
      }
    }),
    ...(verified === 'true' && {
      OR: [
        { escort: { isVerified: true } },
        { agency: { isVerified: true } }
      ]
    }),
    // Filtros de privacidad
    settings: {
      showInSearch: true
    }
  };

  // Configurar ordenamiento
  let orderBy = {};
  switch (sortBy) {
    case 'newest':
      orderBy = { createdAt: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'popular':
      orderBy = { profileViews: 'desc' };
      break;
    case 'rating':
      orderBy = { reputation: { overallScore: 'desc' } };
      break;
    default: // relevance
      orderBy = [
        { reputation: { discoveryScore: 'desc' } },
        { profileViews: 'desc' },
        { createdAt: 'desc' }
      ];
  }

  // Realizar búsqueda
  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: whereClause,
      include: {
        escort: {
          select: {
            isVerified: true,
            rating: true,
            age: true,
            services: true
          }
        },
        agency: {
          select: {
            isVerified: true,
            totalEscorts: true
          }
        },
        reputation: {
          select: {
            overallScore: true,
            trustScore: true,
            profileCompleteness: true
          }
        },
        location: true,
        _count: {
          select: {
            posts: { where: { isActive: true } }
          }
        }
      },
      orderBy,
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.user.count({ where: whereClause })
  ]);

  // Registrar búsqueda en historial (solo usuarios autenticados)
  if (req.user && query) {
    await prisma.searchHistory.create({
      data: {
        userId: req.user.id,
        query,
        filters: { userType, location, verified, sortBy },
        results: totalCount
      }
    });
  }

  // Formatear resultados
  const searchResults = users.map(user => ({
    id: user.id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    avatar: user.avatar,
    userType: user.userType,
    bio: user.bio,
    profileViews: user.profileViews,
    location: user.location,
    reputation: user.reputation,
    stats: user._count,
    ...(user.escort && { escort: user.escort }),
    ...(user.agency && { agency: user.agency })
  }));

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      users: searchResults,
      pagination,
      filters: {
        query,
        userType,
        location,
        verified,
        sortBy
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener usuarios para descubrir
const getDiscoverUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user?.id || null;

  // Obtener usuarios recomendados basado en algoritmo
  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        isBanned: false,
        ...(userId && { NOT: { id: userId } }),
        settings: {
          showInDiscovery: true
        }
      },
      include: {
        escort: {
          select: {
            isVerified: true,
            rating: true,
            age: true
          }
        },
        agency: {
          select: {
            isVerified: true,
            totalEscorts: true
          }
        },
        reputation: {
          select: {
            overallScore: true,
            discoveryScore: true
          }
        },
        location: true
      },
      orderBy: [
        { reputation: { discoveryScore: 'desc' } },
        { createdAt: 'desc' }
      ],
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.user.count({
      where: {
        isActive: true,
        isBanned: false,
        ...(userId && { NOT: { id: userId } }),
        settings: {
          showInDiscovery: true
        }
      }
    })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        userType: user.userType,
        bio: user.bio,
        location: user.location,
        reputation: user.reputation,
        ...(user.escort && { escort: user.escort }),
        ...(user.agency && { agency: user.agency })
      })),
      pagination
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener usuarios en tendencia
const getTrendingUsers = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user?.id || null;

  const [users, totalCount] = await Promise.all([
    prisma.user.findMany({
      where: {
        isActive: true,
        isBanned: false,
        ...(userId && { NOT: { id: userId } }),
        settings: {
          showInTrending: true
        }
      },
      include: {
        escort: {
          select: {
            isVerified: true,
            rating: true
          }
        },
        agency: {
          select: {
            isVerified: true,
            totalEscorts: true
          }
        },
        reputation: {
          select: {
            overallScore: true,
            trendingScore: true
          }
        },
        location: true
      },
      orderBy: [
        { reputation: { trendingScore: 'desc' } },
        { profileViews: 'desc' }
      ],
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.user.count({
      where: {
        isActive: true,
        isBanned: false,
        ...(userId && { NOT: { id: userId } }),
        settings: {
          showInTrending: true
        }
      }
    })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      users: users.map(user => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        avatar: user.avatar,
        userType: user.userType,
        bio: user.bio,
        location: user.location,
        reputation: user.reputation,
        ...(user.escort && { escort: user.escort }),
        ...(user.agency && { agency: user.agency })
      })),
      pagination
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener estadísticas del usuario
const getUserStats = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;

  const stats = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      _count: {
        select: {
          posts: { where: { isActive: true } },
          likes: true,
          favorites: true,
          sentMessages: true,
          receivedMessages: true
        }
      }
    }
  });

  if (!stats) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  const userStats = {
    profileViews: stats.profileViews,
    totalPosts: stats._count.posts,
    totalLikes: stats._count.likes,
    totalFavorites: stats._count.favorites,
    totalMessages: stats._count.sentMessages + stats._count.receivedMessages
  };

  res.status(200).json({
    success: true,
    data: userStats,
    timestamp: new Date().toISOString()
  });
});

// Reportar usuario
const reportUser = catchAsync(async (req, res) => {
  const reporterId = req.user?.id;
  if (!reporterId) {
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const { userId: reportedId } = req.params;
  const { reason, description, evidence } = req.body;

  if (reporterId === reportedId) {
    throw new AppError('No puedes reportarte a ti mismo', 400, 'CANNOT_REPORT_SELF');
  }

  // Verificar que el usuario existe
  const userToReport = await prisma.user.findUnique({
    where: { id: reportedId },
    select: { id: true, username: true }
  });

  if (!userToReport) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  // Crear reporte
  await prisma.userReport.create({
    data: {
      reporterId,
      reportedId,
      reason,
      description: description || null,
      evidence: evidence || []
    }
  });

  logger.info('User reported', {
    reporterId,
    reportedId,
    reason,
    reportedUsername: userToReport.username
  });

  res.status(201).json({
    success: true,
    message: 'Reporte enviado exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Eliminar cuenta de usuario
const deleteUserAccount = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;
  const { password, reason } = req.body;

  // Verificar contraseña
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true }
  });

  const bcrypt = require('bcryptjs');
  const isValidPassword = await bcrypt.compare(password, user.password);
  
  if (!isValidPassword) {
    throw new AppError('Contraseña incorrecta', 400, 'INVALID_PASSWORD');
  }

  // Marcar como inactivo en lugar de eliminar
  await prisma.user.update({
    where: { id: userId },
    data: {
      isActive: false,
      deletedAt: new Date(),
      deletionReason: reason || null
    }
  });

  logger.info('User account deleted', {
    userId,
    reason
  });

  res.status(200).json({
    success: true,
    message: 'Cuenta eliminada exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Obtener configuraciones del usuario
const getUserSettings = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;

  const settings = await prisma.userSettings.findUnique({
    where: { userId }
  });

  if (!settings) {
    throw new AppError('Configuraciones no encontradas', 404, 'SETTINGS_NOT_FOUND');
  }

  res.status(200).json({
    success: true,
    data: settings,
    timestamp: new Date().toISOString()
  });
});

// Actualizar configuraciones del usuario
const updateUserSettings = catchAsync(async (req, res) => {
  // ✅ AGREGAR VALIDACIÓN DE req.user
  if (!req.user || !req.user.id) {
    console.error('❌ ERROR: req.user is undefined or missing id:', req.user);
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const userId = req.user.id;
  const settingsData = req.body;

  // Validar que solo se actualicen campos permitidos
  const allowedFields = [
    'emailNotifications',
    'pushNotifications',
    'messageNotifications',
    'likeNotifications',
    'boostNotifications',
    'showOnline',
    'showLastSeen',
    'allowDirectMessages',
    'showPhoneNumber',
    'showInDiscovery',
    'showInTrending',
    'showInSearch',
    'contentFilter'
  ];

  const updateData = {};
  allowedFields.forEach(field => {
    if (settingsData[field] !== undefined) {
      updateData[field] = settingsData[field];
    }
  });

  if (Object.keys(updateData).length === 0) {
    throw new AppError('No se proporcionaron campos válidos para actualizar', 400, 'NO_VALID_FIELDS');
  }

  const updatedSettings = await prisma.userSettings.update({
    where: { userId },
    data: {
      ...updateData,
      updatedAt: new Date()
    }
  });

  logger.info('User settings updated', {
    userId,
    updatedFields: Object.keys(updateData)
  });

  res.status(200).json({
    success: true,
    message: 'Configuraciones actualizadas exitosamente',
    data: updatedSettings,
    timestamp: new Date().toISOString()
  });
});

// Bloquear usuario
const blockUser = catchAsync(async (req, res) => {
  const blockerId = req.user?.id;
  if (!blockerId) {
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const { userId: blockedId } = req.params;
  const { reason } = req.body;

  if (blockerId === blockedId) {
    throw new AppError('No puedes bloquearte a ti mismo', 400, 'CANNOT_BLOCK_SELF');
  }

  // Verificar que el usuario a bloquear existe
  const userToBlock = await prisma.user.findUnique({
    where: { id: blockedId },
    select: { id: true, username: true, userType: true }
  });

  if (!userToBlock) {
    throw new AppError('Usuario no encontrado', 404, 'USER_NOT_FOUND');
  }

  // Verificar si ya está bloqueado
  const existingBlock = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId
      }
    }
  });

  if (existingBlock) {
    throw new AppError('Usuario ya está bloqueado', 409, 'USER_ALREADY_BLOCKED');
  }

  // Crear bloqueo
  await prisma.userBlock.create({
    data: {
      blockerId,
      blockedId,
      reason: reason || null
    }
  });

  logger.info('User blocked', {
    blockerId,
    blockedId,
    blockedUsername: userToBlock.username,
    reason
  });

  res.status(200).json({
    success: true,
    message: 'Usuario bloqueado exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Desbloquear usuario
const unblockUser = catchAsync(async (req, res) => {
  const blockerId = req.user?.id;
  if (!blockerId) {
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const { userId: blockedId } = req.params;

  const block = await prisma.userBlock.findUnique({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId
      }
    }
  });

  if (!block) {
    throw new AppError('Usuario no está bloqueado', 404, 'USER_NOT_BLOCKED');
  }

  await prisma.userBlock.delete({
    where: {
      blockerId_blockedId: {
        blockerId,
        blockedId
      }
    }
  });

  logger.info('User unblocked', {
    blockerId,
    blockedId
  });

  res.status(200).json({
    success: true,
    message: 'Usuario desbloqueado exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Obtener usuarios bloqueados
const getBlockedUsers = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new AppError('Usuario no autenticado', 401, 'USER_NOT_AUTHENTICATED');
  }

  const { page = 1, limit = 20 } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  const [blocks, totalCount] = await Promise.all([
    prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            userType: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.userBlock.count({
      where: { blockerId: userId }
    })
  ]);

  const pagination = {
    page: parseInt(page),
    limit: parseInt(limit),
    total: totalCount,
    pages: Math.ceil(totalCount / parseInt(limit)),
    hasNext: parseInt(page) * parseInt(limit) < totalCount,
    hasPrev: parseInt(page) > 1
  };

  res.status(200).json({
    success: true,
    data: {
      blocks: blocks.map(block => ({
        id: block.id,
        reason: block.reason,
        createdAt: block.createdAt,
        user: block.blocked
      })),
      pagination
    },
    timestamp: new Date().toISOString()
  });
});

// NUEVO: Obtener estadísticas de Cloudinary
const getCloudinaryStats = catchAsync(async (req, res) => {
  // Solo admins pueden ver estas estadísticas
  if (!req.user || req.user.userType !== 'ADMIN') {
    throw new AppError('Acceso denegado', 403, 'ACCESS_DENIED');
  }

  const usage = await getCloudinaryUsage();
  
  res.status(200).json({
    success: true,
    data: usage,
    timestamp: new Date().toISOString()
  });
});

// ✅ FUNCIÓN HELPER PARA CALCULAR COMPLETITUD DEL PERFIL
const calculateProfileCompleteness = (user) => {
  let completeness = 0;
  const baseFields = ['firstName', 'lastName', 'bio', 'avatar', 'phone'];
  
  baseFields.forEach(field => {
    if (user[field]) {
      completeness += 20; // 100% / 5 campos base
    }
  });

  // Campos adicionales según tipo de usuario
  if (user.userType === 'ESCORT' && user.escort) {
    const escortFields = ['age', 'services', 'rates'];
    escortFields.forEach(field => {
      if (user.escort[field] && (Array.isArray(user.escort[field]) ? user.escort[field].length > 0 : true)) {
        completeness += 10; // Campos extras dan menos peso
      }
    });
  } else if (user.userType === 'AGENCY') {
    if (user.website) completeness += 10;
  }

  return Math.min(100, Math.round(completeness));
};

// Función helper para extraer public_id de URL de Cloudinary
const extractPublicIdFromUrl = (cloudinaryUrl) => {
  try {
    if (!cloudinaryUrl || !cloudinaryUrl.includes('cloudinary')) {
      return null;
    }
    
    // Extraer public_id de la URL de Cloudinary
    const matches = cloudinaryUrl.match(/\/v\d+\/(.+)\./);
    return matches ? matches[1] : null;
  } catch (error) {
    logger.error('Error extracting public_id from Cloudinary URL', {
      url: cloudinaryUrl,
      error: error.message
    });
    return null;
  }
};

module.exports = {
  getUserProfile,
  updateUserProfile,
  uploadProfilePicture,
  deleteProfilePicture,
  getUserById,
  searchUsers,
  getDiscoverUsers,
  getTrendingUsers,
  getUserStats,
  blockUser,
  unblockUser,
  getBlockedUsers,
  updateUserSettings,
  getUserSettings,
  deleteUserAccount,
  reportUser,
  getCloudinaryStats
};