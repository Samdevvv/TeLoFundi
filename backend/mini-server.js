// mini-server.js (colócalo en la raíz del directorio backend)
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Carga el archivo .env
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  console.log(`Archivo .env encontrado en: ${envPath}`);
  dotenv.config({ path: envPath });
} else {
  console.log('No se encontró el archivo .env');
}

console.log('Iniciando servidor mínimo...');
console.log('Variables de entorno:', {
  PORT: process.env.PORT || '[no definido]',
  NODE_ENV: process.env.NODE_ENV || '[no definido]',
  DB_HOST: process.env.DB_HOST || '[no definido]'
});

// Crear un servidor HTTP básico sin express ni prisma
const http = require('http');
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ message: 'Servidor mínimo funcionando' }));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Servidor mínimo escuchando en el puerto ${PORT}`);
});