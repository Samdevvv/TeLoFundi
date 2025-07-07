const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const { uploadToCloudinary, uploadMultipleToCloudinary, deleteFromCloudinary } = require('../services/uploadService');
const logger = require('../utils/logger');

// ✅ CREAR NUEVO POST - COMPLETAMENTE CORREGIDO
const createPost = catchAsync(async (req, res) => {
  // ✅ ASSERT DEFENSIVO - MÁS LIMPIO QUE VALIDACIÓN COMPLETA
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const userId = req.user.id;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📝 === CREATE POST DEBUG ===');
    console.log('📝 User ID:', userId);
    console.log('📝 Content-Type:', req.get('content-type'));
    console.log('📝 Body received:', Object.keys(req.body));
    console.log('📝 Files received:', req.files?.length || 0);
    console.log('📝 Uploaded files:', req.uploadedFiles?.length || 0);
    console.log('📝 === END DEBUG ===');
  }

  // ✅ EXTRAER DATOS DEL FORMDATA (req.body ya está parseado por multer)
  // ❌ ELIMINADO isPaidPost - No existe en el schema
  const {
    title,
    description,
    phone,
    locationId,
    services,
    rates,
    availability,
    tags,
    premiumOnly = false
  } = req.body;

  // ✅ VALIDACIÓN DE CAMPOS REQUERIDOS
  if (!title?.trim()) {
    throw new AppError('El título es obligatorio', 400, 'TITLE_REQUIRED');
  }
  
  if (!description?.trim()) {
    throw new AppError('La descripción es obligatoria', 400, 'DESCRIPTION_REQUIRED');
  }
  
  if (!phone?.trim()) {
    throw new AppError('El teléfono es obligatorio', 400, 'PHONE_REQUIRED');
  }

  // ✅ VERIFICAR LÍMITES SEGÚN TIPO DE USUARIO
  if (req.user.userType === 'ESCORT') {
    const currentPosts = await prisma.post.count({
      where: {
        authorId: userId,
        isActive: true
      }
    });

    // ✅ LÍMITE DE 5 POSTS GRATUITOS PARA ESCORTS
    const freePostsLimit = 5;
    
    if (currentPosts >= freePostsLimit) {
      throw new AppError(
        `Has alcanzado el límite máximo de ${freePostsLimit} anuncios activos`, 
        400, 
        'POST_LIMIT_REACHED'
      );
    }
  }

  // ✅ PROCESAR IMÁGENES SUBIDAS A CLOUDINARY
  let imageUrls = [];
  
  if (req.uploadedFiles && req.uploadedFiles.length > 0) {
    imageUrls = req.uploadedFiles.map(result => result.secure_url);
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Images uploaded to Cloudinary:', imageUrls.length);
    }
  } else if (req.files && req.files.length > 0) {
    // Fallback: si Cloudinary falló, reportar error
    console.log('❌ Cloudinary upload failed, but files were received');
    throw new AppError('Error subiendo las imágenes. Intenta de nuevo.', 500, 'IMAGE_UPLOAD_FAILED');
  } else {
    throw new AppError('Debes agregar al menos una imagen', 400, 'IMAGES_REQUIRED');
  }

  // ✅ PARSEAR DATOS JSON DESDE FORMDATA
  let parsedServices = [];
  let parsedRates = null;
  let parsedAvailability = null;
  let parsedTags = [];

  try {
    if (services) {
      parsedServices = typeof services === 'string' ? JSON.parse(services) : services;
    }
    if (rates) {
      parsedRates = typeof rates === 'string' ? JSON.parse(rates) : rates;
    }
    if (availability) {
      parsedAvailability = typeof availability === 'string' ? JSON.parse(availability) : availability;
    }
    if (tags) {
      parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    }
  } catch (parseError) {
    console.error('❌ Error parsing JSON fields:', parseError);
    throw new AppError('Error en el formato de los datos', 400, 'JSON_PARSE_ERROR');
  }

  // ✅ CREAR POST EN LA BASE DE DATOS - SIN isPaidPost
  const newPost = await prisma.post.create({
    data: {
      title: sanitizeString(title),
      description: sanitizeString(description),
      phone: phone || req.user.phone,
      images: imageUrls,
      locationId: locationId || req.user.locationId,
      services: Array.isArray(parsedServices) ? parsedServices.join(', ') : parsedServices || '', // String libre según specs
      rates: parsedRates,
      availability: parsedAvailability,
      premiumOnly: premiumOnly === 'true' && req.user.userType !== 'CLIENT',
      // ❌ ELIMINADO isPaidPost - No existe en el schema de Prisma
      authorId: userId,
      // Scores iniciales
      score: 10.0,
      discoveryScore: 15.0,
      qualityScore: calculateInitialQualityScore(title, description, imageUrls.length)
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true
        }
      },
      location: true,
      _count: {
        select: {
          likes: true,
          favorites: true
        }
      }
    }
  });

  // Actualizar contador de posts del escort
  if (req.user.userType === 'ESCORT') {
    await prisma.escort.update({
      where: { userId },
      data: { currentPosts: { increment: 1 } }
    });
  }

  // Procesar tags si los hay
  if (parsedTags && parsedTags.length > 0) {
    await Promise.all(
      parsedTags.map(async (tagName) => {
        // Buscar o crear tag
        const tag = await prisma.tag.upsert({
          where: { name: tagName.toLowerCase() },
          update: { usageCount: { increment: 1 } },
          create: {
            name: tagName.toLowerCase(),
            slug: tagName.toLowerCase().replace(/\s+/g, '-'),
            usageCount: 1
          }
        });

        // Crear relación
        return prisma.postTag.create({
          data: {
            postId: newPost.id,
            tagId: tag.id
          }
        });
      })
    );
  }

  // Actualizar métricas de reputación del usuario
  await prisma.userReputation.update({
    where: { userId },
    data: {
      qualityScore: { increment: 5 },
      lastScoreUpdate: new Date()
    }
  });

  logger.info('Post created successfully', {
    postId: newPost.id,
    userId,
    userType: req.user.userType,
    imagesCount: imageUrls.length,
    hasLocation: !!locationId,
    cloudinaryUploads: req.uploadedFiles?.length || 0
  });

  res.status(201).json({
    success: true,
    message: 'Anuncio creado exitosamente',
    data: {
      ...newPost,
      likesCount: newPost._count.likes,
      favoritesCount: newPost._count.favorites,
      isLiked: false,
      isFavorited: false
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ FUNCIÓN PARA VERIFICAR LÍMITES DE POSTS
const checkPostLimits = catchAsync(async (req, res) => {
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const userId = req.user.id;

  // Solo escorts tienen límites
  if (req.user.userType !== 'ESCORT') {
    return res.status(200).json({
      success: true,
      data: {
        canCreateFreePost: true,
        freePostsRemaining: -1, // Ilimitado para no-escorts
        totalPosts: 0,
        freePostsLimit: -1
      },
      timestamp: new Date().toISOString()
    });
  }

  const currentPosts = await prisma.post.count({
    where: {
      authorId: userId,
      isActive: true
    }
  });

  const freePostsLimit = 5; // ✅ CORREGIDO: 5 posts gratis para escorts
  const freePostsRemaining = Math.max(0, freePostsLimit - currentPosts);
  const canCreateFreePost = currentPosts < freePostsLimit;

  res.status(200).json({
    success: true,
    data: {
      canCreateFreePost,
      freePostsRemaining,
      totalPosts: currentPosts,
      freePostsLimit,
      message: canCreateFreePost 
        ? `Puedes crear ${freePostsRemaining} anuncios más` 
        : 'Has alcanzado el límite de anuncios gratuitos'
    },
    timestamp: new Date().toISOString()
  });
});

// ✅ ACTUALIZAR POST - OPTIMIZADO
const updatePost = catchAsync(async (req, res) => {
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const { postId } = req.params;
  const userId = req.user.id;
  
  if (process.env.NODE_ENV === 'development') {
    console.log('📝 === UPDATE POST DEBUG ===');
    console.log('📝 Post ID:', postId);
    console.log('📝 User ID:', userId);
    console.log('📝 Body received:', Object.keys(req.body));
    console.log('📝 Files received:', req.files?.length || 0);
    console.log('📝 === END DEBUG ===');
  }

  const {
    title,
    description,
    phone,
    locationId,
    services,
    rates,
    availability,
    tags,
    premiumOnly,
    removeImages // Array de URLs de imágenes a eliminar (JSON string)
  } = req.body;

  // Verificar que el post existe y pertenece al usuario
  const existingPost = await prisma.post.findFirst({
    where: {
      id: postId,
      authorId: userId,
      isActive: true
    }
  });

  if (!existingPost) {
    throw new AppError('Anuncio no encontrado o no tienes permisos', 404, 'POST_NOT_FOUND');
  }

  // ✅ PREPARAR DATOS DE ACTUALIZACIÓN
  const updateData = {
    ...(title && { title: sanitizeString(title) }),
    ...(description && { description: sanitizeString(description) }),
    ...(phone !== undefined && { phone }),
    ...(locationId !== undefined && { locationId }),
    ...(premiumOnly !== undefined && req.user.userType !== 'CLIENT' && { 
      premiumOnly: premiumOnly === 'true' 
    }),
    updatedAt: new Date()
  };

  // ✅ PARSEAR DATOS JSON DESDE FORMDATA
  try {
    if (services) {
      const parsedServices = typeof services === 'string' ? JSON.parse(services) : services;
      updateData.services = Array.isArray(parsedServices) ? parsedServices.join(', ') : parsedServices || '';
    }
    if (rates !== undefined) {
      updateData.rates = rates ? (typeof rates === 'string' ? JSON.parse(rates) : rates) : null;
    }
    if (availability !== undefined) {
      updateData.availability = availability ? (typeof availability === 'string' ? JSON.parse(availability) : availability) : null;
    }
  } catch (parseError) {
    console.error('❌ Error parsing JSON fields in update:', parseError);
    throw new AppError('Error en el formato de los datos', 400, 'JSON_PARSE_ERROR');
  }

  // Actualizar calidad si cambió contenido importante
  if (title || description) {
    updateData.qualityScore = calculateInitialQualityScore(
      title || existingPost.title,
      description || existingPost.description,
      existingPost.images.length
    );
    updateData.lastScoreUpdate = new Date();
  }

  // ✅ MANEJAR ELIMINACIÓN DE IMÁGENES
  let currentImages = [...existingPost.images];
  let imagesToRemove = [];
  
  if (removeImages) {
    try {
      imagesToRemove = typeof removeImages === 'string' ? JSON.parse(removeImages) : removeImages;
    } catch (parseError) {
      console.error('❌ Error parsing removeImages:', parseError);
      imagesToRemove = [];
    }
  }

  if (imagesToRemove.length > 0) {
    // Eliminar de Cloudinary
    for (const imageUrl of imagesToRemove) {
      if (imageUrl.includes('cloudinary')) {
        try {
          const publicId = extractPublicIdFromUrl(imageUrl);
          if (publicId) {
            await deleteFromCloudinary(publicId);
            logger.info('Image deleted from Cloudinary during update', { publicId, postId });
          }
        } catch (error) {
          logger.warn('Could not delete image from Cloudinary during update', {
            imageUrl,
            error: error.message
          });
        }
      }
    }
    
    // Remover de la lista actual
    currentImages = currentImages.filter(img => !imagesToRemove.includes(img));
  }

  // ✅ AGREGAR NUEVAS IMÁGENES
  if (req.uploadedFiles && req.uploadedFiles.length > 0) {
    const totalImages = currentImages.length + req.uploadedFiles.length;
    if (totalImages > 5) {
      throw new AppError('Máximo 5 imágenes permitidas en total', 400, 'TOO_MANY_IMAGES');
    }

    const newImageUrls = req.uploadedFiles.map(result => result.secure_url);
    currentImages = [...currentImages, ...newImageUrls];
    
    if (process.env.NODE_ENV === 'development') {
      console.log('✅ New images added:', newImageUrls.length);
    }
  }

  // Actualizar array de imágenes
  updateData.images = currentImages;

  // ✅ ACTUALIZAR POST EN BASE DE DATOS
  const updatedPost = await prisma.post.update({
    where: { id: postId },
    data: updateData,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true
        }
      },
      location: true,
      _count: {
        select: {
          likes: true,
          favorites: true
        }
      }
    }
  });

  // ✅ ACTUALIZAR TAGS SI SE PROPORCIONARON
  if (tags) {
    let parsedTags = [];
    try {
      parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    } catch (parseError) {
      console.error('❌ Error parsing tags:', parseError);
    }

    if (Array.isArray(parsedTags)) {
      // Eliminar tags existentes
      await prisma.postTag.deleteMany({
        where: { postId }
      });

      // Agregar nuevos tags
      if (parsedTags.length > 0) {
        await Promise.all(
          parsedTags.map(async (tagName) => {
            const tag = await prisma.tag.upsert({
              where: { name: tagName.toLowerCase() },
              update: { usageCount: { increment: 1 } },
              create: {
                name: tagName.toLowerCase(),
                slug: tagName.toLowerCase().replace(/\s+/g, '-'),
                usageCount: 1
              }
            });

            return prisma.postTag.create({
              data: {
                postId,
                tagId: tag.id
              }
            });
          })
        );
      }
    }
  }

  logger.info('Post updated successfully', {
    postId,
    userId,
    updatedFields: Object.keys(updateData),
    imagesRemoved: imagesToRemove?.length || 0,
    imagesAdded: req.uploadedFiles?.length || 0,
    totalImages: currentImages.length
  });

  res.status(200).json({
    success: true,
    message: 'Anuncio actualizado exitosamente',
    data: {
      ...updatedPost,
      likesCount: updatedPost._count.likes,
      favoritesCount: updatedPost._count.favorites
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener posts para el feed principal
const getFeed = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const {
    page = 1,
    limit = 20,
    location,
    userType,
    services,
    minAge,
    maxAge,
    verified,
    sortBy = 'recent'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Construir filtros
  const whereClause = {
    isActive: true,
    deletedAt: null,
    // Filtrar contenido premium si el usuario no puede accederlo
    ...(req.user?.userType === 'CLIENT' && !req.user?.client?.canAccessPremiumProfiles && {
      premiumOnly: false
    }),
    // Filtros de búsqueda
    ...(location && {
      location: {
        OR: [
          { country: { contains: location, mode: 'insensitive' } },
          { city: { contains: location, mode: 'insensitive' } }
        ]
      }
    }),
    ...(userType && {
      author: {
        userType: userType.toUpperCase()
      }
    }),
    ...(services && services.length > 0 && {
      services: {
        contains: Array.isArray(services) ? services.join(' ') : services,
        mode: 'insensitive'
      }
    }),
    ...(verified === 'true' && {
      author: {
        OR: [
          { escort: { isVerified: true } },
          { agency: { isVerified: true } }
        ]
      }
    }),
    // Filtros de edad para escorts
    ...(minAge && {
      author: {
        escort: {
          age: { gte: parseInt(minAge) }
        }
      }
    }),
    ...(maxAge && {
      author: {
        escort: {
          age: { lte: parseInt(maxAge) }
        }
      }
    }),
    // Excluir posts de usuarios bloqueados
    ...(userId && {
      author: {
        blockedBy: {
          none: {
            blockerId: userId
          }
        }
      }
    })
  };

  // Configurar ordenamiento
  let orderBy = {};
  switch (sortBy) {
    case 'trending':
      orderBy = [
        { trendingScore: 'desc' },
        { lastBoosted: 'desc' },
        { createdAt: 'desc' }
      ];
      break;
    case 'popular':
      orderBy = [
        { score: 'desc' },
        { views: 'desc' },
        { createdAt: 'desc' }
      ];
      break;
    case 'boosted':
      orderBy = [
        { lastBoosted: 'desc' },
        { score: 'desc' },
        { createdAt: 'desc' }
      ];
      break;
    default: // recent
      orderBy = { createdAt: 'desc' };
  }

  // Obtener posts
  const [posts, totalCount] = await Promise.all([
    prisma.post.findMany({
      where: whereClause,
      include: {
        author: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            avatar: true,
            userType: true,
            profileViews: true,
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
            }
          }
        },
        location: true,
        likes: userId ? {
          where: { userId },
          select: { id: true }
        } : false,
        favorites: userId ? {
          where: { userId },
          select: { id: true }
        } : false,
        boosts: {
          where: {
            isActive: true,
            expiresAt: { gt: new Date() }
          },
          select: {
            id: true,
            expiresAt: true,
            pricing: {
              select: {
                type: true,
                multiplier: true
              }
            }
          }
        },
        tags: {
          include: {
            tag: {
              select: {
                name: true,
                color: true
              }
            }
          }
        },
        _count: {
          select: {
            likes: true,
            favorites: true,
            interactions: {
              where: { type: 'VIEW' }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: parseInt(limit)
    }),
    prisma.post.count({ where: whereClause })
  ]);

  // Registrar interacciones para algoritmos (solo usuarios autenticados)
  if (userId && posts.length > 0) {
    const viewInteractions = posts.map(post => ({
      userId,
      postId: post.id,
      type: 'VIEW',
      weight: 1.0,
      deviceType: req.get('User-Agent')?.includes('Mobile') ? 'mobile' : 'desktop',
      source: 'feed'
    }));

    await prisma.userInteraction.createMany({
      data: viewInteractions,
      skipDuplicates: true
    });
  }

  // Formatear respuesta
  const formattedPosts = posts.map(post => ({
    id: post.id,
    title: post.title,
    description: post.description,
    images: post.images,
    phone: post.phone,
    services: post.services,
    rates: post.rates,
    availability: post.availability,
    views: post.views,
    score: post.score,
    isTrending: post.isTrending,
    isFeatured: post.isFeatured,
    premiumOnly: post.premiumOnly,
    createdAt: post.createdAt,
    lastBoosted: post.lastBoosted,
    author: post.author,
    location: post.location,
    tags: post.tags.map(pt => pt.tag),
    likesCount: post._count.likes,
    favoritesCount: post._count.favorites,
    viewsCount: post._count.interactions,
    isLiked: post.likes?.length > 0,
    isFavorited: post.favorites?.length > 0,
    isActive: !!post.boosts?.length,
    boost: post.boosts?.[0] || null
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
      posts: formattedPosts,
      pagination,
      filters: {
        location,
        userType,
        services,
        minAge,
        maxAge,
        verified,
        sortBy
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener posts trending
const getTrendingPosts = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { limit = 20, timeframe = '24h' } = req.query;

  // Calcular fecha límite según timeframe
  let timeLimit;
  switch (timeframe) {
    case '1h':
      timeLimit = new Date(Date.now() - 60 * 60 * 1000);
      break;
    case '6h':
      timeLimit = new Date(Date.now() - 6 * 60 * 60 * 1000);
      break;
    case '24h':
      timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      timeLimit = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      timeLimit = new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  const posts = await prisma.post.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      createdAt: { gte: timeLimit },
      trendingScore: { gt: 0 },
      ...(req.user?.userType === 'CLIENT' && !req.user?.client?.canAccessPremiumProfiles && {
        premiumOnly: false
      }),
      // Excluir posts de usuarios bloqueados
      ...(userId && {
        author: {
          blockedBy: {
            none: {
              blockerId: userId
            }
          }
        }
      })
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true,
          escort: {
            select: {
              isVerified: true,
              rating: true
            }
          },
          agency: {
            select: {
              isVerified: true
            }
          }
        }
      },
      location: true,
      likes: userId ? {
        where: { userId },
        select: { id: true }
      } : false,
      favorites: userId ? {
        where: { userId },
        select: { id: true }
      } : false,
      _count: {
        select: {
          likes: true,
          favorites: true
        }
      }
    },
    orderBy: [
      { trendingScore: 'desc' },
      { engagementRate: 'desc' },
      { views: 'desc' }
    ],
    take: parseInt(limit)
  });

  // Marcar como trending si aún no lo están
  const trendingPostIds = posts.map(post => post.id);
  await prisma.post.updateMany({
    where: {
      id: { in: trendingPostIds },
      isTrending: false
    },
    data: { isTrending: true }
  });

  // Registrar en historial de trending
  const trendingHistory = posts.map((post, index) => ({
    postId: post.id,
    position: index + 1,
    score: post.trendingScore,
    category: timeframe
  }));

  await prisma.trendingHistory.createMany({
    data: trendingHistory,
    skipDuplicates: true
  });

  const formattedPosts = posts.map(post => ({
    id: post.id,
    title: post.title,
    description: post.description,
    images: post.images,
    services: post.services,
    views: post.views,
    trendingScore: post.trendingScore,
    engagementRate: post.engagementRate,
    createdAt: post.createdAt,
    author: post.author,
    location: post.location,
    likesCount: post._count.likes,
    favoritesCount: post._count.favorites,
    isLiked: post.likes?.length > 0,
    isFavorited: post.favorites?.length > 0
  }));

  res.status(200).json({
    success: true,
    data: {
      posts: formattedPosts,
      timeframe,
      generatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener posts para descubrir
const getDiscoveryPosts = catchAsync(async (req, res) => {
  const userId = req.user?.id;
  const { limit = 20, algorithm = 'mixed' } = req.query;

  let orderBy = {};
  let whereClause = {
    isActive: true,
    deletedAt: null,
    ...(req.user?.userType === 'CLIENT' && !req.user?.client?.canAccessPremiumProfiles && {
      premiumOnly: false
    }),
    author: {
      settings: {
        showInDiscovery: true
      },
      ...(userId && {
        blockedBy: {
          none: {
            blockerId: userId
          }
        }
      })
    }
  };

  switch (algorithm) {
    case 'quality':
      orderBy = { qualityScore: 'desc' };
      break;
    case 'new':
      orderBy = { createdAt: 'desc' };
      whereClause.createdAt = { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) };
      break;
    case 'popular':
      orderBy = { views: 'desc' };
      break;
    case 'personalized':
      // Algoritmo personalizado basado en interacciones pasadas
      if (userId) {
        orderBy = [
          { discoveryScore: 'desc' },
          { qualityScore: 'desc' },
          { engagementRate: 'desc' }
        ];
      } else {
        orderBy = { discoveryScore: 'desc' };
      }
      break;
    default: // mixed
      orderBy = [
        { discoveryScore: 'desc' },
        { trendingScore: 'desc' },
        { qualityScore: 'desc' }
      ];
  }

  const posts = await prisma.post.findMany({
    where: whereClause,
    include: {
      author: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true,
          escort: {
            select: {
              isVerified: true,
              rating: true,
              age: true
            }
          },
          agency: {
            select: {
              isVerified: true
            }
          }
        }
      },
      location: true,
      likes: userId ? {
        where: { userId },
        select: { id: true }
      } : false,
      favorites: userId ? {
        where: { userId },
        select: { id: true }
      } : false,
      _count: {
        select: {
          likes: true,
          favorites: true
        }
      }
    },
    orderBy,
    take: parseInt(limit)
  });

  // Registrar interacciones de descubrimiento
  if (userId && posts.length > 0) {
    const discoveryInteractions = posts.map(post => ({
      userId,
      postId: post.id,
      type: 'VIEW',
      weight: 1.5,
      source: 'discover'
    }));

    await prisma.userInteraction.createMany({
      data: discoveryInteractions,
      skipDuplicates: true
    });
  }

  const formattedPosts = posts.map(post => ({
    id: post.id,
    title: post.title,
    description: post.description,
    images: post.images,
    services: post.services,
    discoveryScore: post.discoveryScore,
    qualityScore: post.qualityScore,
    createdAt: post.createdAt,
    author: post.author,
    location: post.location,
    likesCount: post._count.likes,
    favoritesCount: post._count.favorites,
    isLiked: post.likes?.length > 0,
    isFavorited: post.favorites?.length > 0
  }));

  res.status(200).json({
    success: true,
    data: {
      posts: formattedPosts,
      algorithm,
      generatedAt: new Date().toISOString()
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener post por ID
const getPostById = catchAsync(async (req, res) => {
  const { postId } = req.params;
  const userId = req.user?.id;

  const post = await prisma.post.findUnique({
    where: { 
      id: postId,
      isActive: true,
      deletedAt: null
    },
    include: {
      author: {
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          userType: true,
          phone: true,
          bio: true,
          profileViews: true,
          createdAt: true,
          escort: {
            select: {
              isVerified: true,
              rating: true,
              totalRatings: true,
              age: true,
              height: true,
              services: true,
              languages: true
            }
          },
          agency: {
            select: {
              isVerified: true,
              totalEscorts: true
            }
          },
          settings: {
            select: {
              showPhoneNumber: true
            }
          }
        }
      },
      location: true,
      likes: userId ? {
        where: { userId },
        select: { id: true }
      } : false,
      favorites: userId ? {
        where: { userId },
        select: { id: true }
      } : false,
      tags: {
        include: {
          tag: {
            select: {
              name: true,
              color: true
            }
          }
        }
      },
      _count: {
        select: {
          likes: true,
          favorites: true
        }
      }
    }
  });

  if (!post) {
    throw new AppError('Anuncio no encontrado', 404, 'POST_NOT_FOUND');
  }

  // Verificar acceso a contenido premium
  if (post.premiumOnly && req.user?.userType === 'CLIENT' && !req.user?.client?.canAccessPremiumProfiles) {
    throw new AppError('Contenido premium - actualiza tu cuenta', 403, 'PREMIUM_REQUIRED');
  }

  // Incrementar views y registrar interacción
  if (userId && userId !== post.authorId) {
    // Incrementar views
    await prisma.post.update({
      where: { id: postId },
      data: { 
        views: { increment: 1 },
        uniqueViews: { increment: 1 }
      }
    });

    // Registrar interacción detallada
    await prisma.userInteraction.create({
      data: {
        userId,
        postId,
        targetUserId: post.authorId,
        type: 'POST_CLICK',
        weight: 3.0,
        source: 'direct'
      }
    });
  }

  // Formatear respuesta
  const postResponse = {
    ...post,
    tags: post.tags.map(pt => pt.tag),
    likesCount: post._count.likes,
    favoritesCount: post._count.favorites,
    isLiked: post.likes?.length > 0,
    isFavorited: post.favorites?.length > 0,
    // Solo mostrar teléfono si está configurado para mostrarse o es contenido del mismo usuario
    phone: (post.author.settings?.showPhoneNumber || userId === post.authorId) ? post.phone : null
  };

  res.status(200).json({
    success: true,
    data: postResponse,
    timestamp: new Date().toISOString()
  });
});

// Eliminar post - OPTIMIZADO
const deletePost = catchAsync(async (req, res) => {
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const { postId } = req.params;
  const userId = req.user.id;

  // Verificar que el post existe y pertenece al usuario
  const post = await prisma.post.findFirst({
    where: {
      id: postId,
      authorId: userId,
      isActive: true
    }
  });

  if (!post) {
    throw new AppError('Anuncio no encontrado o no tienes permisos', 404, 'POST_NOT_FOUND');
  }

  // Eliminar imágenes de Cloudinary
  if (post.images && post.images.length > 0) {
    for (const imageUrl of post.images) {
      if (imageUrl.includes('cloudinary')) {
        try {
          const publicId = extractPublicIdFromUrl(imageUrl);
          if (publicId) {
            await deleteFromCloudinary(publicId);
            logger.info('Post image deleted from Cloudinary', { publicId, postId });
          }
        } catch (error) {
          logger.warn('Could not delete post image from Cloudinary', {
            imageUrl,
            error: error.message
          });
        }
      }
    }
  }

  // Soft delete
  await prisma.post.update({
    where: { id: postId },
    data: {
      isActive: false,
      deletedAt: new Date()
    }
  });

  // Actualizar contador de posts del escort
  if (req.user.userType === 'ESCORT') {
    await prisma.escort.update({
      where: { userId },
      data: { currentPosts: { decrement: 1 } }
    });
  }

  logger.info('Post deleted', {
    postId,
    userId,
    imagesDeleted: post.images?.length || 0
  });

  res.status(200).json({
    success: true,
    message: 'Anuncio eliminado exitosamente',
    timestamp: new Date().toISOString()
  });
});

// Dar like a un post
const likePost = catchAsync(async (req, res) => {
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const { postId } = req.params;
  const userId = req.user.id;

  // Verificar que el post existe
  const post = await prisma.post.findUnique({
    where: { 
      id: postId,
      isActive: true
    },
    select: {
      id: true,
      authorId: true,
      title: true
    }
  });

  if (!post) {
    throw new AppError('Anuncio no encontrado', 404, 'POST_NOT_FOUND');
  }

  // No permitir like a propio post
  if (post.authorId === userId) {
    throw new AppError('No puedes dar like a tu propio anuncio', 400, 'CANNOT_LIKE_OWN_POST');
  }

  // Verificar si ya dio like
  const existingLike = await prisma.like.findUnique({
    where: {
      userId_postId: {
        userId,
        postId
      }
    }
  });

  if (existingLike) {
    // Quitar like
    await prisma.like.delete({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    // Registrar interacción
    await prisma.userInteraction.create({
      data: {
        userId,
        postId,
        targetUserId: post.authorId,
        type: 'LIKE',
        weight: -1.0 // Peso negativo para unlike
      }
    });

    logger.info('Post unliked', { userId, postId });

    res.status(200).json({
      success: true,
      message: 'Like removido',
      data: { isLiked: false },
      timestamp: new Date().toISOString()
    });
  } else {
    // Dar like
    await prisma.like.create({
      data: {
        userId,
        postId
      }
    });

    // Registrar interacción
    await prisma.userInteraction.create({
      data: {
        userId,
        postId,
        targetUserId: post.authorId,
        type: 'LIKE',
        weight: 2.0
      }
    });

    // Actualizar scores
    await Promise.all([
      prisma.post.update({
        where: { id: postId },
        data: {
          score: { increment: 1 },
          engagementRate: { increment: 0.5 }
        }
      }),
      prisma.userReputation.update({
        where: { userId: post.authorId },
        data: {
          totalLikes: { increment: 1 },
          overallScore: { increment: 0.5 }
        }
      })
    ]);

    logger.info('Post liked', { userId, postId });

    res.status(200).json({
      success: true,
      message: 'Like agregado',
      data: { isLiked: true },
      timestamp: new Date().toISOString()
    });
  }
});

// Agregar/quitar favorito
const toggleFavorite = catchAsync(async (req, res) => {
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const { postId } = req.params;
  const userId = req.user.id;

  // Verificar que el post existe
  const post = await prisma.post.findUnique({
    where: { 
      id: postId,
      isActive: true
    },
    select: {
      id: true,
      authorId: true,
      title: true
    }
  });

  if (!post) {
    throw new AppError('Anuncio no encontrado', 404, 'POST_NOT_FOUND');
  }

  // Verificar si ya está en favoritos
  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_postId: {
        userId,
        postId
      }
    }
  });

  if (existingFavorite) {
    // Quitar de favoritos
    await prisma.favorite.delete({
      where: {
        userId_postId: {
          userId,
          postId
        }
      }
    });

    logger.info('Post removed from favorites', { userId, postId });

    res.status(200).json({
      success: true,
      message: 'Removido de favoritos',
      data: { isFavorited: false },
      timestamp: new Date().toISOString()
    });
  } else {
    // Agregar a favoritos
    await prisma.favorite.create({
      data: {
        userId,
        postId
      }
    });

    // Registrar interacción
    await prisma.userInteraction.create({
      data: {
        userId,
        postId,
        targetUserId: post.authorId,
        type: 'FAVORITE',
        weight: 3.0
      }
    });

    // Actualizar métricas
    await Promise.all([
      prisma.post.update({
        where: { id: postId },
        data: {
          score: { increment: 2 },
          engagementRate: { increment: 1.0 }
        }
      }),
      prisma.userReputation.update({
        where: { userId: post.authorId },
        data: {
          totalFavorites: { increment: 1 },
          overallScore: { increment: 1.0 }
        }
      })
    ]);

    logger.info('Post added to favorites', { userId, postId });

    res.status(200).json({
      success: true,
      message: 'Agregado a favoritos',
      data: { isFavorited: true },
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ FUNCIÓN OPTIMIZADA: getMyPosts - SIN THROW ERROR INNECESARIO
const getMyPosts = catchAsync(async (req, res) => {
  console.assert(req.user?.id, 'User should be authenticated by middleware');
  const userId = req.user.id;
  const { page = 1, limit = 20, status = 'active', sortBy = 'recent' } = req.query;

  if (process.env.NODE_ENV === 'development') {
    console.log('📋 === GET MY POSTS DEBUG ===');
    console.log('📋 User ID:', userId);
    console.log('📋 Query params:', { page, limit, status, sortBy });
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // ✅ FILTROS SEGÚN STATUS
  const whereClause = {
    authorId: userId,
    ...(status === 'active' && { isActive: true, deletedAt: null }),
    ...(status === 'deleted' && { isActive: false }),
    ...(status === 'all' && {})
  };

  // ✅ CONFIGURAR ORDENAMIENTO
  let orderBy = {};
  switch (sortBy) {
    case 'recent':
      orderBy = { createdAt: 'desc' };
      break;
    case 'oldest':
      orderBy = { createdAt: 'asc' };
      break;
    case 'popular':
      orderBy = { views: 'desc' };
      break;
    case 'likes':
      orderBy = { score: 'desc' };
      break;
    default:
      orderBy = { createdAt: 'desc' };
  }

  try {
    const [posts, totalCount] = await Promise.all([
      prisma.post.findMany({
        where: whereClause,
        include: {
          location: true,
          boosts: {
            where: {
              isActive: true,
              expiresAt: { gt: new Date() }
            },
            select: {
              id: true,
              expiresAt: true,
              pricing: {
                select: {
                  type: true
                }
              }
            }
          },
          _count: {
            select: {
              likes: true,
              favorites: true,
              interactions: {
                where: { type: 'VIEW' }
              }
            }
          }
        },
        orderBy,
        skip: offset,
        take: parseInt(limit)
      }),
      prisma.post.count({ where: whereClause })
    ]);

    if (process.env.NODE_ENV === 'development') {
      console.log('📋 Posts encontrados:', posts.length);
      console.log('📋 Total count:', totalCount);
    }

    const pagination = {
      page: parseInt(page),
      limit: parseInt(limit),
      total: totalCount,
      pages: Math.ceil(totalCount / parseInt(limit)),
      hasNext: parseInt(page) * parseInt(limit) < totalCount,
      hasPrev: parseInt(page) > 1
    };

    const formattedPosts = posts.map(post => ({
      ...post,
      likesCount: post._count.likes,
      favoritesCount: post._count.favorites,
      viewsCount: post._count.interactions,
      isBoosted: post.boosts.length > 0,
      activeBoost: post.boosts[0] || null
    }));

    // ✅ GENERAR ESTADÍSTICAS SIMPLES DEL USUARIO
    const stats = {
      totalPosts: totalCount,
      activePosts: status === 'active' ? totalCount : posts.filter(p => p.isActive).length,
      totalViews: posts.reduce((sum, post) => sum + (post.views || 0), 0),
      totalLikes: posts.reduce((sum, post) => sum + (post._count?.likes || 0), 0)
    };

    res.status(200).json({
      success: true,
      data: {
        posts: formattedPosts,
        pagination,
        stats,
        status
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error en getMyPosts:', error);
    
    // ✅ DEVOLVER ARRAY VACÍO EN LUGAR DE ERROR
    res.status(200).json({
      success: true,
      data: {
        posts: [],
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: 0,
          pages: 0,
          hasNext: false,
          hasPrev: false
        },
        stats: {
          totalPosts: 0,
          activePosts: 0,
          totalViews: 0,
          totalLikes: 0
        },
        status
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Función helper para calcular score inicial de calidad
const calculateInitialQualityScore = (title, description, imageCount) => {
  let score = 0;
  
  // Título (20 puntos máximo)
  if (title) {
    score += Math.min(20, title.length / 5);
  }
  
  // Descripción (30 puntos máximo)
  if (description) {
    score += Math.min(30, description.length / 10);
  }
  
  // Imágenes (50 puntos máximo)
  score += Math.min(50, imageCount * 10);
  
  return Math.round(score);
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
  createPost,
  checkPostLimits,
  updatePost,
  getFeed,
  getTrendingPosts,
  getDiscoveryPosts,
  getPostById,
  deletePost,
  likePost,
  toggleFavorite,
  getMyPosts
};