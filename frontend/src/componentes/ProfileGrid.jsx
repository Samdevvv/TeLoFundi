// src/componentes/ProfileGrid.jsx - Estilo oscuro con Font Awesome icons
import React, { useState, useEffect } from 'react';
import '../estilos/ProfileGrid.css';
import ProfileModal from './ProfileModal';
import '../estilos/Global.css';


const ProfileGrid = ({ setMenu, userLoggedIn, appConfig }) => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [filters, setFilters] = useState({
    location: '',
    service: '',
    verified: false,
    priceMin: '',
    priceMax: '',
    gender: '',
    searchQuery: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    totalPages: 0,
  });

  // URL base para las imágenes del backend
  const API_BASE_URL = appConfig?.API_BASE_URL || 'http://localhost:5000';

  // Función para cargar perfiles
  const fetchProfiles = async () => {
    try {
      setLoading(true);
      
      // Construir URL con parámetros de filtro y paginación
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(([_, value]) => value !== '' && value !== false)
        ),
      });
      
      const response = await fetch(`${API_BASE_URL}/api/profiles?${queryParams}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar perfiles');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setProfiles(data.data);
        setPagination({
          ...pagination,
          totalPages: data.meta?.totalPages || 0,
        });
      } else {
        throw new Error(data.message || 'Error al cargar perfiles');
      }
    } catch (err) {
      console.error('Error al cargar perfiles:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar perfiles al montar el componente y cuando cambien los filtros o paginación
  useEffect(() => {
    fetchProfiles();
  }, [pagination.page, filters]);
  
  // Función para manejar cambios en los filtros
  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters({
      ...filters,
      [name]: type === 'checkbox' ? checked : value,
    });
    // Resetear a la primera página cuando cambian los filtros
    setPagination({
      ...pagination,
      page: 1,
    });
  };
  
  // Función para manejar la búsqueda
  const handleSearch = (e) => {
    e.preventDefault();
    fetchProfiles();
  };
  
  // Función para cambiar de página
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination({
        ...pagination,
        page: newPage,
      });
    }
  };
  
  // Función para abrir modal con detalles del perfil
  const handleProfileClick = async (profileId) => {
    try {
      setLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profileId}`);
      
      if (!response.ok) {
        throw new Error('Error al cargar detalles del perfil');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setSelectedProfile(data.data);
        setShowModal(true);
      } else {
        throw new Error(data.message || 'Error al cargar detalles del perfil');
      }
    } catch (err) {
      console.error('Error al cargar detalles del perfil:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Función para cerrar el modal
  const handleCloseModal = () => {
    setShowModal(false);
  };
  
  // Función para manejar el toggle de favoritos
  const handleToggleFavorite = async (profileId, e) => {
    e.stopPropagation(); // Evitar que se abra el modal
    
    if (!userLoggedIn) {
      if (setMenu) {
        setMenu('login');
      }
      return;
    }
    
    try {
      // Verificar si el perfil ya está en favoritos
      const profile = profiles.find(p => p.id === profileId);
      const isFavorite = profile.isFavorite;
      
      // Optimistic update
      setProfiles(profiles.map(p => 
        p.id === profileId ? { ...p, isFavorite: !isFavorite } : p
      ));
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId,
          action: isFavorite ? 'remove' : 'add',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar favoritos');
      }
      
      // No es necesario actualizar el estado aquí ya que ya hicimos optimistic update
    } catch (err) {
      console.error('Error al actualizar favoritos:', err);
      // Revertir el cambio optimista en caso de error
      fetchProfiles();
    }
  };
  
  // Función para manejar el contacto por WhatsApp
  const handleWhatsAppContact = (profile, e) => {
    e.stopPropagation(); // Evitar que se abra el modal
    
    if (!userLoggedIn) {
      if (setMenu) {
        setMenu('login');
      }
      return;
    }
    
    // Obtener el número de WhatsApp
    const whatsappNumber = profile.contactMethods?.whatsapp || '';
    
    if (whatsappNumber) {
      // Formatear número para URL de WhatsApp
      const formattedNumber = whatsappNumber.replace(/[^0-9]/g, '');
      const whatsappUrl = `https://wa.me/${formattedNumber}?text=Hola,%20te%20contacto%20desde%20la%20plataforma`;
      
      // Abrir WhatsApp en nueva pestaña
      window.open(whatsappUrl, '_blank');
      
      // Registrar contacto en el backend
      registerContact(profile.id, 'whatsapp');
    } else {
      console.log('No hay número de WhatsApp disponible');
      alert('Este perfil no tiene WhatsApp disponible. Por favor, usa otro método de contacto.');
    }
  };
  
  // Función para registrar contacto en el backend
  const registerContact = async (profileId, method) => {
    try {
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        console.log('No hay sesión activa');
        return;
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId,
          contactMethod: method,
          notes: 'Contacto desde la plataforma'
        }),
      });
      
      if (!response.ok) {
        console.error('Error al registrar contacto');
      }
    } catch (err) {
      console.error('Error al registrar contacto:', err);
    }
  };
  
  // Función para obtener la imagen principal o una imagen por defecto
  const getMainImage = (profile) => {
    try {
      // Si el perfil tiene imágenes, obtener la principal o la primera
      if (profile.images && profile.images.length > 0) {
        const mainImage = profile.images.find(img => img.isMain) || profile.images[0];
        
        // Si hay una imagen thumbnail, usarla, sino usar la imagen completa
        if (mainImage.thumbnailUrl) {
          return mainImage.thumbnailUrl.startsWith('http') 
            ? mainImage.thumbnailUrl 
            : `${API_BASE_URL}${mainImage.thumbnailUrl}`;
        } else if (mainImage.imageUrl) {
          return mainImage.imageUrl.startsWith('http') 
            ? mainImage.imageUrl 
            : `${API_BASE_URL}${mainImage.imageUrl}`;
        }
      }
      
      // Si el usuario tiene imagen de perfil, usarla
      if (profile.user && profile.user.profileImageUrl) {
        return profile.user.profileImageUrl.startsWith('http') 
          ? profile.user.profileImageUrl 
          : `${API_BASE_URL}${profile.user.profileImageUrl}`;
      }
      
      // Imagen por defecto
      return `${API_BASE_URL}/images/publicacion.jpg`;
    } catch (err) {
      console.error("Error obteniendo imagen:", err);
      return `${API_BASE_URL}/images/publicacion.jpg`;
    }
  };
  
  return (
    <div className="dark-container">
      {/* Filtros */}
      <div className="dark-filters">
        <form onSubmit={handleSearch}>
          <div className="filter-row">
            <div className="filter-group">
              <input
                type="text"
                name="searchQuery"
                value={filters.searchQuery}
                onChange={handleFilterChange}
                placeholder="Buscar..."
                className="dark-input"
              />
            </div>
            
            <div className="filter-group">
              <select
                name="location"
                value={filters.location}
                onChange={handleFilterChange}
                className="dark-select"
              >
                <option value="">Todas las ubicaciones</option>
                <option value="Santo Domingo">Santo Domingo</option>
                <option value="Santiago">Santiago</option>
                <option value="Punta Cana">Punta Cana</option>
              </select>
            </div>
            
            <div className="filter-group">
              <select
                name="gender"
                value={filters.gender}
                onChange={handleFilterChange}
                className="dark-select"
              >
                <option value="">Todos los géneros</option>
                <option value="femenino">Femenino</option>
                <option value="masculino">Masculino</option>
                <option value="trans">Trans</option>
              </select>
            </div>
            
            <div className="filter-group price-filter">
              <input
                type="number"
                name="priceMin"
                value={filters.priceMin}
                onChange={handleFilterChange}
                placeholder="Precio min"
                className="dark-input"
              />
              <span>-</span>
              <input
                type="number"
                name="priceMax"
                value={filters.priceMax}
                onChange={handleFilterChange}
                placeholder="Precio max"
                className="dark-input"
              />
            </div>
            
            <div className="filter-group verified-filter">
              <label>
                <input
                  type="checkbox"
                  name="verified"
                  checked={filters.verified}
                  onChange={handleFilterChange}
                />
                Verificados
              </label>
            </div>
            
            <button type="submit" className="dark-button">
              Filtrar
            </button>
          </div>
        </form>
      </div>
      
      {/* Estado de carga */}
      {loading && <div className="dark-loading">Cargando perfiles...</div>}
      
      {/* Mensaje de error */}
      {error && !loading && (
        <div className="dark-error">
          Error: {error}. <button onClick={fetchProfiles}>Intentar de nuevo</button>
        </div>
      )}
      
      {/* Lista de perfiles (horizontal) */}
      {!loading && !error && (
        <>
          <div className="dark-cards-container">
            {profiles.length > 0 ? (
              profiles.map((profile) => (
                <div 
                  key={profile.id} 
                  className="dark-card-horizontal"
                  onClick={() => handleProfileClick(profile.id)}
                >
                  <div className="dark-card-content">
                    {/* Imagen del perfil */}
                    <div className="dark-image-container">
                      <img 
                        src={getMainImage(profile)} 
                        alt={profile.displayName}
                        className="dark-profile-image"
                        onError={(e) => {
                          console.log("Error cargando imagen, usando imagen por defecto");
                          e.target.onerror = null;
                          e.target.src = `${API_BASE_URL}/images/publicacion.jpg`;
                          
                          setTimeout(() => {
                            if (!e.target.complete || e.target.naturalHeight === 0) {
                              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZmZmZiI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
                            }
                          }, 1000);
                        }}
                        crossOrigin="anonymous"
                      />
                      
                      <div className="dark-badges">
                        {profile.verificationStatus === 'verificado' && (
                          <span className="dark-verified-badge" title="Perfil verificado">
                            <i className="fas fa-check"></i>
                          </span>
                        )}
                      </div>
                      
                      <div className="dark-name-age">
                        <h3 className="dark-name">{profile.displayName}</h3>
                        {profile.age && <span className="dark-age">{profile.age}</span>}
                      </div>
                    </div>
                    
                    {/* Información del perfil */}
                    <div className="dark-profile-info">
                      {/* Encabezado */}
                      <div className="dark-profile-header">
                        {/* Precio */}
                        <div className="dark-price">
                          <i className="fas fa-gift dark-price-icon"></i>
                          <span>Desde: {profile.priceHour} {profile.currency || 'USD'}</span>
                        </div>
                        
                        {/* Ubicación */}
                        {profile.location && (
                          <div className="dark-location">
                            <i className="fas fa-map-marker-alt dark-icon"></i>
                            <span>{typeof profile.location === 'string' 
                              ? profile.location 
                              : profile.location.city || 'Sin ubicación'}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Características principales - solo las que vienen del backend */}
                      <div className="dark-main-features">
                        {profile.nationality && (
                          <div className="dark-feature">
                            <i className="fas fa-globe-americas dark-feature-icon"></i>
                            <span>{profile.nationality}</span>
                          </div>
                        )}
                        
                        {profile.height && (
                          <div className="dark-feature">
                            <i className="fas fa-ruler dark-feature-icon"></i>
                            <span>{profile.height} cm</span>
                          </div>
                        )}
                        
                        {profile.weight && (
                          <div className="dark-feature">
                            <i className="fas fa-weight dark-feature-icon"></i>
                            <span>{profile.weight} kg</span>
                          </div>
                        )}
                        
                        {profile.hairColor && (
                          <div className="dark-feature">
                            <i className="fas fa-user dark-feature-icon"></i>
                            <span>Pelo: {profile.hairColor}</span>
                          </div>
                        )}
                        
                        {profile.eyeColor && (
                          <div className="dark-feature">
                            <i className="fas fa-eye dark-feature-icon"></i>
                            <span>Ojos: {profile.eyeColor}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Descripción corta */}
                      {profile.shortDescription && (
                        <div className="dark-description">
                          <h4 className="dark-section-title">
                            <i className="fas fa-quote-left dark-title-icon"></i> Descripción Corta
                          </h4>
                          <p>"{profile.shortDescription}"</p>
                        </div>
                      )}
                      
                      {/* Descripción completa */}
                      {profile.description && (
                        <div className="dark-description">
                          <h4 className="dark-section-title">
                            <i className="fas fa-info-circle dark-title-icon"></i> Descripción
                          </h4>
                          <p>"{profile.description}"</p>
                        </div>
                      )}
                      
                      {/* Servicios */}
                      {profile.services && profile.services.length > 0 && (
                        <div className="dark-services">
                          <h4 className="dark-section-title">
                            <i className="fas fa-fire dark-title-icon"></i> Servicios
                          </h4>
                          <div className="dark-tags">
                            {profile.services.slice(0, 4).map((service, idx) => (
                              <span key={idx} className="dark-tag">{service}</span>
                            ))}
                            {profile.services.length > 4 && (
                              <span className="dark-more-tag">+{profile.services.length - 4}</span>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Botones de acción */}
                      <div className="dark-actions">
                        <button 
                          className={`dark-action-button dark-like ${profile.isFavorite ? 'is-liked' : ''}`}
                          onClick={(e) => handleToggleFavorite(profile.id, e)}
                          title={profile.isFavorite ? "Quitar de favoritos" : "Me gusta"}
                        >
                          <i className={profile.isFavorite ? "fas fa-heart" : "far fa-heart"}></i>
                          <span className="button-text">{profile.isFavorite ? "Favorito" : "Agregar a favoritos"}</span>
                        </button>
                        
                        <button 
                          className="dark-action-button dark-whatsapp"
                          onClick={(e) => handleWhatsAppContact(profile, e)}
                          title="Contactar por WhatsApp"
                        >
                          <i className="fab fa-whatsapp"></i>
                          <span className="button-text">Ir a WhatsApp</span>
                        </button>
                        
                        <button 
                          className="dark-action-button dark-telofundi"
                          onClick={(e) => {e.stopPropagation(); alert('Función de chat por Telo Fundi en desarrollo');}}
                          title="Chat por Telo Fundi"
                        >
                          <i className="fas fa-mobile-alt"></i>
                          <span className="button-text">Chat por TeloFundi</span>
                        </button>
                        
                        <button 
                          className="dark-action-button dark-info"
                          onClick={() => handleProfileClick(profile.id)}
                          title="Ver perfil completo"
                        >
                          <i className="fas fa-eye"></i>
                          <span className="button-text">Ver perfil</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="dark-no-profiles">
                <p>No se encontraron perfiles que coincidan con los filtros.</p>
                <p>Intenta ajustar tus filtros para ver más resultados.</p>
              </div>
            )}
          </div>
          
          {/* Paginación */}
          {profiles.length > 0 && (
            <div className="dark-pagination">
              <button 
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="dark-pagination-button prev"
              >
                <i className="fas fa-chevron-left"></i>
              </button>
              
              <span className="dark-page-info">
                {pagination.page} / {pagination.totalPages}
              </span>
              
              <button 
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.totalPages}
                className="dark-pagination-button next"
              >
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Modal de perfil */}
      {showModal && selectedProfile && (
        <ProfileModal 
          profile={selectedProfile}
          onClose={handleCloseModal}
          baseUrl={API_BASE_URL}
          userLoggedIn={userLoggedIn}
          onFavoriteToggle={(e) => handleToggleFavorite(selectedProfile.id, e)}
          appConfig={appConfig}
        />
      )}
    </div>
  );
};

export default ProfileGrid;