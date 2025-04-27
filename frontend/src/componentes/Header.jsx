import React from 'react';
import { FaUser, FaSignOutAlt } from 'react-icons/fa';
import '../estilos/Header.css';
import loginImage from '../assets/logo png.png';

const Header = ({ onNavigate, userLoggedIn = false, handleLogout }) => {
  const handleNavigation = (page) => {
    if (onNavigate) {
      onNavigate(page);
    }
  };

  const handleProfileNavigation = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tipoUsuario = user.tipoUsuario || "cliente";
    if (tipoUsuario === "cliente") {
      handleNavigation("perfilCliente");
    } else if (tipoUsuario === "agencia") {
      handleNavigation("perfilAgencia");
    } else if (tipoUsuario === "acompanante") {
      handleNavigation("perfilAcompanante");
    }
  };

  return (
    <header className="header">
      <div className="header-content">
        <div className="logo-container">
          <img src={loginImage} alt="Logo" className="logo-image" />
        </div>
        
        <nav className="nav">
          <ul>
            <li>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('mainpage');
                }}
              >
                Inicio
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('homepage');
                }}
              >
                Explorar
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('agencias');
                }}
              >
                Agencias
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('about');
                }}
              >
                Sobre Nosotros
              </a>
            </li>
          </ul>
        </nav>
        
        <div className="auth-buttons">
          {userLoggedIn ? (
            <div className="user-profile-actions">
              <button 
                className="profile-button"
                onClick={handleProfileNavigation}
                title="Ver Perfil"
              >
                <FaUser size={20} />
              </button>
              <button 
                className="logout-button"
                onClick={handleLogout}
                title="Cerrar Sesión"
              >
                <FaSignOutAlt size={20} />
              </button>
            </div>
          ) : (
            <>
              <button 
                className="login"
                onClick={() => handleNavigation('login')}
              >
                Iniciar Sesión
              </button>
              <button 
                className="signup"
                onClick={() => handleNavigation('registro')}
              >
                Registrarse
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;