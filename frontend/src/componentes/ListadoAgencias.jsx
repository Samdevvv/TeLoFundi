import React, { useState, useEffect } from 'react';
import "../estilos/ListadoAgencias.css";
import "../estilos/Header.css";
import "../estilos/AgeVerificationModal.css";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faMapMarkerAlt, 
  faPhone, 
  faEnvelope, 
  faGlobe, 
  faFire, 
  faGem, 
  faStar,
  faShieldAlt,
  faUserCheck,
  faMapMarkedAlt,
  faClock
} from '@fortawesome/free-solid-svg-icons';
import { faFacebook, faTwitter, faInstagram, faTiktok, faSnapchat } from '@fortawesome/free-brands-svg-icons';
import { FaSearch, FaTimes, FaHeart } from 'react-icons/fa';
import Header from './Header';
import logoImage from "../assets/logo png.png";

const agencies = [
  {
    id: 1,
    name: 'Elite Companions',
    location: 'Santo Domingo, RD',
    description: 'Premium escort services offering discreet, high-class companionship for exclusive events.',
    image: 'https://images.unsplash.com/photo-1604684330644-5923755f5738?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 123-4567',
    email: 'contact@elitecompanions.com',
    website: 'www.elitecompanions.com',
    featured: true,
    services: ['VIP Escort', 'Eventos', 'Viajes'],
  },
  {
    id: 2,
    name: 'Velvet Dreams',
    location: 'Santiago, RD',
    description: 'Sofisticadas acompañantes para los clientes más exigentes que buscan elegancia y encanto.',
    image: 'https://images.unsplash.com/photo-1611042553484-d61f84d22784?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 987-6543',
    email: 'info@velvetdreams.com',
    website: 'www.velvetdreams.com',
    featured: true,
    services: ['Escort Premium', 'Masajes', 'Cenas'],
  },
  {
    id: 3,
    name: 'Luxe Experience',
    location: 'Punta Cana, RD',
    description: 'Servicios de lujo adaptados para clientes exclusivos y compromisos privados.',
    image: 'https://images.unsplash.com/photo-1622397323542-329e638e4817?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 555-7890',
    email: 'bookings@luxe-experience.com',
    website: 'www.luxe-experience.com',
    featured: true,
    services: ['VIP', 'Parejas', 'Hotel'],
  },
  {
    id: 4,
    name: 'Opulence RD',
    location: 'La Romana, RD',
    description: 'Compañía exclusiva para clientela de élite, garantizando privacidad y sofisticación.',
    image: 'https://images.unsplash.com/photo-1621784562807-cb450c3f404b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 444-5678',
    email: 'reservations@opulence.com',
    website: 'www.opulence.com',
    featured: false,
    services: ['Escorts', 'Eventos Privados', 'Lujo'],
  },
  {
    id: 5,
    name: 'Prestige RD',
    location: 'Puerto Plata, RD',
    description: 'Servicios premium para experiencias inolvidables en los mejores hoteles y resorts.',
    image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 666-1234',
    email: 'info@prestigerd.com',
    website: 'www.prestigerd.com',
    featured: false,
    services: ['Escorts VIP', 'Fiestas', 'Viajes'],
  },
  {
    id: 6,
    name: 'Aurora Dreams',
    location: 'Bávaro, RD',
    description: 'Compañía discreta y elegante para ocasiones privadas y corporativas.',
    image: 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 777-9012',
    email: 'contact@auroradreams.com',
    website: 'www.auroradreams.com',
    featured: false,
    services: ['Acompañantes', 'Hoteles', 'Eventos'],
  },
  {
    id: 7,
    name: 'Serene Caribe',
    location: 'Sosúa, RD',
    description: 'Servicios refinados que ofrecen experiencias personalizadas de alta clase.',
    image: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 888-3456',
    email: 'bookings@serenecaribe.com',
    website: 'www.serenecaribe.com',
    featured: false,
    services: ['VIP', 'Tours', 'Eventos Sociales'],
  },
  {
    id: 8,
    name: 'Majestic RD',
    location: 'Cabarete, RD',
    description: 'Servicios premium enfocados en elegancia, discreción y satisfacción del cliente.',
    image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800',
    phone: '+1 (809) 999-5678',
    email: 'info@majesticrd.com',
    website: 'www.majesticrd.com',
    featured: false,
    services: ['Acompañantes Elite', 'Eventos', 'Bodas'],
  },
];

