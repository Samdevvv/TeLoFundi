// scripts/create-admin.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();

// Configuración
const adminEmail = 'admin@telofundi.com';
const adminPassword = 'admin123'; // Cambia esto por una contraseña más segura
const jwtSecret = process.env.JWT_SECRET || 'tu_clave_secreta_muy_segura';

async function createAdminUser() {
  console.log('Iniciando creación de usuario administrador...');

  try {
    // Verificar si el usuario admin ya existe
    const existingUser = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    let adminUser;

    if (existingUser) {
      console.log('Usuario administrador ya existe. ID:', existingUser.id);
      adminUser = existingUser;
    } else {
      // Generar hash de la contraseña
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

      // Crear usuario administrador
      adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          role: 'admin',
          emailVerified: true,
          isActive: true,
          profileImageUrl: 'https://via.placeholder.com/150',
        }
      });

      console.log(`Usuario administrador creado con ID: ${adminUser.id}`);
    }

    // Crear sesión de usuario para el admin - esta parte es importante para la autenticación
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // Sesión válida por 30 días

    try {
      // Intentar encontrar una sesión existente
      const existingSession = await prisma.userSession.findFirst({
        where: {
          userId: adminUser.id,
          isActive: true,
        }
      });

      if (!existingSession) {
        // Crear una nueva sesión si no existe
        await prisma.userSession.create({
          data: {
            userId: adminUser.id,
            token: `admin_session_${Date.now()}`,
            expiresAt,
            isActive: true,
            ipAddress: '127.0.0.1',
            userAgent: 'Admin Script',
          }
        });
        console.log('Sesión de administrador creada');
      } else {
        console.log('Sesión de administrador ya existe');
      }
    } catch (sessionError) {
      console.warn('Advertencia: No se pudo crear sesión del admin:', sessionError.message);
      console.log('Esto no impide la generación del token JWT');
    }

    return adminUser;
  } catch (error) {
    console.error('Error al crear usuario administrador:', error);
    throw error;
  }
}

function generateToken(user) {
  // Generar token JWT con una estructura simplificada
  // Usamos un formato estándar para mayor compatibilidad
  const payload = {
    sub: user.id,          // Estándar JWT para el ID del sujeto
    email: user.email,
    role: user.role,
    iat: Math.floor(Date.now() / 1000)  // Issued at time
  };

  const options = {
    expiresIn: '30d' // Token válido por 30 días
  };

  return jwt.sign(payload, jwtSecret, options);
}

async function main() {
  try {
    // Crear usuario admin si no existe
    const adminUser = await createAdminUser();
    
    // Generar un token JWT
    const token = generateToken(adminUser);
    
    console.log('\n===== INFORMACIÓN DE ACCESO ADMIN =====');
    console.log(`Email: ${adminEmail}`);
    console.log(`Contraseña: ${adminPassword}`);
    console.log('\n===== TOKEN JWT PARA SWAGGER =====');
    console.log(`Bearer ${token}`);
    console.log('\n===== INSTRUCCIONES MEJORADAS PARA SWAGGER =====');
    console.log('1. Abre Swagger UI en: http://localhost:5000/api-docs');
    console.log('2. Haz clic en el botón "Authorize" en la parte superior derecha');
    console.log('3. COPIA EXACTAMENTE el siguiente texto (incluyendo "Bearer " y el espacio después):');
    console.log(`Bearer ${token}`);
    console.log('4. PEGA el texto anterior en el campo "Value"');
    console.log('5. Haz clic en "Authorize" y luego en "Close"');
    console.log('6. Ahora intenta ejecutar un endpoint protegido como /api/users/me');
    console.log('\nEste token es válido por 30 días.\n');
    
    // Imprimir la clave secreta para verificar
    console.log('\n===== INFORMACIÓN DE DEPURACIÓN =====');
    console.log(`JWT_SECRET utilizada: ${jwtSecret.substring(0, 5)}... (primeros 5 caracteres)`);
    console.log(`ID del usuario (sub): ${adminUser.id}`);
    console.log(`Role del usuario: ${adminUser.role}`);
    
  } catch (error) {
    console.error('Error en el script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
main();