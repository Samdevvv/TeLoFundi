const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'TeLoFundi API',
      version: '1.0.0',
      description: 'API para la plataforma TeLoFundi - Conexión entre escorts, agencias y clientes',
      contact: {
        name: 'TeLoFundi Team',
        email: 'support@telofundi.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://api.telofundi.com' 
          : `http://localhost:${process.env.PORT || 3000}`,
        description: process.env.NODE_ENV === 'production' ? 'Servidor de Producción' : 'Servidor de Desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Token JWT para autenticación'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-api-key',
          description: 'API Key para acceso de administrador'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm123abc456' },
            email: { type: 'string', format: 'email', example: 'usuario@ejemplo.com' },
            username: { type: 'string', example: 'usuario123' },
            firstName: { type: 'string', example: 'Juan' },
            lastName: { type: 'string', example: 'Pérez' },
            avatar: { type: 'string', nullable: true, example: 'https://res.cloudinary.com/avatar.jpg' },
            phone: { type: 'string', nullable: true, example: '+1234567890' },
            bio: { type: 'string', nullable: true, example: 'Descripción del usuario' },
            userType: { 
              type: 'string', 
              enum: ['ESCORT', 'AGENCY', 'CLIENT', 'ADMIN'],
              example: 'ESCORT'
            },
            isActive: { type: 'boolean', example: true },
            isBanned: { type: 'boolean', example: false },
            profileViews: { type: 'integer', example: 150 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Post: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm123post456' },
            title: { type: 'string', example: 'Anuncio de ejemplo' },
            description: { type: 'string', example: 'Descripción del anuncio' },
            images: { 
              type: 'array', 
              items: { type: 'string' },
              example: ['https://res.cloudinary.com/img1.jpg', 'https://res.cloudinary.com/img2.jpg']
            },
            phone: { type: 'string', example: '+1234567890' },
            views: { type: 'integer', example: 100 },
            likes: { type: 'integer', example: 25 },
            isActive: { type: 'boolean', example: true },
            isTrending: { type: 'boolean', example: false },
            score: { type: 'number', format: 'float', example: 85.5 },
            authorId: { type: 'string', example: 'cm123user456' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Mensaje de error' },
            error: { type: 'string', example: 'Código de error' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operación exitosa' },
            data: { type: 'object' },
            timestamp: { type: 'string', format: 'date-time' }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: { 
              type: 'array',
              items: { type: 'object' }
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'integer', example: 1 },
                limit: { type: 'integer', example: 20 },
                total: { type: 'integer', example: 100 },
                totalPages: { type: 'integer', example: 5 },
                hasNext: { type: 'boolean', example: true },
                hasPrev: { type: 'boolean', example: false }
              }
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Token de acceso no válido o faltante',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ForbiddenError: {
          description: 'Permisos insuficientes',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        NotFoundError: {
          description: 'Recurso no encontrado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ValidationError: {
          description: 'Error de validación',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        ServerError: {
          description: 'Error interno del servidor',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    tags: [
      {
        name: 'Auth',
        description: 'Autenticación y autorización'
      },
      {
        name: 'Users',
        description: 'Gestión de usuarios'
      },
      {
        name: 'Posts',
        description: 'Anuncios y publicaciones'
      },
      {
        name: 'Chat',
        description: 'Sistema de mensajería'
      },
      {
        name: 'Agency',
        description: 'Gestión de agencias'
      },
      {
        name: 'Admin',
        description: 'Panel de administración'
      },
      {
        name: 'Payments',
        description: 'Pagos y transacciones'
      },
      {
        name: 'Favorites',
        description: 'Favoritos y likes'
      }
    ]
  },
  apis: [
    './src/routes/*.js',
    './src/controllers/*.js'
  ]
};

const specs = swaggerJsdoc(options);

const setupSwagger = (app) => {
  // Configuración personalizada de Swagger UI
  const swaggerUiOptions = {
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
    customSiteTitle: 'TeLoFundi API Documentation',
    customfavIcon: '/favicon.ico',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tryItOutEnabled: true
    }
  };

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerUiOptions));
  
  // Endpoint para obtener el JSON de la documentación
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(specs);
  });
};

module.exports = { setupSwagger, specs };