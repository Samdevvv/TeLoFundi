const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Opciones de configuración de Swagger
const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'API de Plataforma de Agencias y Acompañantes',
      version: '1.0.0',
      description: 'Documentación de la API para la plataforma de agencias y acompañantes',
      contact: {
        name: 'TeLoFundi',
        url: 'https://tudominio.com',
        email: 'info@tudominio.com'
      },
      license: {
        name: 'Privado',
        url: 'https://tudominio.com/terminos'
      }
    },
    servers: [
      {
        url: process.env.API_URL || 'http://localhost:5000',
        description: 'Servidor de desarrollo'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string'
            },
            status: {
              type: 'integer'
            },
            error: {
              type: 'string'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid'
            },
            email: {
              type: 'string',
              format: 'email'
            },
            role: {
              type: 'string',
              enum: ['cliente', 'perfil', 'agencia', 'admin']
            },
            is_active: {
              type: 'boolean'
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
      { name: 'Auth', description: 'Operaciones de autenticación' },
      { name: 'Users', description: 'Operaciones de usuarios' },
      { name: 'Clients', description: 'Operaciones para clientes' },
      { name: 'Profiles', description: 'Operaciones para perfiles de acompañantes' },
      { name: 'Agencies', description: 'Operaciones para agencias' },
      { name: 'Admin', description: 'Operaciones administrativas' },
      { name: 'Chat', description: 'Sistema de mensajería' },
      { name: 'Payments', description: 'Procesamiento de pagos' },
      { name: 'Points', description: 'Sistema de puntos y cupones' },
      { name: 'Search', description: 'Búsqueda y filtros' }
    ]
  },
  // Rutas a los archivos que contienen anotaciones JSDoc
  apis: [
    'src/api/*/*.js',
    'src/models/*.js'
  ]
};

const specs = swaggerJsdoc(options);

module.exports = {
  serve: swaggerUi.serve,
  setup: swaggerUi.setup(specs, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API - Plataforma de Agencias y Acompañantes'
  }),
  specs
};