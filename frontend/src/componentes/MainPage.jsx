import React, { useState } from 'react';
import "../estilos/Mainpage.css";

// Importaciones de imágenes (reemplaza estas rutas con tus imágenes reales)
import heroImage from "../assets/heroimage.webp";
import femaleServiceImg from "../assets/scort femenino.webp";
import transServiceImg from "../assets/scorts trnas.jpg";
import maleServiceImg from "../assets/scort masculino.jpeg";
import companionServiceImg from "../assets/compañia.jpg";
import vipServiceImg from "../assets/vip.jpg";
import massageServiceImg from "../assets/masaje.jpg";

const Homepage = () => {
  // Estado para controlar la visibilidad del modal de filtros
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  
  // Función para mostrar el modal
  const openFiltersModal = () => {
    setShowFiltersModal(true);
  };

  // Función para cerrar el modal
  const closeFiltersModal = () => {
    setShowFiltersModal(false);
  };

  // Datos de servicios
  const services = [
    {
      id: 'female',
      title: 'Escorts Femeninas',
      description: 'Acompañantes femeninas de alta calidad para momentos especiales',
      image: femaleServiceImg,
      price: 'Desde 150€',
      featured: true
    },
    {
      id: 'trans',
      title: 'Trans y Travestis',
      description: 'Escorts trans y travestis para experiencias únicas',
      image: transServiceImg,
      price: 'Desde 170€',
      featured: true
    },
    {
      id: 'male',
      title: 'Escorts Masculinos',
      description: 'Acompañantes masculinos para satisfacer tus deseos',
      image: maleServiceImg,
      price: 'Desde 140€',
      featured: false
    },
    {
      id: 'vip',
      title: 'Servicio VIP',
      description: 'Experiencias premium con nuestras/os mejores acompañantes',
      image: vipServiceImg,
      price: 'Desde 300€',
      featured: true
    },
    {
      id: 'companion',
      title: 'Servicio de Compañía',
      description: 'Compañía de calidad para eventos, cenas o viajes',
      image: companionServiceImg,
      price: 'Desde 200€',
      featured: false
    },
    {
      id: 'massage',
      title: 'Masajes Eróticos',
      description: 'Masajes relajantes y eróticos con final feliz',
      image: massageServiceImg,
      price: 'Desde 120€',
      featured: false
    }
  ];

  // Obtener servicios destacados
  const getFeaturedServices = () => {
    return services.filter(service => service.featured);
  };

  return (
    <div className="page-container">
      <header className="header">
        <div className="header-content">
          <span className="logo">❤️ LoveConnect</span>
          <nav className="nav">
            <ul>
              <li><a href="#" className="active">Inicio</a></li>
              <li><a href="#">Servicios</a></li>
              <li><a href="#">VIP</a></li>
              <li><a href="#">Contacto</a></li>
            </ul>
          </nav>
          <div className="auth-buttons">
            <button className="login">Iniciar Sesión</button>
            <button className="signup">Registrarse</button>
          </div>
        </div>
      </header>
      
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>Encuentra tu compañía ideal</h1>
          <p>Escorts, masajes y servicios VIP en toda España</p>
          <div className="search-container">
            <div className="search-box">
              <input 
                type="text" 
                placeholder="Buscar por ubicación o servicios..." 
                className="search-input" 
                onClick={openFiltersModal}
                readOnly
              />
              <button className="search-button" onClick={openFiltersModal}>🔍</button>
            </div>
          </div>
        </div>
      </section>
      
      {/* Servicios Destacados */}
      <section className="featured-services-section">
        <div className="container">
          <div className="section-header">
            <h2>Servicios Destacados</h2>
            <a href="#" className="view-all">Ver todos</a>
          </div>
          <div className="services-container">
            {getFeaturedServices().map(service => (
              <div key={service.id} className="service-card">
                <div className="service-image-container">
                  <img src={service.image} alt={service.title} className="service-image" />
                  <div className="service-price">{service.price}</div>
                </div>
                <div className="service-info">
                  <h3>{service.title}</h3>
                  <p className="service-description">{service.description}</p>
                  <div className="service-actions">
                    <button className="service-action view">Ver Anuncios</button>
                    <button className="service-action info">Info</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Todos los Servicios */}
      <section className="all-services-section">
        <div className="container">
          <div className="section-header">
            <h2>Todos los Servicios</h2>
          </div>
          <div className="services-grid">
            {services.map(service => (
              <div key={service.id} className="service-tile">
                <div className="service-tile-image">
                  <img src={service.image} alt={service.title} />
                  <div className="service-tile-overlay">
                    <h3>{service.title}</h3>
                    <p>{service.price}</p>
                    <button className="service-tile-btn">Ver Más</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Sección de Banner Promocional */}
      <section className="promo-banner">
        <div className="container">
          <div className="promo-content">
            <h2>¿Quieres más visibilidad?</h2>
            <p>Anuncia tus servicios en nuestra plataforma y llega a miles de clientes potenciales</p>
            <button className="promo-button">Publicar Anuncio</button>
          </div>
        </div>
      </section>
      
      {/* Sección de Servicios Populares */}
      <section className="popular-services">
        <div className="container">
          <div className="section-header">
            <h2>¿Qué estás buscando?</h2>
          </div>
          <div className="services-tags">
            <span className="service-tag">Masajes</span>
            <span className="service-tag">Salidas</span>
            <span className="service-tag">Escorts Femeninas</span>
            <span className="service-tag">Trans y Travestis</span>
            <span className="service-tag">Escorts Masculinos</span>
            <span className="service-tag">Dominación</span>
            <span className="service-tag">GFE</span>
            <span className="service-tag">Parejas</span>
            <span className="service-tag">Viajes</span>
            <span className="service-tag">Eventos</span>
          </div>
        </div>
      </section>
      
      {/* Modal de Filtros */}
      {showFiltersModal && (
        <div className="modal-overlay" onClick={closeFiltersModal}>
          <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Búsqueda avanzada</h3>
              <button className="close-modal" onClick={closeFiltersModal}>×</button>
            </div>
            
            <div className="modal-search">
              <input 
                type="text" 
                placeholder="Buscar por tipo de servicio..." 
                className="modal-search-input" 
              />
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
                  <option value="Madrid">Madrid</option>
                  <option value="Barcelona">Barcelona</option>
                  <option value="Valencia">Valencia</option>
                  <option value="Sevilla">Sevilla</option>
                  <option value="Bilbao">Bilbao</option>
                </select>
              </div>
              
              <div className="filter-group">
                <label>Precio</label>
                <div className="range-inputs">
                  <input type="number" placeholder="Min €" min="50" max="1000" className="range-input" />
                  <span>-</span>
                  <input type="number" placeholder="Max €" min="50" max="1000" className="range-input" />
                </div>
              </div>
              
              <div className="modal-footer">
                <button className="apply-filters" onClick={closeFiltersModal}>
                  Aplicar Filtros
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-main">
            <div className="footer-logo">
              <span className="logo">❤️ LoveConnect</span>
              <p>La mejor plataforma para encontrar compañía</p>
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
                  <li><a href="#">Estadísticas</a></li>
                </ul>
              </div>
              
              <div className="footer-links-column">
                <h4>Información</h4>
                <ul>
                  <li><a href="#">Términos y Condiciones</a></li>
                  <li><a href="#">Política de Privacidad</a></li>
                  <li><a href="#">Cookies</a></li>
                  <li><a href="#">Contacto</a></li>
                </ul>
              </div>
            </div>
          </div>
          
          <div className="footer-bottom">
            <p>© 2025 LoveConnect - Todos los derechos reservados</p>
            <p className="disclaimer">Acceso solo para mayores de 18 años. Este sitio contiene material para adultos.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;