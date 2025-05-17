// scripts/create-profiles.js
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const slugify = require('slugify');
const path = require('path');

const prisma = new PrismaClient();

// Configuración
const saltRounds = 10;

// Definir la URL base para las imágenes
// Usando path.resolve para obtener la ruta absoluta a la imagen
const BASE_IMAGE_URL = path.resolve(__dirname, '../images/publicacion.jpg');

// Función para generar un slug único a partir de un nombre
function generateSlug(name) {
  // Generar slug base
  let slug = slugify(name, {
    lower: true,
    strict: true,
    trim: true
  });

  // Añadir sufijo aleatorio para evitar duplicados
  const randomSuffix = crypto.randomBytes(3).toString('hex');
  slug = `${slug}-${randomSuffix}`;

  return slug;
}

// Función para obtener la URL de la imagen
function getImageUrl() {
  // Siempre devuelve la misma ruta de imagen para todos los perfiles
  return BASE_IMAGE_URL;
}

// Perfiles de ejemplo
const profiles = [
  {
    email: 'sofia@example.com',
    password: 'password123',
    displayName: 'Sofia Bella',
    gender: 'femenino',
    age: 24,
    location: { city: 'Santo Domingo', country: 'República Dominicana', address: 'Zona Colonial' },
    description: 'Hola, soy Sofia. Me encanta conocer gente nueva y disfrutar de buenas conversaciones. Soy una persona extrovertida, alegre y muy sociable. Ofrezco un servicio de compañía de calidad para eventos sociales, cenas o simplemente para pasar un buen rato juntos.',
    shortDescription: 'Modelo y bailarina profesional, amante de las artes y la buena compañía',
    services: ['compania', 'eventos', 'cenas', 'viajes'],
    priceHour: 120,
    priceAdditionalHour: 100,
    priceOvernight: 500,
    priceWeekend: 800,
    languages: ['español', 'inglés', 'francés'],
    nationality: 'Dominicana',
    height: 170,
    weight: 55,
    eyeColor: 'miel',
    hairColor: 'castaño',
    education: 'universitaria',
    availability: 'disponible',
    // Nombres de los archivos de imagen - solo por referencia, no se usan realmente
    imageFiles: [
      'female-profile-1.jpg',
      'female-profile-2.jpg',
      'female-profile-3.jpg',
      'female-profile-4.jpg',
      'female-profile-5.jpg'
    ]
  },
  {
    email: 'camila@example.com',
    password: 'password123',
    displayName: 'Camila Rodriguez',
    gender: 'femenino',
    age: 26,
    location: { city: 'Santiago', country: 'República Dominicana', address: 'Centro de la ciudad' },
    description: 'Soy Camila, una mujer divertida, inteligente y apasionada. Me gusta la música, el arte y las conversaciones interesantes. Ofrezco un servicio de acompañamiento personalizado para eventos, cenas románticas o viajes. Mi objetivo es que disfrutes de momentos únicos e inolvidables.',
    shortDescription: 'Modelo y comunicadora, experta en eventos y relaciones públicas',
    services: ['compania', 'eventos', 'cenas', 'viajes', 'masajes'],
    priceHour: 150,
    priceAdditionalHour: 120,
    priceOvernight: 600,
    priceWeekend: 900,
    languages: ['español', 'inglés', 'italiano'],
    nationality: 'Dominicana',
    height: 165,
    weight: 58,
    eyeColor: 'café',
    hairColor: 'negro',
    education: 'posgrado',
    availability: 'disponible',
    imageFiles: [
      'female-profile-6.jpg',
      'female-profile-7.jpg',
      'female-profile-8.jpg',
      'female-profile-9.jpg',
      'female-profile-10.jpg'
    ]
  },
  {
    email: 'alejandro@example.com',
    password: 'password123',
    displayName: 'Alejandro Mendez',
    gender: 'masculino',
    age: 29,
    location: { city: 'Santo Domingo', country: 'República Dominicana', address: 'Piantini' },
    description: 'Soy Alejandro, un profesional carismático y caballeroso. Me destaco por mi conversación interesante y mi actitud positiva. Ofrezco servicios de acompañamiento para eventos sociales, corporativos o simplemente para compartir momentos agradables. Soy discreto, educado y siempre dispuesto a hacer que cada experiencia sea especial.',
    shortDescription: 'Profesional del sector empresarial, elegante y con gran capacidad de comunicación',
    services: ['compania', 'eventos', 'cenas', 'viajes'],
    priceHour: 140,
    priceAdditionalHour: 110,
    priceOvernight: 550,
    priceWeekend: 850,
    languages: ['español', 'inglés', 'portugués'],
    nationality: 'Dominicano',
    height: 185,
    weight: 80,
    eyeColor: 'verde',
    hairColor: 'castaño',
    education: 'universitaria',
    availability: 'disponible',
    imageFiles: [
      'male-profile-1.jpg',
      'male-profile-2.jpg',
      'male-profile-3.jpg',
      'male-profile-4.jpg',
      'male-profile-5.jpg'
    ]
  },
  {
    email: 'valeria@example.com',
    password: 'password123',
    displayName: 'Valeria Sánchez',
    gender: 'femenino',
    age: 25,
    location: { city: 'Punta Cana', country: 'República Dominicana', address: 'Bávaro' },
    description: 'Hola, soy Valeria. Me considero una persona divertida, culta y con gran sentido del humor. Disfruto de la buena música, los viajes y las conversaciones interesantes. Ofrezco un servicio de acompañamiento exclusivo y personalizado para eventos, viajes o cualquier ocasión especial. Mi meta es que cada momento a mi lado sea memorable.',
    shortDescription: 'Bailarina profesional y entusiasta de los viajes, con una personalidad radiante',
    services: ['compania', 'eventos', 'cenas', 'viajes', 'baile'],
    priceHour: 130,
    priceAdditionalHour: 110,
    priceOvernight: 550,
    priceWeekend: 850,
    languages: ['español', 'inglés', 'alemán'],
    nationality: 'Dominicana',
    height: 168,
    weight: 56,
    eyeColor: 'azul',
    hairColor: 'rubio',
    education: 'universitaria',
    availability: 'disponible',
    imageFiles: [
      'female-profile-11.jpg',
      'female-profile-12.jpg',
      'female-profile-13.jpg',
      'female-profile-14.jpg',
      'female-profile-15.jpg'
    ]
  },
  {
    email: 'gabriel@example.com',
    password: 'password123',
    displayName: 'Gabriel Montero',
    gender: 'masculino',
    age: 28,
    location: { city: 'La Romana', country: 'República Dominicana', address: 'Centro' },
    description: 'Soy Gabriel, un amante de la buena conversación y los momentos agradables. Me caracterizo por ser atento, respetuoso y muy sociable. Ofrezco compañía de calidad para eventos, cenas o simplemente para pasar un buen rato. Me adapto fácilmente a cualquier situación y siempre busco que la experiencia sea única y placentera.',
    shortDescription: 'Modelo profesional y entrenador personal, apasionado por el fitness y la vida saludable',
    services: ['compania', 'eventos', 'cenas', 'viajes', 'entrenamiento_personal'],
    priceHour: 150,
    priceAdditionalHour: 120,
    priceOvernight: 600,
    priceWeekend: 950,
    languages: ['español', 'inglés'],
    nationality: 'Dominicano',
    height: 188,
    weight: 85,
    eyeColor: 'marrón',
    hairColor: 'negro',
    education: 'universitaria',
    availability: 'disponible',
    imageFiles: [
      'male-profile-6.jpg',
      'male-profile-7.jpg',
      'male-profile-8.jpg',
      'male-profile-9.jpg',
      'male-profile-10.jpg'
    ]
  }
];

