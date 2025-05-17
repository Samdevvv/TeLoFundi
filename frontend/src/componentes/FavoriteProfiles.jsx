// src/componentes/FavoriteProfiles.jsx
import React, { useState, useEffect } from 'react';
import Header from './Header';
import ProfileModal from './ProfileModal';
import { FaHeart, FaMapMarkerAlt, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import '../estilos/FavoriteProfiles.css';

const FavoriteProfiles = ({ setMenu, userLoggedIn, handleLogout, appConfig }) => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  
  // URL base para las imágenes del backend
  const API_BASE_URL = appConfig?.API_BASE_URL || 'http://localhost:5000';
  
  // Función para cargar favoritos
  const fetchFavorites = async () => {
    try {
      setLoading(true);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/favorites`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar favoritos');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setFavorites(data.data.profiles);
      } else {
        throw new Error(data.message || 'Error al cargar favoritos');
      }
    } catch (err) {
      console.error('Error al cargar favoritos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Cargar favoritos al montar el componente
  useEffect(() => {
    // Verificar si el usuario está logueado
    if (!userLoggedIn) {
      setMenu('login');
      return;
    }
    
    fetchFavorites();
  }, [userLoggedIn]);
  
  // Función para manejar el click en un perfil
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
  
  // Función para eliminar un favorito
  const handleRemoveFavorite = async (profileId, e) => {
    e.stopPropagation(); // Evitar que se abra el modal
    
    try {
      // Optimistic update
      setFavorites(favorites.filter(p => p.id !== profileId));
      
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
          action: 'remove',
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar favoritos');
      }
      
      // No es necesario actualizar el estado aquí ya que ya hicimos optimistic update
    } catch (err) {
      console.error('Error al actualizar favoritos:', err);
      // Revertir el cambio optimista en caso de error
      fetchFavorites();
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
    <div className="favorites-page">
      <Header 
        onNavigate={setMenu} 
        userLoggedIn={userLoggedIn} 
        handleLogout={handleLogout} 
      />
      <div className="favorites-content">
        <h1 className="favorites-title">Mis Favoritos</h1>
        
        {/* Estado de carga */}
        {loading && <div className="loading-spinner">Cargando favoritos...</div>}
        
        {/* Mensaje de error */}
        {error && !loading && (
          <div className="error-message">
            Error: {error}. <button onClick={fetchFavorites}>Intentar de nuevo</button>
          </div>
        )}
        
        {/* Mensaje si no hay favoritos */}
        {!loading && !error && favorites.length === 0 && (
          <div className="no-favorites-message">
            <FaExclamationTriangle />
            <p>No tienes perfiles guardados en favoritos.</p>
            <button onClick={() => setMenu('exploreProfiles')} className="explore-button">
              Explorar Perfiles
            </button>
          </div>
        )}
        
        {/* Lista de favoritos */}
        {!loading && !error && favorites.length > 0 && (
          <div className="favorites-grid">
            {favorites.map((profile) => (
              <div 
                key={profile.id} 
                className="favorite-card"
                onClick={() => handleProfileClick(profile.id)}
              >
                <div className="favorite-image-container">
                  <img 
                    src={getMainImage(profile)} 
                    alt={profile.displayName}
                    className="favorite-image"
                    onError={(e) => {
                      console.log("Error cargando imagen, usando imagen por defecto");
                      // Si la imagen falla, usar imagen por defecto
                      e.target.onerror = null; // Prevenir bucle infinito
                      e.target.src = `${API_BASE_URL}/images/publicacion.jpg`;
                      
                      // Si también falla la imagen por defecto, usar una base64 mínima
                      setTimeout(() => {
                        if (!e.target.complete || e.target.naturalHeight === 0) {
                          e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2VlZWVlZSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iIzk5OTk5OSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
                        }
                      }, 1000);
                    }}
                    crossOrigin="anonymous"
                  />
                  
                  {profile.isFeatured && (
                    <span className="featured-badge">Premium</span>
                  )}
                  
                  {profile.verificationStatus === 'verificado' && (
                    <span className="verified-badge" title="Perfil verificado">
                      <FaCheck />
                    </span>
                  )}
                  
                  <button 
                    className="remove-favorite-button"
                    onClick={(e) => handleRemoveFavorite(profile.id, e)}
                    title="Quitar de favoritos"
                  >
                    <FaHeart />
                  </button>
                </div>
                
                <div className="favorite-info">
                  <h3 className="favorite-name">{profile.displayName}</h3>
                  
                  <div className="favorite-details">
                    <span className="favorite-age">{profile.age} años</span>
                    
                    {profile.location && (
                      <span className="favorite-location">
                        <FaMapMarkerAlt />
                        {typeof profile.location === 'string' 
                          ? profile.location 
                          : profile.location.city || 'Sin ubicación'}
                      </span>
                    )}
                  </div>
                  
                  {profile.shortDescription && (
                    <p className="favorite-description">{profile.shortDescription}</p>
                  )}
                  
                  <div className="favorite-price">
                    <span className="price-label">Desde:</span>
                    <span className="price-value">
                      {profile.priceHour} {profile.currency || 'USD'}
                    </span>
                  </div>
                  
                  <button className="view-profile-button">
                    Ver Perfil
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Modal de perfil */}
        {showModal && selectedProfile && (
          <ProfileModal 
            profile={selectedProfile}
            onClose={handleCloseModal}
            baseUrl={API_BASE_URL}
            userLoggedIn={userLoggedIn}
            onFavoriteToggle={(e) => {
              e.stopPropagation();
              handleRemoveFavorite(selectedProfile.id, e);
              setShowModal(false);
            }}
            appConfig={appConfig}
          />
        )}
      </div>
    </div>
  );
};

export default FavoriteProfiles;