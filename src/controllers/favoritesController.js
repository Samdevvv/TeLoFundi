const { prisma } = require('../config/database');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { sanitizeString } = require('../utils/validators');
const logger = require('../utils/logger');

// Obtener posts favoritos del usuario
const getUserFavorites = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { 
    page = 1, 
    limit = 20, 
    sortBy = 'createdAt', 
    sortOrder = 'desc',
    userType,
    location 
  } = req.query;
  
  // ✅ Validación de paginación consistente
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // Construir filtros
  const whereClause = {
    userId: userId
  };

  // Filtros de posts
  let postWhere = {};
  if (userType) {
    postWhere.author = {
      userType: userType.toUpperCase()
    };
  }
  if (location) {
    postWhere.location = {
      OR: [
        { country: { contains: sanitizeString(location), mode: 'insensitive' } },
        { city: { contains: sanitizeString(location), mode: 'insensitive' } }
      ]
    };
  }

  if (Object.keys(postWhere).length > 0) {
    whereClause.post = postWhere;
  }

  // ✅ Ordenamiento corregido
  let orderBy = {};
  if (sortBy === 'postCreatedAt') {
    orderBy = {
      post: {
        createdAt: sortOrder
      }
    };
  } else {
    orderBy = {
      createdAt: sortOrder
    };
  }

  const [favorites, totalCount] = await Promise.all([
    prisma.favorite.findMany({
      where: whereClause,
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                username: true,
                firstName: true,
                lastName: true, // ✅ Campos correctos
                avatar: true,
                userType: true,
                // ✅ Campos específicos por tipo
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
            _count: {
              select: {
                favorites: true,
                likes: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limitNum
    }),
    prisma.favorite.count({ where: whereClause })
  ]);

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total: totalCount,
    pages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum * limitNum < totalCount,
    hasPrev: pageNum > 1
  };

  res.status(200).json({
    success: true,
    data: {
      favorites,
      pagination,
      filters: {
        userType,
        location,
        sortBy,
        sortOrder
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Agregar post a favoritos
const addToFavorites = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;
  const { isNotified = true } = req.body;

  // ✅ Validación de input
  if (!postId) {
    throw new AppError('ID del post es requerido', 400, 'MISSING_POST_ID');
  }

  // Verificar que el post existe y está activo
  const post = await prisma.post.findUnique({
    where: { 
      id: postId,
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      authorId: true
    }
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404, 'POST_NOT_FOUND');
  }

  // Verificar que no esté ya en favoritos
  const existingFavorite = await prisma.favorite.findUnique({
    where: {
      userId_postId: {
        userId: userId,
        postId: postId
      }
    }
  });

  if (existingFavorite) {
    throw new AppError('Post ya está en favoritos', 409, 'POST_ALREADY_FAVORITED');
  }

  // Crear favorito
  const favorite = await prisma.favorite.create({
    data: {
      userId: userId,
      postId: postId,
      isNotified: isNotified
    },
    include: {
      post: {
        include: {
          author: {
            select: {
              id: true,
              username: true,
              firstName: true,
              lastName: true,
              avatar: true
            }
          }
        }
      }
    }
  });

  // ✅ Registrar interacción para algoritmos
  try {
    await prisma.userInteraction.create({
      data: {
        userId,
        postId,
        targetUserId: post.authorId,
        type: 'FAVORITE',
        weight: 3.0,
        source: 'favorites'
      }
    });
  } catch (error) {
    logger.warn('Failed to create user interaction:', error);
  }

  logger.info('Post added to favorites', {
    userId,
    postId,
    postTitle: post.title
  });

  res.status(201).json({
    success: true,
    message: 'Post agregado a favoritos',
    data: favorite,
    timestamp: new Date().toISOString()
  });
});

// Remover post de favoritos
const removeFromFavorites = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  // ✅ Validación de input
  if (!postId) {
    throw new AppError('ID del post es requerido', 400, 'MISSING_POST_ID');
  }

  // Verificar que el favorito existe
  const favorite = await prisma.favorite.findUnique({
    where: {
      userId_postId: {
        userId: userId,
        postId: postId
      }
    }
  });

  if (!favorite) {
    throw new AppError('Post no encontrado en favoritos', 404, 'FAVORITE_NOT_FOUND');
  }

  // Eliminar favorito
  await prisma.favorite.delete({
    where: {
      userId_postId: {
        userId: userId,
        postId: postId
      }
    }
  });

  logger.info('Post removed from favorites', {
    userId,
    postId
  });

  res.status(200).json({
    success: true,
    message: 'Post removido de favoritos',
    timestamp: new Date().toISOString()
  });
});

// Obtener posts con like del usuario
const getUserLikes = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { 
    page = 1, 
    limit = 20, 
    sortBy = 'createdAt', 
    sortOrder = 'desc'
  } = req.query;
  
  // ✅ Validación de paginación consistente
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
  const offset = (pageNum - 1) * limitNum;

  // ✅ Ordenamiento corregido
  let orderBy = {};
  if (sortBy === 'postCreatedAt') {
    orderBy = {
      post: {
        createdAt: sortOrder
      }
    };
  } else {
    orderBy = {
      createdAt: sortOrder
    };
  }

  const [likes, totalCount] = await Promise.all([
    prisma.like.findMany({
      where: {
        userId: userId
      },
      include: {
        post: {
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
            _count: {
              select: {
                favorites: true,
                likes: true
              }
            }
          }
        }
      },
      orderBy,
      skip: offset,
      take: limitNum
    }),
    prisma.like.count({
      where: {
        userId: userId
      }
    })
  ]);

  const pagination = {
    page: pageNum,
    limit: limitNum,
    total: totalCount,
    pages: Math.ceil(totalCount / limitNum),
    hasNext: pageNum * limitNum < totalCount,
    hasPrev: pageNum > 1
  };

  res.status(200).json({
    success: true,
    data: {
      likes,
      pagination,
      filters: {
        sortBy,
        sortOrder
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Dar like a un post
const addLike = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  // ✅ Validación de input
  if (!postId) {
    throw new AppError('ID del post es requerido', 400, 'MISSING_POST_ID');
  }

  // Verificar que el post existe y está activo
  const post = await prisma.post.findUnique({
    where: { 
      id: postId,
      isActive: true,
      deletedAt: null
    },
    select: {
      id: true,
      title: true,
      authorId: true
    }
  });

  if (!post) {
    throw new AppError('Post no encontrado', 404, 'POST_NOT_FOUND');
  }

  // No permitir like a propio post
  if (post.authorId === userId) {
    throw new AppError('No puedes dar like a tu propio post', 400, 'CANNOT_LIKE_OWN_POST');
  }

  // Verificar si ya dio like
  const existingLike = await prisma.like.findUnique({
    where: {
      userId_postId: {
        userId: userId,
        postId: postId
      }
    }
  });

  if (existingLike) {
    throw new AppError('Ya has dado like a este post', 409, 'POST_ALREADY_LIKED');
  }

  // ✅ Transacción para operaciones múltiples
  const result = await prisma.$transaction(async (tx) => {
    // Crear like
    const like = await tx.like.create({
      data: {
        userId: userId,
        postId: postId
      }
    });

    // Contar total de likes
    const totalLikes = await tx.like.count({
      where: {
        postId: postId
      }
    });

    // Actualizar score del post
    await tx.post.update({
      where: { id: postId },
      data: {
        score: { increment: 1 },
        engagementRate: { increment: 0.5 }
      }
    });

    return { like, totalLikes };
  });

  // ✅ Registrar interacción
  try {
    await prisma.userInteraction.create({
      data: {
        userId,
        postId,
        targetUserId: post.authorId,
        type: 'LIKE',
        weight: 2.0,
        source: 'likes'
      }
    });
  } catch (error) {
    logger.warn('Failed to create user interaction:', error);
  }

  logger.info('Like added to post', {
    userId,
    postId,
    totalLikes: result.totalLikes
  });

  res.status(201).json({
    success: true,
    message: 'Like agregado',
    data: {
      like: result.like,
      totalLikes: result.totalLikes
    },
    timestamp: new Date().toISOString()
  });
});

// Quitar like de un post
const removeLike = catchAsync(async (req, res) => {
  const userId = req.user.id;
  const { postId } = req.params;

  // ✅ Validación de input
  if (!postId) {
    throw new AppError('ID del post es requerido', 400, 'MISSING_POST_ID');
  }

  // Verificar que el like existe
  const like = await prisma.like.findUnique({
    where: {
      userId_postId: {
        userId: userId,
        postId: postId
      }
    }
  });

  if (!like) {
    throw new AppError('Like no encontrado', 404, 'LIKE_NOT_FOUND');
  }

  // ✅ Transacción para operaciones múltiples
  const result = await prisma.$transaction(async (tx) => {
    // Eliminar like
    await tx.like.delete({
      where: {
        userId_postId: {
          userId: userId,
          postId: postId
        }
      }
    });

    // Contar total de likes
    const totalLikes = await tx.like.count({
      where: {
        postId: postId
      }
    });

    // Actualizar score del post
    await tx.post.update({
      where: { id: postId },
      data: {
        score: { decrement: 1 },
        engagementRate: { decrement: 0.5 }
      }
    });

    return { totalLikes };
  });

  logger.info('Like removed from post', {
    userId,
    postId,
    totalLikes: result.totalLikes
  });

  res.status(200).json({
    success: true,
    message: 'Like removido',
    data: {
      totalLikes: result.totalLikes
    },
    timestamp: new Date().toISOString()
  });
});

// Obtener estadísticas de favoritos y likes del usuario
const getFavoritesStats = catchAsync(async (req, res) => {
  const userId = req.user.id;
  
  // Calcular fecha para "esta semana"
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // ✅ Obtener estadísticas usando Promise.all para mejor rendimiento
  const [
    totalFavorites, 
    totalLikes, 
    favoritesThisWeek, 
    likesThisWeek,
    favoritedPosts,
    recentFavorites,
    recentLikes
  ] = await Promise.all([
    prisma.favorite.count({ where: { userId } }),
    prisma.like.count({ where: { userId } }),
    prisma.favorite.count({ 
      where: { 
        userId,
        createdAt: { gte: oneWeekAgo }
      }
    }),
    prisma.like.count({ 
      where: { 
        userId,
        createdAt: { gte: oneWeekAgo }
      }
    }),
    // Obtener posts favoritos para estadísticas por tipo
    prisma.favorite.findMany({
      where: { userId },
      include: {
        post: {
          include: {
            author: {
              select: { userType: true }
            }
          }
        }
      }
    }),
    // Actividad reciente - favoritos
    prisma.favorite.findMany({
      where: { userId },
      include: {
        post: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    }),
    // Actividad reciente - likes
    prisma.like.findMany({
      where: { userId },
      include: {
        post: {
          select: {
            id: true,
            title: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    })
  ]);

  // ✅ Procesar estadísticas por tipo de usuario
  const userTypeStats = favoritedPosts.reduce((acc, fav) => {
    const userType = fav.post.author.userType;
    acc[userType] = (acc[userType] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(userTypeStats).map(([userType, count]) => ({
    userType,
    count
  }));

  // ✅ Combinar y ordenar actividad reciente
  const recentActivity = [
    ...recentFavorites.map(fav => ({
      type: 'favorite',
      postId: fav.postId,
      postTitle: fav.post.title,
      createdAt: fav.createdAt
    })),
    ...recentLikes.map(like => ({
      type: 'like',
      postId: like.postId,
      postTitle: like.post.title,
      createdAt: like.createdAt
    }))
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);

  res.status(200).json({
    success: true,
    data: {
      totalFavorites,
      totalLikes,
      favoritesThisWeek,
      likesThisWeek,
      topCategories,
      recentActivity
    },
    timestamp: new Date().toISOString()
  });
});

module.exports = {
  getUserFavorites,
  addToFavorites,
  removeFromFavorites,
  getUserLikes,
  addLike,
  removeLike,
  getFavoritesStats
};