// Imágenes genéricas en caso de que falten archivos - solo para mantener compatibilidad con el código original
const fallbackImages = {
  female: [
    'female-profile-fallback-1.jpg',
    'female-profile-fallback-2.jpg',
    'female-profile-fallback-3.jpg',
    'female-profile-fallback-4.jpg',
    'female-profile-fallback-5.jpg'
  ],
  male: [
    'male-profile-fallback-1.jpg',
    'male-profile-fallback-2.jpg',
    'male-profile-fallback-3.jpg',
    'male-profile-fallback-4.jpg',
    'male-profile-fallback-5.jpg'
  ]
};

async function createProfiles() {
  console.log('Iniciando creación de perfiles de acompañantes...');

  try {
    // Almacenar resultado de todos los perfiles para mostrarlos al final
    const createdProfiles = [];

    // Crear cada perfil
    for (const profileData of profiles) {
      try {
        // Verificar si el usuario ya existe
        const existingUser = await prisma.user.findUnique({
          where: { email: profileData.email }
        });

        let user;
        let userId;

        // Generar un slug para el perfil (lo necesitamos para las imágenes)
        const slug = existingUser?.profile?.slug || generateSlug(profileData.displayName);

        // Para todas las imágenes usaremos la misma ruta
        let imageUrls = Array(5).fill(getImageUrl());

        if (existingUser) {
          console.log(`Usuario ${profileData.email} ya existe. ID: ${existingUser.id}`);
          userId = existingUser.id;
          user = existingUser;
        } else {
          // Generar hash de la contraseña
          const passwordHash = await bcrypt.hash(profileData.password, saltRounds);
          
          // Crear el usuario base
          user = await prisma.user.create({
            data: {
              email: profileData.email,
              passwordHash,
              role: 'perfil',
              emailVerified: true,
              isActive: true,
              profileImageUrl: imageUrls[0], // Usar la primera imagen como imagen de perfil
            }
          });

          userId = user.id;
          console.log(`Usuario para perfil creado con ID: ${userId}`);
        }

        // Verificar si ya existe un perfil para este usuario
        const existingProfile = await prisma.profile.findUnique({
          where: { id: userId },
          include: { images: true }
        });

        // Crear el perfil si no existe
        if (!existingProfile) {
          // Preparar la fecha de nacimiento basada en la edad
          const today = new Date();
          const birthYear = today.getFullYear() - profileData.age;
          const birthDate = new Date(birthYear, today.getMonth(), today.getDate());

          // Crear el perfil
          const profile = await prisma.profile.create({
            data: {
              id: userId,
              displayName: profileData.displayName,
              slug,
              gender: profileData.gender,
              birthDate,
              age: profileData.age,
              description: profileData.description,
              shortDescription: profileData.shortDescription,
              verificationStatus: 'verificado', // Para que aparezca como verificado en las pruebas
              verifiedAt: new Date(),
              height: profileData.height,
              weight: profileData.weight,
              eyeColor: profileData.eyeColor,
              hairColor: profileData.hairColor,
              skinTone: 'media',
              nationality: profileData.nationality,
              languages: profileData.languages,
              location: profileData.location,
              travelAvailability: true,
              travelDestinations: ['local', 'nacional', 'internacional'],
              services: profileData.services,
              priceHour: profileData.priceHour,
              priceAdditionalHour: profileData.priceAdditionalHour,
              priceOvernight: profileData.priceOvernight,
              priceWeekend: profileData.priceWeekend,
              currency: 'USD',
              availabilityStatus: 'disponible',
              availabilitySchedule: {
                lunes: true,
                martes: true,
                miercoles: true,
                jueves: true,
                viernes: true,
                sabado: true,
                domingo: true
              },
              contactMethods: {
                whatsapp: '+18490000000',
                telefono: '+18490000000',
                email: profileData.email
              },
              isIndependent: true,
              isFeatured: Math.random() > 0.5, // Algunos perfiles destacados para probar
              searchBoostFactor: 2,
              hasHealthCertificate: true,
              orientation: 'heterosexual',
              personalityTags: ['amigable', 'extrovertida', 'culta'],
              interests: ['viajes', 'música', 'cine', 'gastronomía'],
              educationLevel: 'universitaria'
            }
          });

          console.log(`Perfil creado para ${profileData.displayName}`);

          // Crear imágenes para el perfil
          for (let i = 0; i < imageUrls.length; i++) {
            await prisma.profileImage.create({
              data: {
                profileId: userId,
                imageUrl: imageUrls[i],
                thumbnailUrl: imageUrls[i],
                mediumUrl: imageUrls[i],
                isMain: i === 0, // La primera imagen es la principal
                isApproved: true, // Todas aprobadas para pruebas
                isPublic: true,
                description: `Foto ${i+1} de ${profileData.displayName}`,
                orderPosition: i,
                blurHash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.'
              }
            });
          }

          console.log(`${imageUrls.length} imágenes creadas para el perfil de ${profileData.displayName}`);

          // Crear métricas aleatorias para el perfil
          await prisma.profileMetric.create({
            data: {
              profileId: userId,
              viewsCount: Math.floor(Math.random() * 1000),
              contactsCount: Math.floor(Math.random() * 100),
              chatsInitiatedCount: Math.floor(Math.random() * 50),
              searchAppearancesCount: Math.floor(Math.random() * 2000),
              favoriteCount: Math.floor(Math.random() * 200),
              clicksToContactCount: Math.floor(Math.random() * 300),
              contactConversionRate: Math.random() * 0.3,
              avgViewTime: Math.floor(Math.random() * 300),
              totalEarnings: Math.floor(Math.random() * 5000),
              lastCalculated: new Date(),
              metricsPeriod: 'monthly'
            }
          });

          // Si existen tags en la base de datos, les asignaremos algunos
          try {
            // Intentar obtener algunos tags existentes
            const tags = await prisma.tag.findMany({ take: 3 });
            
            if (tags.length > 0) {
              // Si hay tags, crear relaciones
              for (const tag of tags) {
                await prisma.profileTag.create({
                  data: {
                    profileId: userId,
                    tagId: tag.id
                  }
                });
              }
              console.log(`Tags asignados al perfil de ${profileData.displayName}`);
            }
          } catch (tagError) {
            console.log(`No se pudieron asignar tags al perfil: ${tagError.message}`);
          }

          createdProfiles.push({
            id: userId,
            name: profileData.displayName,
            email: profileData.email,
            password: profileData.password, // Solo para referencia de pruebas
            slug,
            images: imageUrls
          });

        } else {
          console.log(`El perfil para ${profileData.email} ya existe.`);
          
          // Actualizar las imágenes si no tienen el número correcto
          if (existingProfile.images.length < 5) {
            console.log(`Actualizando imágenes para el perfil de ${profileData.displayName}...`);
            
            // Eliminar imágenes existentes
            await prisma.profileImage.deleteMany({
              where: { profileId: userId }
            });
            
            // Crear nuevas imágenes
            for (let i = 0; i < imageUrls.length; i++) {
              await prisma.profileImage.create({
                data: {
                  profileId: userId,
                  imageUrl: imageUrls[i],
                  thumbnailUrl: imageUrls[i],
                  mediumUrl: imageUrls[i],
                  isMain: i === 0, // La primera imagen es la principal
                  isApproved: true,
                  isPublic: true,
                  description: `Foto ${i+1} de ${profileData.displayName}`,
                  orderPosition: i,
                  blurHash: 'LGF5?xYk^6#M@-5c,1J5@[or[Q6.'
                }
              });
            }
            
            console.log(`${imageUrls.length} imágenes actualizadas para ${profileData.displayName}`);
          }
          
          createdProfiles.push({
            id: userId,
            name: profileData.displayName,
            email: profileData.email,
            password: profileData.password, // Solo para referencia de pruebas
            slug: existingProfile.slug,
            images: imageUrls
          });
        }

      } catch (error) {
        console.error(`Error al crear perfil para ${profileData.email}:`, error);
      }
    }

    console.log('\n===== PERFILES CREADOS =====');
    createdProfiles.forEach((profile, index) => {
      console.log(`\n----- PERFIL ${index + 1} -----`);
      console.log(`ID: ${profile.id}`);
      console.log(`Nombre: ${profile.name}`);
      console.log(`Email: ${profile.email}`);
      console.log(`Contraseña: ${profile.password}`);
      console.log(`Slug: ${profile.slug}`);
      console.log(`URL perfil: http://localhost:3000/perfiles/${profile.slug}`);
      console.log('Imágenes:');
      profile.images.forEach((img, i) => {
        console.log(`  ${i+1}: ${img}`);
      });
    });

    return createdProfiles;
  } catch (error) {
    console.error('Error general al crear perfiles:', error);
    throw error;
  }
}

async function main() {
  try {
    const createdProfiles = await createProfiles();
    console.log('\nCreación de perfiles completada con éxito.');
    console.log(`Se crearon/actualizaron ${createdProfiles.length} perfiles.`);
    
    // Imprimir un resumen de información importante
    console.log('\n===== INFORMACIÓN DE IMÁGENES =====');
    console.log(`URL base de imágenes: ${BASE_IMAGE_URL}`);
    console.log('Todas las imágenes usan la misma URL base');
    console.log('Asegúrate de que esta ruta sea accesible desde tu aplicación web');
  } catch (error) {
    console.error('Error en el script principal:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar script
main();