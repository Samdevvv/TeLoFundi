import React from 'react';
import { FaSearch, FaUser } from 'react-icons/fa';
import '../estilos/Header.css';
import loginImage from '../assets/logo png.png'; // Asegúrate de que la ruta sea correcta

const Header = ({ onNavigate, userLoggedIn = false }) => {
  // Esta función manejaría la navegación entre páginas
  const handleNavigation = (page) => {
    if (onNavigate) {
      onNavigate(page);
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
                  handleNavigation('home');
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
                  handleNavigation('acompanantes');
                }}
              >
                Acompañantes
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
            <div className="user-profile-icon">
              <a 
                href="#" 
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation('profile');
                }}
              >
                <FaUser size={20} />
              </a>
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