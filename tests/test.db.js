const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    // Test de conexión
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos exitosa');

    // Contar usuarios (debería ser 0 al inicio)
    const userCount = await prisma.user.count();
    console.log(`📊 Usuarios en la BD: ${userCount}`);

    // Crear un usuario de prueba
    const testUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        password: 'hashedpassword'
      }
    });
    
    console.log('✅ Usuario de prueba creado:', testUser.username);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();