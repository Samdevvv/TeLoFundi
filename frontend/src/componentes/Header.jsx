import React, { useState } from 'react';
import { FaUser, FaSignOutAlt, FaHeart } from 'react-icons/fa';
import '../estilos/Header.css';
import loginImage from '../assets/logo png.png';

const Header = ({ onNavigate, userLoggedIn = false, handleLogout }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  
  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };
  
  const handleNavigation = (page) => {
    if (onNavigate) {
      onNavigate(page);
      setMenuOpen(false);
    }
  };

  const handleProfileNavigation = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    const tipoUsuario = user.tipoUsuario || "cliente";
    
    console.log("Tipo de usuario detectado:", tipoUsuario);
    
    if (tipoUsuario === "cliente") {
      handleNavigation("perfilCliente");
    } else if (tipoUsuario === "agencia") {
      handleNavigation("perfilAgencia");
    } else if (tipoUsuario === "perfil" || tipoUsuario === "acompanante") {
      handleNavigation("perfilAcompanante");
    } else {
      console.log("Tipo de usuario no reconocido:", tipoUsuario);
      handleNavigation("homepage");
    }
  };
  
  return (
    <header className="header">
      <div className="logo">
        <img
          src={loginImage}
          alt="Logo"
          onClick={() => handleNavigation('mainpage')}
        />
      </div>
      
      <div 
        className={`hamburger-button ${menuOpen ? 'active' : ''}`} 
        onClick={toggleMenu}
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </div>
      
      <div className={`nav-container ${menuOpen ? 'active' : ''}`}>
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
                  handleNavigation('exploreProfiles');
                }}
              >
                Perfiles
              </a>
            </li>
            <li>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('listadoAgencias');
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
            <li>
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('terminos');
                }}
              >
                Términos y Condiciones
              </a>
            </li>
          </ul>
        </nav>
        
        <div className="auth-buttons">
          {userLoggedIn ? (
            <div className="user-profile-actions">
              <button 
                className="favorites-button"
                onClick={() => handleNavigation('favorites')}
                title="Mis Favoritos"
              >
                <FaHeart />
              </button>
              <button 
                className="profile-button"
                onClick={handleProfileNavigation}
                title="Ver Perfil"
              >
                <FaUser />
              </button>
              <button 
                className="logout-button"
                onClick={handleLogout}
                title="Cerrar Sesión"
              >
                <FaSignOutAlt />
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
      
      {menuOpen && (
        <div 
          className={`menu-overlay ${menuOpen ? 'active' : ''}`}
          onClick={() => setMenuOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;