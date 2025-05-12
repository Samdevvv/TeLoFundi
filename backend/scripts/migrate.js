// Script para ejecutar las migraciones de Prisma
require('dotenv').config();
const { execSync } = require('child_process');
const path = require('path');

console.log('Ejecutando configuración de Prisma...');
// Primero ejecutamos el setup para asegurarnos que el .env de Prisma tenga los valores correctos
execSync('node prisma/setup.js', { stdio: 'inherit' });

console.log('\nGenerando migración de Prisma...');
try {
  // Generamos la migración inicial
  execSync('npx prisma migrate dev --name init', { stdio: 'inherit' });
  
  console.log('\nGenerando cliente Prisma...');
  // Generamos el cliente Prisma
  execSync('npx prisma generate', { stdio: 'inherit' });
  
  console.log('\nMigración completada exitosamente');
} catch (error) {
  console.error('Error durante la migración:', error.message);
  process.exit(1);
}