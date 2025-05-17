// File: Homepage.jsx (FIXED)
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Header from './Header';
import Perfil from './PerfilAcompañante';
import { 
  FaWhatsapp, FaSearch, FaCheckCircle, FaMapMarkerAlt, 
  FaTimes, FaGlobe, FaCalendarAlt, FaUser, FaComments
} from 'react-icons/fa';

// URL base de la API 
const API_BASE_URL = 'http://localhost:5000/api';

// Imagen codificada en base64 para usar en todo el componente
// Esta es una imagen JPEG pequeña de un placeholder gris
// IMPORTANTE: Las imágenes base64 deben usarse como atributo 'src' directamente, no como URL
const DEFAULT_IMAGE = 'data:image/jpeg;base64,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';

const Homepage = ({ setMenu, userLoggedIn, handleLogout }) => {
  const [showAgeModal, setShowAgeModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [showProfileComponent, setShowProfileComponent] = useState(false);
  const [filters, setFilters] = useState({
    city: '',
    service: '',
    verification: 'todos',
    priceMin: '',
    priceMax: '',
    gender: ''
  });
  const [filteredProfiles, setFilteredProfiles] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalProfiles, setTotalProfiles] = useState(0); 
  const [totalPages, setTotalPages] = useState(1);

  // Debug state changes
  useEffect(() => {
    console.log("Profile component visibility:", showProfileComponent);
    console.log("Selected profile ID:", selectedProfileId);
    console.log("Profile data exists:", !!profileData);
  }, [showProfileComponent, selectedProfileId, profileData]);

  // Age verification modal
  useEffect(() => {
    const ageVerified = localStorage.getItem('ageVerified');
    if (!ageVerified) {
      setShowAgeModal(true);
    }
  }, []);

  useEffect(() => {
    if (showAgeModal || showFiltersModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showAgeModal, showFiltersModal]);

  // Función para convertir el objeto de horario a texto
  const formatAvailabilitySchedule = (schedule) => {
    if (!schedule || typeof schedule !== 'object') {
      return 'No especificado';
    }
    
    // Traducción de días al español
    const daysTranslation = {
      lunes: 'Lun',
      martes: 'Mar',
      miercoles: 'Mié',
      jueves: 'Jue',
      viernes: 'Vie',
      sabado: 'Sáb',
      domingo: 'Dom'
    };
    
    // Filtrar los días disponibles
    const availableDays = Object.keys(schedule)
      .filter(day => schedule[day])
      .map(day => daysTranslation[day] || day);
    
    return availableDays.length > 0 ? availableDays.join(', ') : 'No especificado';
  };

  // Fetch profiles from API with pagination
  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`${API_BASE_URL}/profiles`, {
          params: {
            page: page,
            limit: pageSize,
            location: filters.city || undefined,
            service: filters.service || undefined,
            verified: filters.verification === 'verificados' ? true : undefined,
            priceMin: filters.priceMin || undefined,
            priceMax: filters.priceMax || undefined,
            gender: filters.gender || undefined,
            q: searchQuery || undefined
          },
        });
        
        console.log('API response (Profiles):', response.data);
        
        if (response.data && response.data.success && response.data.data) {
          const fetchedProfiles = response.data.data.map((profile) => {
            // Verificar si tenemos el campo 'images' o 'profileImages'
            const profileImages = Array.isArray(profile.images) 
              ? profile.images 
              : (Array.isArray(profile.profileImages) 
                  ? profile.profileImages 
                  : []);
                  
            console.log(`Profile ${profile.id} images:`, profileImages);
              
            return {
              id: profile.id,
              name: profile.displayName,
              age: profile.age || 'No especificado',
              city: profile.location?.city || 'No especificado',
              country: profile.location?.country || 'No especificado',
              price: profile.priceHour ? Number(profile.priceHour) : 'N/A',
              description: profile.description || profile.shortDescription || 'Sin descripción',
              // IMPORTANTE: ya estamos usando directamente la cadena base64
              image: DEFAULT_IMAGE,
              verified: profile.verificationStatus === 'verificado',
              whatsapp: profile.contactMethods?.whatsapp || '+1-000-000-0000',
              services: Array.isArray(profile.services) ? profile.services : [],
              moneda: profile.currency || 'USD',
              genero: profile.gender || 'No especificado',
              disponible: profile.availabilityStatus === 'disponible',
              // Horario formateado
              horario: formatAvailabilitySchedule(profile.availabilitySchedule),
              idiomas: Array.isArray(profile.languages) 
                ? profile.languages.join(', ') // Convertir array a string
                : typeof profile.languages === 'string' 
                  ? profile.languages 
                  : 'No especificado',
              categorias: profile.profileTags 
                ? profile.profileTags.map(tag => tag.tag?.name || tag) 
                : [],
              rating: 0, // No hay campo equivalente en el schema
              totalViews: profile.totalViews || 0,
              totalFavorites: profile.totalFavorites || 0,
              fotosCount: profileImages.length,
              slug: profile.slug || '',
              lastActivity: profile.lastActivity || null,
              isFeatured: profile.isFeatured || false
            };
          });
          
          setProfiles(fetchedProfiles);
          setFilteredProfiles(fetchedProfiles);
          setTotalProfiles(response.data.meta?.totalItems || fetchedProfiles.length);
          setTotalPages(response.data.meta?.totalPages || 1);
        } else {
          throw new Error('Formato de respuesta inesperado');
        }
      } catch (err) {
        console.error('Error fetching profiles:', err);
        const errorMessage = err.response
          ? `Error ${err.response.status}: ${err.response.data?.message || err.message}`
          : `Error de red: ${err.message}`;
        setError(`No se pudieron cargar los perfiles. ${errorMessage}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfiles();
  }, [page, pageSize, filters, searchQuery]);

  // Debounced search filtering
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProfiles(profiles);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = profiles.filter(profile => 
      profile.name.toLowerCase().includes(query) ||
      profile.description.toLowerCase().includes(query) ||
      profile.city.toLowerCase().includes(query) ||
      profile.country.toLowerCase().includes(query) ||
      profile.services.some(service => service.toLowerCase().includes(query)) ||
      profile.categorias.some(category => category.toLowerCase().includes(query))
    );

    setFilteredProfiles(filtered);
  }, [searchQuery, profiles]);

  // Mejorado: fetch profile details con mejor manejo de errores
  const fetchProfileDetails = async (id) => {
    if (profileLoading) return;
    try {
      setProfileLoading(true);
      setError(null); // Limpiar errores previos
      
      console.log(`Fetching profile details for ID: ${id}`);
      const response = await axios.get(`${API_BASE_URL}/profiles/${id}`);
      
      if (!response.data || !response.data.success) {
        throw new Error('Respuesta vacía o errónea del servidor');
      }
      
      // Establecer datos del perfil
      const profileData = response.data.data;
      console.log("Profile data fetched successfully:", profileData);
      
      // Procesar imágenes del perfil - IMPORTANTE: Usar directamente la cadena base64
      if (profileData.images && Array.isArray(profileData.images)) {
        profileData.images = profileData.images.map(img => ({
          ...img,
          imageUrl: DEFAULT_IMAGE,
          mediumUrl: DEFAULT_IMAGE,
          thumbnailUrl: DEFAULT_IMAGE
        }));
      } else {
        // Si no hay imágenes, crear algunas ficticias
        profileData.images = Array(5).fill(null).map((_, index) => ({
          id: `default-${index}`,
          imageUrl: DEFAULT_IMAGE,
          mediumUrl: DEFAULT_IMAGE,
          thumbnailUrl: DEFAULT_IMAGE,
          isMain: index === 0
        }));
      }
      
      // Asegurarse de que los objetos complejos estén formateados adecuadamente
      if (profileData.availabilitySchedule && typeof profileData.availabilitySchedule === 'object') {
        profileData.formattedSchedule = formatAvailabilitySchedule(profileData.availabilitySchedule);
      }
      
      // Registrar vista - esto puede fallar pero no debería detener el flujo principal
      try {
        await axios.post(`${API_BASE_URL}/profiles/view`, {
          profileId: id,
          sessionId: localStorage.getItem('sessionId') || generateSessionId(),
          deviceType: detectDeviceType(),
          referrer: document.referrer
        });
      } catch (viewError) {
        console.warn("Could not register profile view", viewError);
      }

      // IMPORTANTE: Actualizar los estados en este orden específico
      setProfileData(profileData); 
      setSelectedProfileId(id);
      
      // Mostrar el componente DESPUÉS de que los datos se han establecido
      // Un pequeño retraso asegura que React haya actualizado los estados
      setTimeout(() => {
        setShowProfileComponent(true);
      }, 50);
      
    } catch (err) {
      console.error(`Error fetching profile details for id ${id}:`, err);
      const errorMessage = err.response
        ? `Error ${err.response.status}: ${err.response.data?.message || err.message}`
        : `Error de red: ${err.message}`;
      setError(`No se pudieron cargar los detalles del perfil. ${errorMessage}`);
      
      // Resetear estados en caso de error
      setSelectedProfileId(null);
      setProfileData(null);
      setShowProfileComponent(false);
    } finally {
      setProfileLoading(false);
    }
  };

  // Helper to generate a session ID
  const generateSessionId = () => {
    const sessionId = 'session_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('sessionId', sessionId);
    return sessionId;
  };

  // Helper to detect device type
  const detectDeviceType = () => {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    if (/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream) {
      return 'app_ios';
    }
    if (/android/i.test(userAgent)) {
      return 'app_android';
    }
    return window.innerWidth <= 768 ? 'mobile' : 'desktop';
  };

  // Mejorado: back to home function
  const backToHome = () => {
    console.log("Returning to homepage");
    
    // Primero ocultar el componente para mejor experiencia visual
    setShowProfileComponent(false);
    
    // Usar setTimeout para asegurar que React ha procesado el cambio de estado
    setTimeout(() => {
      setSelectedProfileId(null);
      setProfileData(null);
    }, 100);
  };

  const handleAgeAccept = () => {
    localStorage.setItem('ageVerified', 'true');
    setShowAgeModal(false);
  };

  const handleAgeCancel = () => {
    window.location.href = 'https://google.com';
  };

  const openFiltersModal = () => {
    setShowFiltersModal(true);
  };

  const closeFiltersModal = () => {
    setShowFiltersModal(false);
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const applyFilters = () => {
    setPage(1); // Reset to first page when applying filters
    closeFiltersModal();
  };

  const resetFilters = () => {
    setFilters({
      city: '',
      service: '',
      verification: 'todos',
      priceMin: '',
      priceMax: '',
      gender: ''
    });
    setSearchQuery('');
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    window.scrollTo(0, 0);
  };
  
  // Handler for starting a chat
  const startChat = async (profileId, profileName) => {
    if (!userLoggedIn) {
      // Redirect to login or show login modal
      alert("Debes iniciar sesión para chatear con este perfil");
      // You could store the intended action to continue after login
      localStorage.setItem('pendingChatWithProfile', profileId);
      // setMenu('login');
      return;
    }
    
    try {
      // Check if conversation exists or create one
      const response = await axios.post(`${API_BASE_URL}/conversations`, {
        profileId: profileId
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.data && response.data.success) {
        // Navigate to chat view with this conversation
        alert(`Iniciando chat con ${profileName}`);
        // setMenu('chat', { conversationId: response.data.data.id });
      }
    } catch (err) {
      console.error("Error starting chat:", err);
      alert("No se pudo iniciar el chat. Intenta nuevamente.");
    }
  };

  // Mejorado: Verificación condicional para renderizar el componente de perfil
  if (showProfileComponent && profileData) {
    console.log("Rendering profile component with data:", profileData);
    return (
      <Perfil 
        profileData={profileData} 
        onBackClick={backToHome} 
        onContactClick={(method) => alert(`Contactando por ${method}`)}
        userLoggedIn={userLoggedIn}
      />
    );
  }

  return (
    <div className="page-container">
      {/* Age Verification Modal */}
      {showAgeModal && (
        <div className="age-modal-overlay">
          <div className="age-modal">
            <h3 className="modal-title">¿Eres mayor de 18?</h3>
            <p className="modal-text">Debes tener 18 años o más para entrar.</p>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-primary" onClick={handleAgeAccept}>
                Sí, entrar
              </button>
              <button className="modal-btn modal-btn-secondary" onClick={handleAgeCancel}>
                No, salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <section className="header-section">
        <Header onNavigate={setMenu} userLoggedIn={userLoggedIn} handleLogout={handleLogout} />
      </section>

      {/* Search Section */}
      <section className="search-section">
        <div className="container">
          <div className="search-wrapper">
            <div className="search-box">
              <input
                type="text"
                placeholder="Buscar por nombre, ubicación o servicios..."
                className="search-input"
                value={searchQuery}
                onChange={handleSearchChange}
              />
              <button className="search-button" onClick={openFiltersModal}>
                <FaSearch size={18} />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Filter Modal */}
      {showFiltersModal && (
        <div className="modal-overlay" onClick={closeFiltersModal}>
          <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Búsqueda avanzada</h3>
              <button className="close-modal" onClick={closeFiltersModal}>
                <FaTimes size={24} />
              </button>
            </div>
            <div className="filters-container-modal">
              <div className="filter-group">
                <label>Verificados</label>
                <select 
                  className="filter-select"
                  name="verification"
                  value={filters.verification}
                  onChange={handleFilterChange}
                >
                  <option value="todos">Todos</option>
                  <option value="verificados">Solo verificados</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Ubicación</label>
                <select 
                  className="filter-select"
                  name="city"
                  value={filters.city}
                  onChange={handleFilterChange}
                >
                  <option value="">Todas las ubicaciones</option>
                  <option value="santodomingo">Santo Domingo</option>
                  <option value="santiago">Santiago</option>
                  <option value="puntacana">Punta Cana</option>
                  <option value="laromana">La Romana</option>
                  <option value="puertoplata">Puerto Plata</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Género</label>
                <select 
                  className="filter-select"
                  name="gender"
                  value={filters.gender}
                  onChange={handleFilterChange}
                >
                  <option value="">Todos</option>
                  <option value="femenino">Femenino</option>
                  <option value="masculino">Masculino</option>
                  <option value="transgenero">Transgénero</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
              <div className="filter-group">
                <label>Servicio</label>
                <select 
                  className="filter-select"
                  name="service"
                  value={filters.service}
                  onChange={handleFilterChange}
                >
                  <option value="">Todos los servicios</option>
                  <option value="masajes">Masajes</option>
                  <option value="escorts">Escorts</option>
                  <option value="compania">Compañía</option>
                  <option value="eventos">Eventos</option>
                  <option value="viajes">Viajes</option>
                </select>
              </div>
              <div className="filter-group price-range">
                <label>Rango de precios</label>
                <div className="price-inputs">
                  <input
                    type="number"
                    placeholder="Mínimo"
                    className="price-input"
                    name="priceMin"
                    value={filters.priceMin}
                    onChange={handleFilterChange}
                  />
                  <span>-</span>
                  <input
                    type="number"
                    placeholder="Máximo"
                    className="price-input"
                    name="priceMax"
                    value={filters.priceMax}
                    onChange={handleFilterChange}
                  />
                </div>
              </div>
              <div className="filter-actions">
                <button className="apply-filters" onClick={applyFilters}>
                  Aplicar Filtros
                </button>
                <button className="reset-filters" onClick={resetFilters}>
                  Restablecer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profiles Section */}
      <section className="profiles-section">
        <div className="container">
          {loading && <div className="loading-profiles">Cargando perfiles...</div>}
          {error && <p className="error-message">{error}</p>}
          {!loading && !error && filteredProfiles.length === 0 && (
            <div className="no-profiles-found">
              <h3>No se encontraron perfiles</h3>
              <p>Intenta con otros filtros o vuelve más tarde.</p>
              <button className="reset-search-btn" onClick={resetFilters}>
                Restablecer búsqueda
              </button>
            </div>
          )}
          
          <div className="profiles-grid">
            {filteredProfiles.map((profile) => (
              <div key={profile.id} className="profile-card">
                <div className="profile-image-container">
                  {/* IMPORTANTE: Usar directamente la cadena base64 como src */}
                  <img 
                    src={profile.image} 
                    alt={profile.name} 
                    className="profile-image" 
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    loading="lazy" 
                  />
                  <div className="profile-overlay"></div>
                  {profile.fotosCount > 1 && (
                    <div className="photos-count-badge">
                      {profile.fotosCount} fotos
                    </div>
                  )}
                </div>
                <div className="profile-info">
                  <div className="profile-header">
                    <span className="profile-name">{profile.name}</span>
                    <span className="profile-age">{profile.age}</span>
                  </div>
                  <div className="verification-badges">
                    {profile.verified && (
                      <div className="badge verified">
                        <FaCheckCircle size={12} /> Verificado
                      </div>
                    )}
                    {profile.disponible && (
                      <div className="badge disponible">
                        <FaCheckCircle size={12} /> Disponible
                      </div>
                    )}
                  </div>
                  <div className="profile-details">
                    <div className="profile-location">
                      <FaMapMarkerAlt size={12} />
                      {profile.city}
                    </div>
                    <div className="profile-country">
                      <FaMapMarkerAlt size={12} />
                      {profile.country}
                    </div>
                    <div className="profile-price">
                      {profile.price} {profile.moneda}
                    </div>
                  </div>
                  
                  {/* Additional details section */}
                  <div className="profile-extra-details">
                    <div className="profile-extra-item">
                      <FaUser size={12} />
                      <span>{profile.genero}</span>
                    </div>
                    <div className="profile-extra-item">
                      <FaCalendarAlt size={12} />
                      <span>{profile.horario}</span>
                    </div>
                    <div className="profile-extra-item">
                      <FaGlobe size={12} />
                      <span>{profile.idiomas}</span>
                    </div>
                  </div>
                  
                  <div className="profile-description">{profile.description}</div>
                  
                  <div className="profile-services">
                    {profile.services && profile.services.length > 0 && (
                      <div className="service-group">
                        <h4 className="service-group-title">Servicios:</h4>
                        <div className="service-tags">
                          {profile.services.slice(0, 5).map((service, index) => (
                            <span key={index} className="service-tag">{service}</span>
                          ))}
                          {profile.services.length > 5 && (
                            <span className="service-tag more-tag">+{profile.services.length - 5} más</span>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {profile.categorias && profile.categorias.length > 0 && (
                      <div className="service-group">
                        <h4 className="service-group-title">Categorías:</h4>
                        <div className="service-tags">
                          {profile.categorias.slice(0, 3).map((categoria, index) => (
                            <span key={index} className="service-tag category-tag">{categoria}</span>
                          ))}
                          {profile.categorias.length > 3 && (
                            <span className="service-tag category-tag more-tag">+{profile.categorias.length - 3} más</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="profile-actions">
                    
                     <a  href={`https://wa.me/${profile.whatsapp.replace(/\D/g, '')}`}
                      className="action-btn whatsapp-btn"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FaWhatsapp size={16} /> WhatsApp
                    </a>
                    
                    <button
                      className="action-btn chat-btn"
                      onClick={() => startChat(profile.id, profile.name)}
                    >
                      <FaComments size={16} /> Chatear
                    </button>
                    
                    <button
                      className="action-btn view-profile-btn"
                      onClick={() => fetchProfileDetails(profile.id)}
                      disabled={profileLoading}
                    >
                      {profileLoading && selectedProfileId === profile.id ? 'Cargando...' : 'Ver Perfil'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Pagination */}
          {!loading && !error && filteredProfiles.length > 0 && (
            <div className="pagination">
              <button 
                className="pagination-btn prev" 
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 1}
              >
                Anterior
              </button>
              
              <div className="pagination-info">
                <span>Página {page} de {totalPages}</span>
              </div>
              
              <button 
                className="pagination-btn next" 
                onClick={() => handlePageChange(page + 1)}
                disabled={page === totalPages}
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <nav className="footer-nav">
            <a href="/privacidad" className="footer-link">Privacidad</a>
            <a href="/terminos" className="footer-link">Términos</a>
            <a href="/ayuda" className="footer-link">Ayuda</a>
            <a href="/contacto" className="footer-link">Contacto</a>
          </nav>
          <div className="footer-bottom">
            <p>© 2025 Telo Fundi</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Homepage;