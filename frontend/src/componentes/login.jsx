import { useState } from "react";
import { motion } from "framer-motion";
import "../estilos/login.css";

import { FaUser, FaLock } from 'react-icons/fa'; // Iconos


const Login = () => {
    return (
      <div className="login-container">
        {/* Sección izquierda con logo */}
        <div className="login-left">
          <div className="login-logo">
            <h2>logo</h2>
          </div>
        </div>
  
        {/* Sección derecha con el formulario */}
        <div className="login-right">
          <form className="login-form">
            <h2 className="login-title">Bienvenido de nuevo</h2>
            <p className="login-subtitle">Ingresa tus datos para continuar</p>
  
            {/* Input de usuario */}
            <div className="input-group">
              <FaUser className="input-icon" />
              <input
                type="text"
                placeholder="Correo electrónico"
                className="form-control"
              />
            </div>
  
            {/* Input de contraseña */}
            <div className="input-group">
              <FaLock className="input-icon" />
              <input
                type="password"
                placeholder="Contraseña"
                className="form-control"
              />
            </div>
  
            {/* Botón de login */}
            <button className="login-button">Iniciar Sesión</button>
  
            {/* Pie de página */}
            <div className="login-footer">
              ¿No tienes cuenta? <a href="#">Regístrate</a>
            </div>
          </form>
        </div>
      </div>
    );
  };
  
  export default Login;