const AgencyCard = ({ agency, index }) => (
  <div className="agency-card" style={{ '--card-index': index + 1 }}>
    <div className="agency-image-container">
      <img className="agency-image" src={agency.image} alt={agency.name} />
      {agency.featured && (
        <div className="agency-featured">
          <FontAwesomeIcon icon={faFire} /> Destacada
        </div>
      )}
    </div>
    <div className="agency-info">
      <div className="agency-header">
        <h3>{agency.name}</h3>
      </div>
      
      <div className="agency-location">
        <FontAwesomeIcon icon={faMapMarkerAlt} className="location-icon" />
        {agency.location}
      </div>
      
      <div className="agency-services">
        {agency.services.map((service, idx) => (
          <span key={idx} className="agency-service-tag">
            {service}
          </span>
        ))}
      </div>
      
      <p className="agency-description">{agency.description}</p>
      
      <div className="agency-contact">
        <span>
          <FontAwesomeIcon icon={faPhone} className="contact-icon" />
          {agency.phone}
        </span>
        <span>
          <FontAwesomeIcon icon={faEnvelope} className="contact-icon" />
          {agency.email}
        </span>
        <span>
          <FontAwesomeIcon icon={faGlobe} className="contact-icon" />
          <a href={`https://${agency.website}`} target="_blank" rel="noopener noreferrer">{agency.website}</a>
        </span>
      </div>
      
      <div className="agency-social">
        <a href="#" className="social-icon"><FontAwesomeIcon icon={faFacebook} /></a>
        <a href="#" className="social-icon"><FontAwesomeIcon icon={faInstagram} /></a>
        <a href="#" className="social-icon"><FontAwesomeIcon icon={faTwitter} /></a>
        <a href="#" className="social-icon"><FontAwesomeIcon icon={faTiktok} /></a>
        <a href="#" className="social-icon"><FontAwesomeIcon icon={faSnapchat} /></a>
      </div>
      
      <div className="agency-actions">
        <button className="agency-action">Ver Perfil</button>
      </div>
    </div>
  </div>
);

