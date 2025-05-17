// check-app.js (colócalo en la raíz del directorio backend)
console.log('Verificando app.js...');

try {
  console.log('Intentando importar app.js...');
  const app = require('./src/app');
  console.log('¡app.js importado con éxito!');
  console.log('Tipo de app:', typeof app);
  console.log('¿Es una aplicación Express?', typeof app.use === 'function');
} catch (error) {
  console.error('Error al importar app.js:', error);
  
  // Intenta determinar si el archivo existe
  const fs = require('fs');
  const path = require('path');
  
  const appPaths = [
    './src/app.js',
    './app.js',
    './src/config/app.js'
  ];
  
  for (const appPath of appPaths) {
    const fullPath = path.resolve(process.cwd(), appPath);
    const exists = fs.existsSync(fullPath);
    console.log(`¿Existe ${appPath}?`, exists ? 'SÍ' : 'NO');
    
    if (exists) {
      console.log(`Contenido de ${appPath}:`);
      const content = fs.readFileSync(fullPath, 'utf8');
      console.log(content.slice(0, 500) + '...');
    }
  }
}