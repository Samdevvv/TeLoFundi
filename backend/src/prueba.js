// prueba.js
console.log('Directorio de trabajo actual:', process.cwd());

// Intenta cargar dotenv correctamente
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env');
console.log('Ruta al archivo .env:', envPath);

// Verifica si el archivo .env existe
const fs = require('fs');
if (fs.existsSync(envPath)) {
    console.log('El archivo .env existe');
    
    // Muestra el contenido del archivo (omitiendo datos sensibles)
    let envContent = fs.readFileSync(envPath, 'utf8');
    const passwordPattern = /(PASSWORD|SECRET|PASS|KEY)=.+/gi;
    const maskedContent = envContent.replace(passwordPattern, '$1=*****');
    console.log('Contenido del archivo .env (valores sensibles ocultados):\n', maskedContent);
} else {
    console.log('El archivo .env NO existe en la ruta especificada');
}

// Intenta cargar el archivo .env de múltiples formas
try {
    require('dotenv').config(); // Carga estándar
    console.log('dotenv.config() ejecutado');
} catch (error) {
    console.error('Error al cargar dotenv.config():', error);
}

try {
    require('dotenv').config({ path: envPath }); // Carga con ruta específica
    console.log('dotenv.config() con ruta específica ejecutado');
} catch (error) {
    console.error('Error al cargar dotenv.config() con ruta específica:', error);
}

console.log('Iniciando prueba de conexión a base de datos...');

// Imprime las variables de entorno relacionadas con la base de datos
console.log('Variables de entorno de BD:');
console.log({
  DB_HOST: process.env.DB_HOST || 'no definido',
  DB_PORT: process.env.DB_PORT || 'no definido',
  DB_USER: process.env.DB_USER || 'no definido',
  DB_NAME: process.env.DB_NAME || 'no definido',
  DATABASE_URL: process.env.DATABASE_URL ? 'definido (valor no mostrado por seguridad)' : 'no definido'
});

async function testDatabaseConnections() {
  try {
    // Probar conexión con pg directamente
    console.log('\nProbando conexión con pg...');
    const { Pool } = require('pg');
    
    // Definir valores directamente si las variables de entorno están vacías
    const pgConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'C123456', // Usa un valor de respaldo
      database: process.env.DB_NAME || 'TeLoFundiDev',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    };
    
    console.log('Configuración PG (sin contraseña):', {
      ...pgConfig, 
      password: pgConfig.password ? '******' : 'no definido'
    });
    
    const pool = new Pool(pgConfig);

    try {
      const client = await pool.connect();
      console.log('Conexión a PostgreSQL exitosa!');
      
      const res = await client.query('SELECT NOW() as now');
      console.log('Consulta exitosa, hora del servidor:', res.rows[0].now);
      
      client.release();
    } catch (pgError) {
      console.error('Error conectando a PostgreSQL:', pgError);
    }

    // Probar conexión con Prisma
    console.log('\nProbando conexión con Prisma...');
    const { PrismaClient } = require('@prisma/client');
    
    // Si DATABASE_URL no está definido en env, usar un valor por defecto
    if (!process.env.DATABASE_URL) {
      process.env.DATABASE_URL = "postgresql://postgres:C123456@localhost:5432/TeLoFundiDev?schema=public";
      console.log('DATABASE_URL no estaba definido, usando valor por defecto');
    }
    
    const prisma = new PrismaClient();

    try {
      await prisma.$connect();
      console.log('Conexión con Prisma exitosa!');
      
      await prisma.$disconnect();
      console.log('Desconexión de Prisma exitosa.');
    } catch (prismaError) {
      console.error('Error con Prisma:', prismaError);
    }

    console.log('\nPruebas de conexión completadas.');
  } catch (error) {
    console.error('Error general en las pruebas:', error);
  }
}

testDatabaseConnections();