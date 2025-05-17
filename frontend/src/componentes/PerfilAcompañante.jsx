// File: PerfilAcompañante.jsx (COMPLETO)
import React, { useState, useEffect } from 'react';
import { 
  FaMapMarkerAlt, FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaGlobe, 
  FaInstagram, FaWhatsapp, FaArrowLeft, FaTimes, FaChevronLeft, FaChevronRight,
  FaCheckCircle, FaStar, FaComments, FaHeart, FaRegHeart, FaEye
} from 'react-icons/fa';
import axios from 'axios';

// URL base de la API
const API_BASE_URL = 'http://localhost:5000/api';

const Perfil = ({ profileData = null, onBackClick, onContactClick, userLoggedIn }) => {
  const [formattedProfileData, setFormattedProfileData] = useState(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [openSection, setOpenSection] = useState('fotos'); // fotos, servicios, info
  
  console.log("PerfilAcompañante received data:", profileData);
  
  // Check if profile is in favorites (for logged-in users)
  useEffect(() => {
    const checkFavoriteStatus = async () => {
      if (!profileData || !userLoggedIn) return;
      
      try {
        const response = await axios.get(`${API_BASE_URL}/profiles/favorites`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.data && response.data.success && response.data.data) {
          const isFav = response.data.data.profiles.some(p => p.id === profileData.id);
          setIsFavorite(isFav);
        }
      } catch (err) {
        console.warn("Could not check favorite status", err);
      }
    };
    
    checkFavoriteStatus();
  }, [profileData, userLoggedIn]);

  // Process the profile data from API - MEJORADO para manejar más tipos de datos
 useEffect(() => {
  if (profileData) {
    const formatData = () => {
      // Validar que las imágenes existan - check both field names
      const profileImages = Array.isArray(profileData.images) 
        ? profileData.images 
        : Array.isArray(profileData.profileImages)
          ? profileData.profileImages
          : [];
          
      // Buscar la imagen principal o usar la primera
      const mainImage = profileImages.length > 0 
        ? (profileImages.find(img => img.isMain) || profileImages[0]) 
        : null;
          
      // Transform API data to match component's expected structure based on Prisma schema
      return {
        id: profileData.id,
        nombre: profileData.displayName || "Sin nombre",
        ubicacion: profileData.location && (typeof profileData.location === 'object')
          ? `${profileData.location.city || ''}, ${profileData.location.country || ''}`
          : "Ubicación no especificada",
        fotoPerfil: mainImage 
          ? (mainImage.imageUrl || mainImage.mediumUrl || mainImage.thumbnailUrl)
          : profileData.user && profileData.user.profileImageUrl
            ? profileData.user.profileImageUrl
            : 'https://via.placeholder.com/280x373?text=Sin+Imagen',
          edad: profileData.age || 0,
          genero: profileData.gender || "No especificado",
          descripcion: profileData.description || profileData.shortDescription || "Sin descripción",
          descripcionCorta: profileData.shortDescription || "",
          telefono: profileData.contactMethods && typeof profileData.contactMethods === 'object'
            ? (profileData.contactMethods.whatsapp || profileData.contactMethods.phone || "No disponible")
            : "No disponible",
          email: profileData.contactMethods && typeof profileData.contactMethods === 'object'
            ? (profileData.contactMethods.email || "No disponible")
            : "No disponible",
          fechaRegistro: profileData.user?.createdAt 
            ? new Date(profileData.user.createdAt).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : "No disponible",
          servicios: Array.isArray(profileData.services) 
            ? profileData.services 
            : typeof profileData.services === 'string'
              ? [profileData.services]
              : [],
          disponibilidad: typeof profileData.availabilitySchedule === 'string'
            ? profileData.availabilitySchedule
            : typeof profileData.availabilitySchedule === 'object' && profileData.availabilitySchedule !== null
              ? Object.entries(profileData.availabilitySchedule)
                .filter(([_, value]) => value)
                .map(([key]) => key)
                .join(', ') 
              : "No especificado",
          idiomas: Array.isArray(profileData.languages)
            ? profileData.languages
            : typeof profileData.languages === 'string'
              ? profileData.languages.split(',').map(i => i.trim())
              : ["No especificado"],
          tarifaBase: profileData.priceHour
            ? `${Number(profileData.priceHour).toFixed(2)} ${profileData.currency || 'USD'}`
            : "No especificado",
          tarifasDetalladas: {
            base: profileData.priceHour ? Number(profileData.priceHour).toFixed(2) : 'N/A',
            hora: profileData.priceHour ? Number(profileData.priceHour).toFixed(2) : null,
            adicional: profileData.priceAdditionalHour ? Number(profileData.priceAdditionalHour).toFixed(2) : null,
            noche: profileData.priceOvernight ? Number(profileData.priceOvernight).toFixed(2) : null,
            fin: profileData.priceWeekend ? Number(profileData.priceWeekend).toFixed(2) : null,
            moneda: profileData.currency || 'USD'
          },
          categorias: profileData.profileTags 
            ? profileData.profileTags.map(tag => tag.tag?.name || tag) 
            : [],
          redes: {
            instagram: profileData.socialMedia?.instagram || "",
            twitter: profileData.socialMedia?.twitter || "",
            facebook: profileData.socialMedia?.facebook || ""
          },
          fotos: profileImages.map((foto, index) => ({
            id: foto.id || `photo-${index}`,
            url: foto.imageUrl || foto.mediumUrl || foto.thumbnailUrl || 'https://via.placeholder.com/300x300?text=Sin+Imagen',
            descripcion: foto.description || `Foto ${index + 1}`,
            esPrincipal: foto.isMain || false
          })),
          verificado: profileData.verificationStatus === 'verificado',
          agenciaVerificadora: profileData.agency?.name || "Sistema",
          estaDisponible: profileData.availabilityStatus === 'disponible',
          altura: profileData.height ? `${profileData.height}` : "No especificado",
          peso: profileData.weight ? `${profileData.weight}` : "No especificado",
          medidas: profileData.measurements || "No especificado",
          colorOjos: profileData.eyeColor || "No especificado",
          colorPelo: profileData.hairColor || "No especificado",
          scoreActividad: 0, // No hay campo equivalente
          totalViews: profileData.totalViews || 0,
          totalFavorites: profileData.totalFavorites || 0,
          lastActivity: profileData.lastActivity 
            ? new Date(profileData.lastActivity).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })
            : "No disponible"
        };
      };
      
      try {
        const formatted = formatData();
        console.log("Formatted profile data:", formatted);
        setFormattedProfileData(formatted);
      } catch (error) {
        console.error("Error formatting profile data:", error);
      }
    }
  }, [profileData]);

  // Handle forced back action on Escape key
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape' && !showPhotoModal && onBackClick) {
        console.log("Escape key pressed - forcing back");
        onBackClick();
      }
    };
    
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [showPhotoModal, onBackClick]);

  useEffect(() => {
    // Lock body scroll when photo modal is open
    if (showPhotoModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [showPhotoModal]);

  // Handle keyboard navigation for photo modal
  const handleKeyDown = (e) => {
    if (showPhotoModal && formattedProfileData) {
      if (e.key === 'Escape') {
        setShowPhotoModal(false);
      } else if (e.key === 'ArrowRight') {
        const totalPhotos = formattedProfileData.fotos.length;
        setSelectedPhotoIndex((selectedPhotoIndex + 1) % totalPhotos);
      } else if (e.key === 'ArrowLeft') {
        const totalPhotos = formattedProfileData.fotos.length;
        setSelectedPhotoIndex((selectedPhotoIndex - 1 + totalPhotos) % totalPhotos);
      }
    }
  };

  // Add keyboard event listeners
  useEffect(() => {
    if (formattedProfileData) {
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showPhotoModal, selectedPhotoIndex, formattedProfileData]);

  // Force back function con mejor manejo de errores
  const forceBack = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log("Back button clicked - forcing back navigation");
    
    if (typeof onBackClick === 'function') {
      onBackClick();
    } else {
      console.error("onBackClick is not a function:", onBackClick);
      alert("Error: No se puede volver a la página principal.");
      // Intento de usar la navegación del navegador como último recurso
      try {
        window.history.back();
      } catch (error) {
        console.error("Failed to navigate back:", error);
        // Si todo falla, recargar la página
        window.location.reload();
      }
    }
  };

  // Toggle favorite status
  const toggleFavorite = async () => {
    if (!userLoggedIn) {
      alert("Debes iniciar sesión para añadir a favoritos");
      return;
    }
    
    if (!formattedProfileData) return;
    
    try {
      setLoading(true);
      const action = isFavorite ? 'remove' : 'add';
      const response = await axios.post(`${API_BASE_URL}/profiles/favorite`, {
        profileId: formattedProfileData.id,
        action
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data && response.data.success) {
        setIsFavorite(!isFavorite);
      }
    } catch (err) {
      console.error("Error toggling favorite:", err);
      alert("Ocurrió un error. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // Start chat with profile
  const startChat = async () => {
    if (!userLoggedIn) {
      alert("Debes iniciar sesión para chatear");
      return;
    }
    
    if (!formattedProfileData) return;
    
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/conversations`, {
        profileId: formattedProfileData.id
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data && response.data.success) {
        alert(`Chat iniciado con ${formattedProfileData.nombre}`);
        // Navigate to chat
        // setMenu('chat', { conversationId: response.data.data.id });
      }
    } catch (err) {
      console.error("Error starting chat:", err);
      alert("No se pudo iniciar el chat. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  // Si no hay datos formateados del perfil, mostrar pantalla de carga con botón de regreso
  if (!formattedProfileData) {
    return (
      <div className="perfil-container">
        {/* Siempre mostrar el botón de regreso incluso durante la carga */}
        <div className="fixed-back-button-container">
          <button className="fixed-back-button" onClick={forceBack}>
            <FaArrowLeft /> Volver a la página principal
          </button>
        </div>
        <div className="loading-indicator">Cargando perfil...</div>
      </div>
    );
  }

  // Formatear el número de teléfono para el enlace de WhatsApp
  const whatsappNumber = formattedProfileData.telefono ? formattedProfileData.telefono.replace(/\D/g, '') : '';
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  const handlePhotoClick = (index) => {
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };

  const handleClosePhotoModal = () => {
    setShowPhotoModal(false);
  };

  const navigatePhoto = (direction) => {
    const totalPhotos = formattedProfileData.fotos.length;
    if (direction === 'next') {
      setSelectedPhotoIndex((selectedPhotoIndex + 1) % totalPhotos);
    } else {
      setSelectedPhotoIndex((selectedPhotoIndex - 1 + totalPhotos) % totalPhotos);
    }
  };

  return (
    <div className="perfil-container">
      {/* Fixed position back button */}
      <div className="fixed-back-button-container">
        <button className="fixed-back-button" onClick={forceBack}>
          <FaArrowLeft /> Volver
        </button>
      </div>
      
      {/* Photo Modal */}
      {showPhotoModal && (
        <div className="photo-modal-overlay" onClick={handleClosePhotoModal}>
          <div className="photo-modal-content" onClick={e => e.stopPropagation()}>
            <button className="photo-modal-close" onClick={handleClosePhotoModal}>
              <FaTimes />
            </button>
            
            <div className="photo-modal-nav">
              <button 
                className="photo-modal-nav-btn prev" 
                onClick={() => navigatePhoto('prev')}
              >
                <FaChevronLeft />
              </button>
              
              <div className="photo-modal-image-container">
                <img 
                  src={formattedProfileData.fotos[selectedPhotoIndex].url} 
                  alt={`Foto ${selectedPhotoIndex + 1}`} 
                  className="photo-modal-image"
                  loading="lazy"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = 'https://via.placeholder.com/800x600?text=Imagen+No+Disponible';
                  }}
                />
              </div>
              
              <button 
                className="photo-modal-nav-btn next" 
                onClick={() => navigatePhoto('next')}
              >
                <FaChevronRight />
              </button>
            </div>
            
            <div className="photo-modal-info">
              <span className="photo-count">
                {selectedPhotoIndex + 1} / {formattedProfileData.fotos.length}
              </span>
              {formattedProfileData.fotos[selectedPhotoIndex].descripcion && (
                <p className="photo-description">
                  {formattedProfileData.fotos[selectedPhotoIndex].descripcion}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <div className="perfil-content">
        {/* Profile Header - Stats Bar */}
        <div className="perfil-stats-bar">
          <div className="profile-stat">
            <FaEye className="stat-icon" />
            <span className="stat-count">{formattedProfileData.totalViews}</span>
            <span className="stat-label">Visitas</span>
          </div>
          <div className="profile-stat">
            <FaHeart className="stat-icon" />
            <span className="stat-count">{formattedProfileData.totalFavorites}</span>
            <span className="stat-label">Favoritos</span>
          </div>
          <div className="profile-stat">
            <FaStar className="stat-icon" />
            <span className="stat-count">{formattedProfileData.scoreActividad}</span>
            <span className="stat-label">Actividad</span>
          </div>
        </div>
      
        {/* Profile Header Card */}
        <div className="perfil-header-card">
          <div className="perfil-header-top">
            <div className="perfil-foto-container">
              <img 
                src={formattedProfileData.fotoPerfil} 
                alt={formattedProfileData.nombre} 
                className="perfil-foto"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = 'https://via.placeholder.com/150x150?text=Sin+Foto';
                }}
              />
              {formattedProfileData.verificado && (
                <div className="verification-badge">
                  <FaCheckCircle />
                </div>
              )}
            </div>
            
            <div className="perfil-header-info">
              <div className="perfil-name-verification">
                <h1>{formattedProfileData.nombre}</h1>
                <div className="perfil-age-gender">
                  <span>{formattedProfileData.edad} años</span>
                  <span className="gender-separator">•</span>
                  <span>{formattedProfileData.genero}</span>
                </div>
              </div>
              
              <div className="perfil-location">
                <FaMapMarkerAlt className="location-icon" />
                <span>{formattedProfileData.ubicacion}</span>
              </div>
              
              <div className="perfil-status-badges">
                {formattedProfileData.verificado && (
                  <span className="perfil-badge verified">
                    <FaCheckCircle /> Perfil verificado
                  </span>
                )}
                {formattedProfileData.estaDisponible && (
                  <span className="perfil-badge disponible">
                    <FaCheckCircle /> Disponible ahora
                  </span>
                )}
                <span className="perfil-badge price">
                  {formattedProfileData.tarifaBase}
                </span>
              </div>
              
              <div className="perfil-contact-buttons">
                <a
                  href={whatsappLink}
                  className="btn-contact whatsapp"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onContactClick && onContactClick('whatsapp')}
                >
                  <FaWhatsapp /> WhatsApp
                </a>
                
                <button 
                  className="btn-contact chat"
                  onClick={startChat}
                  disabled={loading || !userLoggedIn}
                >
                  <FaComments /> Chatear
                </button>
                
                <button 
                  className="btn-contact favorite"
                  onClick={toggleFavorite}
                  disabled={loading}
                >
                  {isFavorite ? <FaHeart /> : <FaRegHeart />}
                  {isFavorite ? 'Favorito' : 'Añadir'}
                </button>
                
                {formattedProfileData.redes?.instagram && (
                  <a
                    href={`https://instagram.com/${formattedProfileData.redes.instagram}`}
                    className="btn-contact instagram"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaInstagram /> Instagram
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Content Tabs */}
        <div className="perfil-tabs">
          <button 
            className={`perfil-tab ${openSection === 'fotos' ? 'active' : ''}`}
            onClick={() => setOpenSection('fotos')}
          >
            Fotos ({formattedProfileData.fotos.length})
          </button>
          <button 
            className={`perfil-tab ${openSection === 'servicios' ? 'active' : ''}`}
            onClick={() => setOpenSection('servicios')}
          >
            Servicios
          </button>
          <button 
            className={`perfil-tab ${openSection === 'info' ? 'active' : ''}`}
            onClick={() => setOpenSection('info')}
          >
            Información
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="perfil-tab-content">
          {/* Photos Tab */}
          {openSection === 'fotos' && (
            <div className="perfil-gallery">
              {formattedProfileData.fotos.length > 0 ? (
                formattedProfileData.fotos.map((foto, index) => (
                  <div 
                    className={`gallery-item ${foto.esPrincipal ? 'main-photo' : ''}`} 
                    key={foto.id || index} 
                    onClick={() => handlePhotoClick(index)}
                  >
                    <img 
                      src={foto.url} 
                      alt={`Foto ${index + 1}`} 
                      loading="lazy"
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = 'https://via.placeholder.com/300x300?text=Imagen+No+Disponible';
                      }}
                    />
                    {foto.esPrincipal && <span className="main-photo-badge">Principal</span>}
                  </div>
                ))
              ) : (
                <p className="no-photos-message">No hay fotos disponibles</p>
              )}
            </div>
          )}
          
          {/* Services Tab */}
          {openSection === 'servicios' && (
            <div className="perfil-servicios-tab">
              <div className="perfil-description">
                <h3>Descripción</h3>
                <p>{formattedProfileData.descripcion}</p>
              </div>
              
              {/* Servicios */}
              {formattedProfileData.servicios.length > 0 && (
                <div className="perfil-servicios-section">
                  <h3>Servicios ofrecidos</h3>
                  <div className="service-tags">
                    {formattedProfileData.servicios.map((servicio, index) => (
                      <span key={index} className="service-tag">{servicio}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Categorías */}
              {formattedProfileData.categorias.length > 0 && (
                <div className="perfil-categorias-section">
                  <h3>Categorías</h3>
                  <div className="service-tags">
                    {formattedProfileData.categorias.map((categoria, index) => (
                      <span key={index} className="category-tag">{categoria}</span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Tarifas */}
              <div className="perfil-tarifas-section">
                <h3>Tarifas</h3>
                <div className="tarifas-grid">
                  <div className="tarifa-item main-tarifa">
                    <span className="tarifa-label">Tarifa base</span>
                    <span className="tarifa-value">
                      {formattedProfileData.tarifasDetalladas.base} {formattedProfileData.tarifasDetalladas.moneda}
                    </span>
                  </div>
                  
                  {formattedProfileData.tarifasDetalladas.hora && (
                    <div className="tarifa-item">
                      <span className="tarifa-label">Hora</span>
                      <span className="tarifa-value">
                        {formattedProfileData.tarifasDetalladas.hora} {formattedProfileData.tarifasDetalladas.moneda}
                      </span>
                    </div>
                  )}
                  
                  {formattedProfileData.tarifasDetalladas.adicional && (
                    <div className="tarifa-item">
                      <span className="tarifa-label">Hora adicional</span>
                      <span className="tarifa-value">
                        {formattedProfileData.tarifasDetalladas.adicional} {formattedProfileData.tarifasDetalladas.moneda}
                      </span>
                    </div>
                  )}
                  
                  {formattedProfileData.tarifasDetalladas.noche && (
                    <div className="tarifa-item">
                      <span className="tarifa-label">Noche completa</span>
                      <span className="tarifa-value">
                        {formattedProfileData.tarifasDetalladas.noche} {formattedProfileData.tarifasDetalladas.moneda}
                      </span>
                    </div>
                  )}
                  
                  {formattedProfileData.tarifasDetalladas.fin && (
                    <div className="tarifa-item">
                      <span className="tarifa-label">Fin de semana</span>
                      <span className="tarifa-value">
                        {formattedProfileData.tarifasDetalladas.fin} {formattedProfileData.tarifasDetalladas.moneda}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {/* Info Tab */}
          {openSection === 'info' && (
            <div className="perfil-info-tab">
              <div className="info-section">
                <h3>Características</h3>
                <div className="info-grid">
                  {formattedProfileData.altura !== "No especificado" && (
                    <div className="info-item">
                      <span className="info-label">Altura:</span>
                      <span className="info-value">{formattedProfileData.altura} cm</span>
                    </div>
                  )}
                  
                  {formattedProfileData.peso !== "No especificado" && (
                    <div className="info-item">
                      <span className="info-label">Peso:</span>
                      <span className="info-value">{formattedProfileData.peso} kg</span>
                    </div>
                  )}
                  
                  {formattedProfileData.medidas !== "No especificado" && (
                    <div className="info-item">
                      <span className="info-label">Medidas:</span>
                      <span className="info-value">{formattedProfileData.medidas}</span>
                    </div>
                  )}
                  
                  {formattedProfileData.colorOjos !== "No especificado" && (
                    <div className="info-item">
                      <span className="info-label">Color de ojos:</span>
                      <span className="info-value">{formattedProfileData.colorOjos}</span>
                    </div>
                  )}
                  
                  {formattedProfileData.colorPelo !== "No especificado" && (
                    <div className="info-item">
                      <span className="info-label">Color de pelo:</span>
                      <span className="info-value">{formattedProfileData.colorPelo}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="info-section">
                <h3>Disponibilidad</h3>
                <p className="disponibilidad-text">{formattedProfileData.disponibilidad}</p>
              </div>
              
              <div className="info-section">
                <h3>Idiomas</h3>
                <div className="idiomas-container">
                  {formattedProfileData.idiomas.map((idioma, index) => (
                    <span key={index} className="idioma-tag">
                      <FaGlobe className="idioma-icon" /> {idioma}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="info-section verification-section">
                <h3>Verificación</h3>
                <div className="verification-status">
                  <div className={`verification-indicator ${formattedProfileData.verificado ? 'verified' : 'not-verified'}`}>
                    {formattedProfileData.verificado 
                      ? <><FaCheckCircle /> Verificado</>
                      : <><FaTimes /> No verificado</>
                    }
                  </div>
                  <p className="verification-note">
                    {formattedProfileData.verificado 
                      ? `Verificado por ${formattedProfileData.agenciaVerificadora}`
                      : "Este perfil aún no está verificado"
                    }
                  </p>
                </div>
              </div>
              
              <div className="info-section activity-section">
                <h3>Actividad</h3>
                <div className="activity-info">
                  <div className="activity-item">
                    <span className="activity-label">Última actividad:</span>
                    <span className="activity-value">{formattedProfileData.lastActivity}</span>
                  </div>
                  <div className="activity-item">
                    <span className="activity-label">Miembro desde:</span>
                    <span className="activity-value">{formattedProfileData.fechaRegistro}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Fixed Contact Bar */}
        <div className="fixed-contact-bar">
          <a
            href={whatsappLink}
            className="contact-bar-btn whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => onContactClick && onContactClick('whatsapp')}
          >
            <FaWhatsapp /> WhatsApp
          </a>
          
          <button 
            className="contact-bar-btn chat"
            onClick={startChat}
            disabled={loading || !userLoggedIn}
          >
            <FaComments /> Chatear en TeloFundi
          </button>
        </div>
      </div>
    </div>
  );
};

export default Perfil;