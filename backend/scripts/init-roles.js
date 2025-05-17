// scripts/init-roles.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createRolesAndPermissions() {
  console.log('Iniciando creación de roles y permisos...');

  try {
    // Crear roles base si no existen
    const roles = [
      { name: 'admin', description: 'Administrador del sistema', isSystem: true },
      { name: 'cliente', description: 'Cliente registrado', isSystem: true },
      { name: 'perfil', description: 'Perfil de acompañante', isSystem: true },
      { name: 'agencia', description: 'Agencia de acompañantes', isSystem: true }
    ];

    for (const role of roles) {
      await prisma.role.upsert({
        where: { name: role.name },
        update: {},
        create: role
      });
      console.log(`Rol '${role.name}' creado o verificado`);
    }

    console.log('Roles base creados correctamente');

    // Asignar rol admin al usuario admin
    const adminUser = await prisma.user.findUnique({
      where: { email: 'admin@telofundi.com' }
    });

    if (adminUser) {
      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' }
      });

      if (adminRole) {
        // Verificar si ya tiene el rol asignado
        const existingMapping = await prisma.userRoleMapping.findFirst({
          where: {
            userId: adminUser.id,
            roleId: adminRole.id
          }
        });

        if (!existingMapping) {
          await prisma.userRoleMapping.create({
            data: {
              userId: adminUser.id,
              roleId: adminRole.id,
              createdBy: adminUser.id
            }
          });
          console.log('Rol de administrador asignado al usuario admin');
        } else {
          console.log('El usuario admin ya tiene asignado el rol de administrador');
        }
      } else {
        console.log('ADVERTENCIA: No se encontró el rol de administrador');
      }
    } else {
      console.log('ADVERTENCIA: No se encontró el usuario admin - Ejecuta primero create-admin.js');
    }

    console.log('Inicialización de roles y permisos completada');
  } catch (error) {
    console.error('Error al crear roles y permisos:', error);
    throw error;
  }
}

async function main() {
  try {
    await createRolesAndPermissions();
  } catch (error) {
    console.error('Error en el script:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
main();