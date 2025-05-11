import React, { useState, useEffect } from 'react';
import "../estilos/SobreNosotros.css";
import "../estilos/AgeVerificationModal.css";
import "../estilos/Header.css";
import logoImage from "../assets/logo png.png";
import heroImage from "../assets/heroterminos.avif"; // Asegúrate de que esta ruta sea correcta
import Header from './Header';
import { 
  FaHeart, 
  FaGem, 
  FaShieldAlt, 
  FaHandshake,
  FaCrown,
  FaLock,
  FaArrowRight,
  FaSearch, 
  FaTimes
} from 'react-icons/fa';

const About = ({ setMenu, userLoggedIn, handleLogout }) => {
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [animated, setAnimated] = useState({});
  
  // Detectar cambios en el tamaño de la ventana
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Función para manejar la animación de elementos cuando entran en el viewport
  useEffect(() => {
    const handleScroll = () => {
      const sections = document.querySelectorAll('.animate-on-scroll');
      
      sections.forEach(section => {
        const sectionTop = section.getBoundingClientRect().top;
        const triggerPoint = window.innerHeight * 0.8;
        
        if (sectionTop < triggerPoint) {
          section.classList.add('animate');
          setAnimated(prev => ({...prev, [section.id]: true}));
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    // Activar la animación inicial para los elementos visibles
    setTimeout(handleScroll, 100);
    
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Comprobar si el usuario ya verificó su edad al cargar la página
  useEffect(() => {
    const ageVerified = localStorage.getItem('ageVerified');
    if (!ageVerified) {
      setShowAgeModal(true);
    }
  }, []);

  // Controlar el scroll cuando el modal de edad está visible
  useEffect(() => {
    if (showAgeModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAgeModal]);

  // Función para aplicar los estilos a las secciones con un delay
  useEffect(() => {
    // Forzar el fondo negro
    document.body.style.backgroundColor = '#000000';
    
    // Agregar la clase animate a todas las secciones después de un breve delay
    const timer = setTimeout(() => {
      const sections = document.querySelectorAll('.animate-on-scroll');
      sections.forEach(section => {
        section.classList.add('animate');
      });
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  const handleAgeAccept = () => {
    localStorage.setItem('ageVerified', 'true');
    setShowAgeModal(false);
  };

  const handleAgeCancel = () => {
    window.location.href = 'https://www.google.com';
  };

  const fireParticles = Array.from({ length: isMobile ? 15 : 30 }).map((_, index) => (
    <div
      key={index}
      className="fire-particle"
      style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`,
      }}
    />
  ));

  // Estilo inline para forzar el color de fondo
  const pageStyle = {
    backgroundColor: '#000000',
    color: '#ffffff',
    minHeight: '100vh',
    width: '100%'
  };

  return (
    <div className="page-container" style={pageStyle}>
      {/* Modal de verificación de edad */}
      {showAgeModal && (
        <div className="age-modal-overlay">
          <div className="age-modal">
            {fireParticles}
            <img src={logoImage} alt="Telo Fundi Logo" className="age-modal-logo" />
            <p className="age-modal-text">
              Este sitio contiene contenido exclusivo para mayores de 18 años. 
              Al continuar, confirmas que tienes la edad legal para acceder. 
              Telo Fundi no se responsabiliza por accesos no autorizados. 
              Por favor, selecciona una opción para proceder.
            </p>
            <div className="age-modal-buttons">
              <button className="age-accept" onClick={handleAgeAccept}></button>
              <button className="age-cancel" onClick={handleAgeCancel}></button>
            </div>
            <p className="age-modal-footer">Telo Fundi - ©2025</p>
          </div>
        </div>
      )}

      {/* Hero Section con imagen de fondo */}
      <section className="hero-section" style={{ 
          backgroundImage: `url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}>
        <div className="hero-overlay"></div>
        
        {/* El Header no se modifica, solo se incluye tal cual */}
        <Header onNavigate={setMenu} userLoggedIn={userLoggedIn} handleLogout={handleLogout} />
        
        <div className="hero-content">
          <h1>Sobre Te lo Fundi</h1>
          <p>Conoce nuestra historia y pasión por conectar momentos únicos en República Dominicana.</p>
        </div>
      </section>

      {/* Sección Sobre Nosotros con fondo negro forzado */}
      <section id="about-section" className="about-section animate-on-scroll" style={{backgroundColor: '#000000'}}>
        <div className="container">
          <div className="about-content">
            <div className="about-left">
              <img src={logoImage} alt="Telo Fundi Logo" className="about-logo" />
              <h1>Nuestra Historia</h1>
              <p className="tagline">Donde la pasión encuentra su lugar</p>
            </div>
            <div className="about-right">
              <h2>¿Quiénes Somos?</h2>
              <p>
                Telo Fundi es la plataforma líder en República Dominicana para conectar a personas con experiencias de compañía exclusivas. Desde 2025, hemos trabajado para ofrecer un espacio seguro, discreto y profesional donde la calidad y la satisfacción son la prioridad.
              </p>
              <p>
                Nuestra misión es romper tabúes y ofrecer servicios premium que se adapten a las necesidades de nuestros clientes, con un enfoque en la transparencia y el respeto mutuo.
              </p>
              <p>
                Nos distinguimos por la exclusividad de nuestro catálogo, la verificación rigurosa de todos nuestros perfiles y la atención personalizada que brindamos tanto a usuarios como a quienes ofrecen sus servicios en nuestra plataforma.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Valores con fondo negro forzado */}
      <section id="values-section" className="values-section animate-on-scroll" style={{backgroundColor: '#000000'}}>
        <div className="container">
          <h2>Nuestros Valores</h2>
          <div className="values-grid">
            <div className="value-item">
              <div className="value-icon">
                <FaGem size={40} />
              </div>
              <h3>Exclusividad</h3>
              <p>Seleccionamos cuidadosamente a nuestros acompañantes para garantizar experiencias excepcionales y de auténtico lujo.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">
                <FaShieldAlt size={40} />
              </div>
              <h3>Seguridad</h3>
              <p>Todos los perfiles son verificados rigurosamente para garantizar una experiencia confiable y sin preocupaciones.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">
                <FaHeart size={40} />
              </div>
              <h3>Pasión</h3>
              <p>Creemos en la conexión humana genuina y en crear momentos que perdurarán en la memoria.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección Principios con fondo negro forzado */}
      <section id="principles-section" className="values-section animate-on-scroll" style={{backgroundColor: '#000000'}}>
        <div className="container">
          <h2>Nuestros Principios</h2>
          <div className="values-grid">
            <div className="value-item">
              <div className="value-icon">
                <FaCrown size={40} />
              </div>
              <h3>Excelencia</h3>
              <p>Nos esforzamos constantemente por superar las expectativas y mejorar la calidad de nuestros servicios.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">
                <FaLock size={40} />
              </div>
              <h3>Discreción</h3>
              <p>Garantizamos absoluta privacidad y confidencialidad en cada interacción dentro de nuestra plataforma.</p>
            </div>
            <div className="value-item">
              <div className="value-icon">
                <FaHandshake size={40} />
              </div>
              <h3>Confianza</h3>
              <p>Construimos relaciones basadas en la honestidad y transparencia con todos nuestros usuarios.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Sección CTA con fondo negro forzado */}
      <section id="cta-section" className="cta-section animate-on-scroll" style={{backgroundColor: '#000000'}}>
        <div className="container">
          <h2>Únete a Nuestra Comunidad</h2>
          <p>Descubre un mundo de experiencias únicas y forma parte de Telo Fundi hoy mismo. Nuestro equipo está listo para brindarte la mejor atención.</p>
          <button 
            className="cta-button" 
            onClick={() => setMenu('registro')}
          >
            Registrarse Ahora <FaArrowRight style={{ marginLeft: '10px' }} />
          </button>
        </div>
      </section>

      {/* El Footer no se modifica, solo se incluye tal cual */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-logo">
              <img src={logoImage} alt="Telo Fundi" className="footer-logo-image" />
              <p>La mejor plataforma para encontrar compañía de calidad en toda República Dominicana</p>
            </div>
            <div className="footer-links">
              <div className="footer-links-column">
                <h4>Categorías</h4>
                <ul>
                  <li><a href="#">Escorts Femeninas</a></li>
                  <li><a href="#">Trans y Travestis</a></li>
                  <li><a href="#">Escorts Masculinos</a></li>
                  <li><a href="#">Servicios VIP</a></li>
                  <li><a href="#">Masajes</a></li>
                </ul>
              </div>
              <div className="footer-links-column">
                <h4>Para Anunciantes</h4>
                <ul>
                  <li><a href="#">Publicar Anuncio</a></li>
                  <li><a href="#">Planes Premium</a></li>
                  <li><a href="#">Verificación</a></li>
                </ul>
              </div>
              <div className="footer-links-column">
                <h4>Información</h4>
                <ul>
                  <li><a href="#">Términos y Condiciones</a></li>
                  <li><a href="#">Cookies</a></li>
                  <li><a href="#">Contacto</a></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2025 Telo Fundi - Todos los derechos reservados</p>
            <p className="disclaimer">Acceso solo para mayores de 18 años. Este sitio contiene material para adultos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default About;