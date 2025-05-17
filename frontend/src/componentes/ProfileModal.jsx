// src/componentes/ProfileModal.jsx
import React, { useState, useEffect } from 'react';
import { FaPhone, FaWhatsapp, FaEnvelope, FaHeart, FaRegHeart, FaMapMarkerAlt, FaCheck, FaTimes, FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import '../estilos/ProfileModal.css';
import '../estilos/Global.css';

const ProfileModal = ({ profile, onClose, baseUrl, userLoggedIn, onFavoriteToggle, appConfig }) => {
  const [selectedImage, setSelectedImage] = useState(0);
  const [loadingContact, setLoadingContact] = useState(false);
  const [contactSuccess, setContactSuccess] = useState(false);
  const [contactError, setContactError] = useState(null);
  const [contactMethod, setContactMethod] = useState('whatsapp');
  
  // Usar la configuración de la app si está disponible
  const API_BASE_URL = appConfig?.API_BASE_URL || baseUrl;
  
  // Procesar las imágenes
  const images = profile.images || [];
  
  // Asegurarse de que las URLs de las imágenes sean absolutas
  const processImageUrl = (url) => {
    if (!url) return `${API_BASE_URL}/images/publicacion.jpg`;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };
  
  // Obtener la lista de imágenes procesadas
  const processedImages = images.map(img => ({
    ...img,
    imageUrl: processImageUrl(img.imageUrl),
    thumbnailUrl: processImageUrl(img.thumbnailUrl),
    mediumUrl: processImageUrl(img.mediumUrl || img.imageUrl),
  }));
  
  // Si no hay imágenes, agregar una imagen por defecto
  if (processedImages.length === 0) {
    processedImages.push({
      id: 'default',
      imageUrl: `${API_BASE_URL}/images/publicacion.jpg`,
      thumbnailUrl: `${API_BASE_URL}/images/publicacion.jpg`,
      mediumUrl: `${API_BASE_URL}/images/publicacion.jpg`,
      isMain: true
    });
  }
  
  // Función para manejar el cambio de imagen seleccionada
  const handleImageChange = (index) => {
    setSelectedImage(index);
  };
  
  // Función para navegar a la imagen siguiente
  const handleNextImage = (e) => {
    e.stopPropagation();
    setSelectedImage((prev) => (prev + 1) % processedImages.length);
  };
  
  // Función para navegar a la imagen anterior
  const handlePrevImage = (e) => {
    e.stopPropagation();
    setSelectedImage((prev) => (prev - 1 + processedImages.length) % processedImages.length);
  };
  
  // Función para registrar un contacto
  const handleContact = async (e) => {
    e.preventDefault();
    
    // Verificar si el usuario está logueado
    if (!userLoggedIn) {
      setContactError('Debes iniciar sesión para contactar');
      return;
    }
    
    try {
      setLoadingContact(true);
      setContactError(null);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId: profile.id,
          contactMethod,
          contactData: profile.contactMethods?.[contactMethod] || '',
          notes: 'Contacto desde la plataforma'
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al registrar contacto');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setContactSuccess(true);
      } else {
        throw new Error(data.message || 'Error al registrar contacto');
      }
    } catch (err) {
      console.error('Error al contactar:', err);
      setContactError(err.message);
    } finally {
      setLoadingContact(false);
    }
  };
  
  // Cerrar modal al presionar ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleEsc);
    
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  // Prevenir scroll del body cuando el modal está abierto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  
  return (
    <div className="profile-modal-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-modal" onClick={onClose}>
          <FaTimes />
        </button>
        
        <div className="profile-modal-content">
          {/* Galería de imágenes */}
          <div className="profile-gallery">
            <div className="main-image-container">
              <img 
                src={processedImages[selectedImage]?.mediumUrl || processedImages[selectedImage]?.imageUrl} 
                alt={profile.displayName} 
                className="main-image"
                onError={(e) => {
                  console.log("Error cargando imagen modal, usando imagen por defecto");
                  // Si la imagen falla, usar imagen por defecto
                  e.target.onerror = null; // Prevenir bucle infinito
                  e.target.src = `${baseUrl}/images/publicacion.jpg`;
                  
                  // Si también falla la imagen por defecto, usar una base64 mínima
                  setTimeout(() => {
                    if (!e.target.complete || e.target.naturalHeight === 0) {
                      e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
                    }
                  }, 1000);
                }}
                crossOrigin="anonymous"
              />
              
              {processedImages.length > 1 && (
                <>
                  <button className="gallery-nav prev" onClick={handlePrevImage}>
                    <FaChevronLeft />
                  </button>
                  <button className="gallery-nav next" onClick={handleNextImage}>
                    <FaChevronRight />
                  </button>
                </>
              )}
              
              {profile.isFeatured && (
                <span className="modal-featured-badge">Premium</span>
              )}
              
              {profile.verificationStatus === 'verificado' && (
                <span className="modal-verified-badge" title="Perfil verificado">
                  <FaCheck />
                </span>
              )}
              
              <button 
                className="modal-favorite-button"
                onClick={onFavoriteToggle}
                title={profile.isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
              >
                {profile.isFavorite ? <FaHeart /> : <FaRegHeart />}
              </button>
            </div>
            
            {processedImages.length > 1 && (
              <div className="thumbnail-gallery">
                {processedImages.map((img, index) => (
                  <div 
                    key={img.id || index}
                    className={`thumbnail-container ${selectedImage === index ? 'active' : ''}`}
                    onClick={() => handleImageChange(index)}
                  >
                    <img 
                      src={img.thumbnailUrl || img.imageUrl} 
                      alt={`Foto ${index + 1}`}
                      className="thumbnail-image"
                      onError={(e) => {
                        // Si la imagen falla, usar imagen por defecto
                        e.target.onerror = null; // Prevenir bucle infinito
                        e.target.src = `${baseUrl}/images/publicacion.jpg`;
                        
                        // Si también falla la imagen por defecto, usar una base64 mínima
                        setTimeout(() => {
                          if (!e.target.complete || e.target.naturalHeight === 0) {
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
                          }
                        }, 1000);
                      }}
                      crossOrigin="anonymous"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Información del perfil */}
          <div className="profile-details-container">
            <div className="profile-header">
              <h2 className="profile-title">{profile.displayName}</h2>
              
              {profile.age && (
                <span className="modal-profile-age">{profile.age} años</span>
              )}
            </div>
            
            {profile.location && (
              <div className="modal-profile-location">
                <FaMapMarkerAlt />
                <span>
                  {typeof profile.location === 'string' 
                    ? profile.location 
                    : profile.location.city || 'Sin ubicación'}
                </span>
              </div>
            )}
            
            {profile.shortDescription && (
              <p className="modal-profile-short-description">{profile.shortDescription}</p>
            )}
            
            {/* Precios */}
            <div className="modal-profile-prices">
              <h3>Precios</h3>
              <div className="prices-grid">
                {profile.priceHour && (
                  <div className="price-item">
                    <span className="price-label">1 hora:</span>
                    <span className="price-value">
                      {profile.priceHour} {profile.currency || 'USD'}
                    </span>
                  </div>
                )}
                
                {profile.priceAdditionalHour && (
                  <div className="price-item">
                    <span className="price-label">Hora adicional:</span>
                    <span className="price-value">
                      {profile.priceAdditionalHour} {profile.currency || 'USD'}
                    </span>
                  </div>
                )}
                
                {profile.priceOvernight && (
                  <div className="price-item">
                    <span className="price-label">Toda la noche:</span>
                    <span className="price-value">
                      {profile.priceOvernight} {profile.currency || 'USD'}
                    </span>
                  </div>
                )}
                
                {profile.priceWeekend && (
                  <div className="price-item">
                    <span className="price-label">Fin de semana:</span>
                    <span className="price-value">
                      {profile.priceWeekend} {profile.currency || 'USD'}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Características */}
            <div className="modal-profile-features">
              <div className="features-grid">
                {profile.height && (
                  <div className="feature-item">
                    <span className="feature-label">Altura:</span>
                    <span className="feature-value">{profile.height} cm</span>
                  </div>
                )}
                
                {profile.weight && (
                  <div className="feature-item">
                    <span className="feature-label">Peso:</span>
                    <span className="feature-value">{profile.weight} kg</span>
                  </div>
                )}
                
                {profile.eyeColor && (
                  <div className="feature-item">
                    <span className="feature-label">Ojos:</span>
                    <span className="feature-value">{profile.eyeColor}</span>
                  </div>
                )}
                
                {profile.hairColor && (
                  <div className="feature-item">
                    <span className="feature-label">Cabello:</span>
                    <span className="feature-value">{profile.hairColor}</span>
                  </div>
                )}
                
                {profile.nationality && (
                  <div className="feature-item">
                    <span className="feature-label">Nacionalidad:</span>
                    <span className="feature-value">{profile.nationality}</span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Servicios */}
            {profile.services && profile.services.length > 0 && (
              <div className="modal-profile-services">
                <h3>Servicios</h3>
                <div className="services-list">
                  {profile.services.map((service, index) => (
                    <span key={index} className="service-tag">{service}</span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Descripción completa */}
            {profile.description && (
              <div className="modal-profile-description">
                <h3>Sobre mí</h3>
                <p>{profile.description}</p>
              </div>
            )}
            
            {/* Información de contacto */}
            <div className="modal-profile-contact">
              <h3>Contactar</h3>
              
              {contactSuccess ? (
                <div className="contact-success">
                  ¡Solicitud de contacto enviada con éxito! 
                  Te contactaremos pronto con la información.
                </div>
              ) : (
                <form onSubmit={handleContact}>
                  <div className="contact-options">
                    <div className="contact-method">
                      <label>
                        <input 
                          type="radio" 
                          name="contactMethod" 
                          value="whatsapp"
                          checked={contactMethod === 'whatsapp'}
                          onChange={() => setContactMethod('whatsapp')}
                        />
                        <span><FaWhatsapp /> WhatsApp</span>
                      </label>
                    </div>
                    
                    <div className="contact-method">
                      <label>
                        <input 
                          type="radio" 
                          name="contactMethod" 
                          value="telefono"
                          checked={contactMethod === 'telefono'}
                          onChange={() => setContactMethod('telefono')}
                        />
                        <span><FaPhone /> Teléfono</span>
                      </label>
                    </div>
                    
                    <div className="contact-method">
                      <label>
                        <input 
                          type="radio" 
                          name="contactMethod" 
                          value="email"
                          checked={contactMethod === 'email'}
                          onChange={() => setContactMethod('email')}
                        />
                        <span><FaEnvelope /> Email</span>
                      </label>
                    </div>
                  </div>
                  
                  {contactError && (
                    <div className="contact-error">
                      {contactError}
                    </div>
                  )}
                  
                  <button 
                    type="submit"
                    className="contact-button"
                    disabled={loadingContact || !userLoggedIn}
                  >
                    {loadingContact ? 'Enviando...' : 'Solicitar Contacto'}
                  </button>
                  
                  {!userLoggedIn && (
                    <div className="login-prompt">
                      Debes <a href="#" onClick={(e) => {e.preventDefault(); onClose(); /*aquí iría navegación a login*/}}>iniciar sesión</a> para contactar
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;