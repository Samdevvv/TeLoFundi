// src/componentes/PerfilAcompañantePropio.jsx
import React from 'react';
import ProfileEdit from './ProfileEdit';

const PerfilAcompañantePropio = ({ setMenu }) => {
  // Obtener la configuración de la aplicación
  const appConfig = {
    API_BASE_URL: 'http://localhost:5000',
    FRONTEND_URL: 'http://localhost:5173'
  };
  
  return (
    <ProfileEdit 
      setMenu={setMenu} 
      appConfig={appConfig} 
    />
  );
};

export default PerfilAcompañantePropio;