const ListadoAgencias = ({ setMenu, userLoggedIn, handleLogout }) => {
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showAgeModal, setShowAgeModal] = useState(false);
  // Estado para controlar el comportamiento responsive en móviles
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Detectar cambios en el tamaño de la ventana para ajustar elementos responsivos
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Comprobar si el usuario ya verificó su edad al cargar la página
  useEffect(() => {
    const ageVerified = localStorage.getItem('ageVerified');
    if (!ageVerified) {
      setShowAgeModal(true);
    }
  }, []);

  // Desactivar scroll e interactividad del body cuando la modal de edad está abierta
  useEffect(() => {
    if (showAgeModal) {
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.style.pointerEvents = 'none';
      }
    } else {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.style.pointerEvents = 'auto';
      }
    }
    return () => {
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
      document.body.style.height = '';
      const pageContainer = document.querySelector('.page-container');
      if (pageContainer) {
        pageContainer.style.pointerEvents = 'auto';
      }
    };
  }, [showAgeModal]);

  const openFiltersModal = () => {
    setShowFiltersModal(true);
  };

  const closeFiltersModal = () => {
    setShowFiltersModal(false);
  };

  const handleAgeAccept = () => {
    // Guardar en localStorage que el usuario ha verificado su edad
    localStorage.setItem('ageVerified', 'true');
    setShowAgeModal(false);
  };

  const handleAgeCancel = () => {
    window.location.href = 'https://Google.com';
  };

  const fireParticles = Array.from({ length: isMobile ? 15 : 30 }).map((_, index) => (
    <div
      key={index}
      className="fire-particle"
      style={{
        left: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 3}s`
      }}
    />
  ));

  return (
    <div className="page-container">
      {/* Modal de verificación de edad - Modificado para mejor visualización en móviles */}
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

      <section className="hero-section">
        <div className="hero-overlay"></div>
        {/* Header con logo flotante */}
        <Header onNavigate={setMenu} userLoggedIn={userLoggedIn} handleLogout={handleLogout} />
        
        <div className="hero-content">
          <h1 className="Titulo">Las Mejores Agencias</h1>
          <p>Encuentra las agencias más exclusivas y escorts de lujo en toda la República Dominicana</p>
          <div className="search-container">
            <div className="search-box">
              <input
                type="text"
                className="search-input"
                placeholder={isMobile ? "Buscar..." : "Buscar por nombre, ubicación o servicios..."}
                onClick={openFiltersModal}
                readOnly
              />
              <button className="search-button" onClick={openFiltersModal}>
                <FaSearch size={isMobile ? 16 : 20} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Sección de Agencias VIP */}
      <section className="featured-services-section agencies-vip-section">
        <div className="container">
          <div className="section-header">
            <h2>Agencias Destacadas</h2>
            <a href="#" className="view-all">Ver todas</a>
          </div>
          <div className="services-containers agencies-container-featured">
            {agencies.filter(agency => agency.featured).map((agency, index) => (
              <AgencyCard key={agency.id} agency={agency} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* Todas las agencias */}
      <section className="agencies-section">
        <div className="container">
          <div className="section-header">
            <h2>Todas las Agencias</h2>
          </div>
          <div className="agencies-container">
            {agencies.map((agency, index) => (
              <AgencyCard key={agency.id} agency={agency} index={index} />
            ))}
          </div>
        </div>
      </section>
      
      {/* Sección de estadísticas actualizada con 6 ítems */}
      <section className="stats-section">
        <div className="container">
          <div className="stats-container">
            <div className="stat-item">
              <FontAwesomeIcon icon={faGem} className="stat-icon" />
              <div className="stat-info">
                <h3>50+</h3>
                <p>Agencias Verificadas</p>
              </div>
            </div>
            
            <div className="stat-item">
              <FontAwesomeIcon icon={faShieldAlt} className="stat-icon" />
              <div className="stat-info">
                <h3>100%</h3>
                <p>Confidencialidad</p>
              </div>
            </div>
            
            <div className="stat-item">
              <FontAwesomeIcon icon={faUserCheck} className="stat-icon" />
              <div className="stat-info">
                <h3>1000+</h3>
                <p>Clientes Satisfechos</p>
              </div>
            </div>
            
            <div className="stat-item">
              <FontAwesomeIcon icon={faMapMarkedAlt} className="stat-icon" />
              <div className="stat-info">
                <h3>15+</h3>
                <p>Ciudades Cubiertas</p>
              </div>
            </div>
            
            <div className="stat-item">
              <FontAwesomeIcon icon={faStar} className="stat-icon" />
              <div className="stat-info">
                <h3>4.9</h3>
                <p>Valoración Promedio</p>
              </div>
            </div>
            
            <div className="stat-item">
              <FontAwesomeIcon icon={faClock} className="stat-icon" />
              <div className="stat-info">
                <h3>24/7</h3>
                <p>Servicio Disponible</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modal de filtros - adaptado para pantallas pequeñas */}
      {showFiltersModal && (
        <div className="modal-overlay" onClick={closeFiltersModal}>
          <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Búsqueda avanzada</h3>
              <button className="close-modal" onClick={closeFiltersModal}>
                <FaTimes size={isMobile ? 20 : 24} />
              </button>
            </div>

            <div className="filters-container-modal">
              <div className="filter-group">
                <label>Categoría de Servicio</label>
                <select className="filter-select">
                  <option value="">Todas las categorías</option>
                  <option value="female">Escorts Femeninas</option>
                  <option value="trans">Trans y Travestis</option>
                  <option value="male">Escorts Masculinos</option>
                  <option value="vip">Servicios VIP</option>
                  <option value="companion">Servicio de Compañía</option>
                  <option value="massage">Masajes Eróticos</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Ubicación</label>
                <select className="filter-select">
                  <option value="">Todas las ubicaciones</option>
                  <option value="santodomingo">Santo Domingo</option>
                  <option value="santiago">Santiago</option>
                  <option value="puntacana">Punta Cana</option>
                  <option value="lapromana">La Romana</option>
                  <option value="puertoplata">Puerto Plata</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Rango de Precios</label>
                <div className="range-inputs">
                  <select className="filter-select">
                    <option value="">Cualquier precio</option>
                    <option value="economico">Económico</option>
                    <option value="estandar">Estándar</option>
                    <option value="premium">Premium</option>
                    <option value="lujo">Lujo</option>
                  </select>
                </div>
              </div>

              <button className="apply-filters" onClick={closeFiltersModal}>
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer - adaptado para móviles */}
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

export default ListadoAgencias;