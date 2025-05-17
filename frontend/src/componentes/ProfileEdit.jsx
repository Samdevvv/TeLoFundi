// src/componentes/ProfileEditInsta.jsx
// Versión actualizada - Estilo Instagram moderno con enfoque en galería
import React, { useState, useEffect, useRef } from 'react';
import { 
  FaSave, 
  FaCamera, 
  FaTrash, 
  FaCheck, 
  FaTimes, 
  FaStar,
  FaUser,
  FaMapMarkerAlt,
  FaMoneyBillWave,
  FaImages,
  FaPhoneAlt,
  FaPencilAlt,
  FaHeart,
  FaClock,
  FaInfoCircle,
  FaComment,
  FaArrowLeft
} from 'react-icons/fa';
import '../estilos/ProfileEdit.css';

const ProfileEditInsta = ({ setMenu, appConfig }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTab, setSelectedTab] = useState('images'); // Cambiado a 'images' para priorizar la galería
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const fileInputRef = useRef(null);
  
  // URL base para las imágenes y API del backend
  const API_BASE_URL = appConfig?.API_BASE_URL || 'http://localhost:5000';
  
  // Cargar datos del perfil
  useEffect(() => {
    fetchProfileData();
  }, []);
  
  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      
      if (!user.id) {
        throw new Error('No se encontró información del usuario');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al cargar los datos del perfil');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setProfile(data.data);
        // Asegurarse de que formData tenga la estructura correcta para la edición
        const initialFormData = {
          ...data.data,
          // Asegurar que estos campos estén inicializados correctamente
          location: data.data.location || { city: '' },
          contactMethods: data.data.contactMethods || { 
            telefono: '', 
            whatsapp: '', 
            email: '' 
          },
          services: Array.isArray(data.data.services) ? data.data.services : []
        };
        
        // Eliminar campos que no deberían enviarse en una actualización
        delete initialFormData.id;
        delete initialFormData.user;
        delete initialFormData.agency;
        delete initialFormData.images;
        delete initialFormData.totalViews;
        delete initialFormData.totalContacts;
        delete initialFormData.totalFavorites;
        
        setFormData(initialFormData);
      } else {
        throw new Error(data.message || 'Error al cargar los datos del perfil');
      }
    } catch (err) {
      console.error('Error al cargar perfil:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    // Manejar diferentes tipos de campos
    if (type === 'checkbox') {
      if (name === 'availabilityStatus') {
        // Caso especial para status
        setFormData(prev => ({
          ...prev,
          [name]: checked ? 'disponible' : 'no_disponible'
        }));
      } else {
        // Checkbox normal
        setFormData(prev => ({
          ...prev,
          [name]: checked
        }));
      }
    } else if (name.includes('.')) {
      // Manejar campos anidados (por ejemplo, 'location.city')
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev[parent] || {},
          [child]: value
        }
      }));
    } else if (name === 'services' && type !== 'checkbox') {
      // Convertir la cadena separada por comas en un array
      const servicesArray = value.split(',').map(item => item.trim()).filter(item => item);
      setFormData(prev => ({
        ...prev,
        [name]: servicesArray
      }));
    } else if (name === 'travelDestinations' && type !== 'checkbox') {
      // Convertir la cadena separada por comas en un array
      const destinationsArray = value.split(',').map(item => item.trim()).filter(item => item);
      setFormData(prev => ({
        ...prev,
        [name]: destinationsArray
      }));
    } else {
      // Campos normales
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };
  
  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      // Preparar los datos para enviar al servidor
      // Crear una copia para no modificar el estado original
      const dataToSend = { ...formData };
      
      // Eliminar campos que no deben enviarse o que causan problemas
      delete dataToSend.id;         
      delete dataToSend.user;       
      delete dataToSend.agency;     
      delete dataToSend.images;     
      delete dataToSend.totalViews;
      delete dataToSend.totalContacts;
      delete dataToSend.totalFavorites;
      
      // Asegurarse de que services sea un array
      if (typeof dataToSend.services === 'string') {
        dataToSend.services = dataToSend.services.split(',').map(item => item.trim()).filter(item => item);
      }
      
      // Asegurarse de que travelDestinations sea un array si existe
      if (dataToSend.travelDestinations && typeof dataToSend.travelDestinations === 'string') {
        dataToSend.travelDestinations = dataToSend.travelDestinations.split(',').map(item => item.trim()).filter(item => item);
      }
      
      // Convertir los campos numéricos a números
      if (dataToSend.priceHour) dataToSend.priceHour = parseFloat(dataToSend.priceHour);
      if (dataToSend.priceAdditionalHour) dataToSend.priceAdditionalHour = parseFloat(dataToSend.priceAdditionalHour);
      if (dataToSend.priceOvernight) dataToSend.priceOvernight = parseFloat(dataToSend.priceOvernight);
      if (dataToSend.priceWeekend) dataToSend.priceWeekend = parseFloat(dataToSend.priceWeekend);
      if (dataToSend.priceTravel) dataToSend.priceTravel = parseFloat(dataToSend.priceTravel);
      if (dataToSend.height) dataToSend.height = parseInt(dataToSend.height, 10);
      if (dataToSend.weight) dataToSend.weight = parseInt(dataToSend.weight, 10);
      if (dataToSend.age) dataToSend.age = parseInt(dataToSend.age, 10);
      
      // Manejar URLs de blob (imágenes seleccionadas localmente)
      const checkForBlobUrls = (obj) => {
        if (!obj) return;
        
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string' && obj[key].startsWith('blob:')) {
            // Si es un blob, no enviamos este campo
            delete obj[key];
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            // Recursivamente verificar objetos anidados
            checkForBlobUrls(obj[key]);
          }
        });
      };
      
      checkForBlobUrls(dataToSend);
      
      // Realizar la petición
      const response = await fetch(`${API_BASE_URL}/api/profiles`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSend)
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setProfile(data.data);
        setSuccessMessage('¡Perfil actualizado!');
        setEditMode(false);
        
        // Actualizar el perfil completo para mostrar los cambios
        fetchProfileData();
        
        // Ocultar mensaje de éxito después de 3 segundos
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error(data.message || 'Error al guardar los cambios');
      }
    } catch (err) {
      console.error('Error al guardar perfil:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelEdit = () => {
    // Recargar los datos del perfil para descartar cambios
    fetchProfileData();
    setEditMode(false);
  };
  
  const handleUploadButtonClick = () => {
    fileInputRef.current.click();
  };
  
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      setUploadingImage(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      // Verificar si ya hay 5 imágenes (máximo permitido)
      if (profile.images && profile.images.length >= 5) {
        throw new Error('Ya tienes el máximo de 5 imágenes permitidas. Elimina una antes de subir más.');
      }
      
      // Crear un objeto FormData para subir la imagen
      const formData = new FormData();
      formData.append('image', file);
      
      let imageUrl, thumbnailUrl, mediumUrl;
      
      // Intentar subir usando el endpoint de archivo
      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/api/uploads/image`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Error al subir la imagen');
        }
        
        const uploadData = await uploadResponse.json();
        
        if (uploadData.success) {
          // Usar las URLs proporcionadas por el servidor
          imageUrl = uploadData.data.imageUrl;
          thumbnailUrl = uploadData.data.thumbnailUrl || uploadData.data.imageUrl;
          mediumUrl = uploadData.data.mediumUrl || uploadData.data.imageUrl;
        } else {
          throw new Error(uploadData.message || 'Error al subir imagen');
        }
      } catch (uploadError) {
        console.warn('Error al usar el endpoint de imagen:', uploadError);
        
        // Alternativa: usar data URL si el endpoint de archivo no funciona
        console.log('Probando con data URL...');
        
        // Crear un objeto FileReader para convertir la imagen a data URL
        const reader = new FileReader();
        
        // Esperar a que se cargue la imagen
        const imageLoaded = new Promise((resolve, reject) => {
          reader.onload = resolve;
          reader.onerror = reject;
        });
        
        // Leer la imagen como URL de datos
        reader.readAsDataURL(file);
        
        // Esperar a que la imagen se cargue
        await imageLoaded;
        
        // Obtener la URL de datos de la imagen
        const dataUrl = reader.result;
        
        // Subir usando el endpoint de data URL
        const uploadResponse = await fetch(`${API_BASE_URL}/api/uploads/data-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dataUrl })
        });
        
        if (!uploadResponse.ok) {
          throw new Error('Error al subir la imagen mediante data URL');
        }
        
        const uploadData = await uploadResponse.json();
        
        if (!uploadData.success) {
          throw new Error(uploadData.message || 'Error al subir imagen mediante data URL');
        }
        
        // Usar las URLs proporcionadas por el servidor
        imageUrl = uploadData.data.imageUrl;
        thumbnailUrl = uploadData.data.thumbnailUrl || uploadData.data.imageUrl;
        mediumUrl = uploadData.data.mediumUrl || uploadData.data.imageUrl;
      }
      
      // Registrar la imagen en el perfil
      const imageData = {
        imageUrl,
        thumbnailUrl,
        mediumUrl,
        isMain: !profile.images || profile.images.length === 0,
        description: `Imagen subida el ${new Date().toLocaleString()}`,
        orderPosition: profile.images ? profile.images.length : 0,
        isPrivate: false // No usamos este valor, pero se mantiene por compatibilidad
      };
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(imageData)
      });
      
      if (!response.ok) {
        throw new Error('Error al registrar la imagen');
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Actualizar el perfil con la nueva imagen
        fetchProfileData();
        setSuccessMessage('¡Imagen subida correctamente!');
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error(data.message || 'Error al registrar la imagen');
      }
    } catch (err) {
      console.error('Error al subir imagen:', err);
      setError(err.message);
    } finally {
      setUploadingImage(false);
      // Limpiar el input file para permitir seleccionar el mismo archivo nuevamente
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta imagen?')) {
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      // Verificar si la imagen a eliminar es la principal y si es la única
      const isMainImage = profile.images.find(img => img.id === imageId)?.isMain;
      const hasMoreImages = profile.images.length > 1;
      
      if (isMainImage && !hasMoreImages) {
        throw new Error('No puedes eliminar tu única imagen. Debes tener al menos una imagen en tu perfil.');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/profiles/image/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Actualizar el perfil sin la imagen eliminada
        fetchProfileData();
        setSuccessMessage('Imagen eliminada correctamente');
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error(data.message || 'Error al eliminar la imagen');
      }
    } catch (err) {
      console.error('Error al eliminar imagen:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSetMainImage = async (imageId) => {
    try {
      setLoading(true);
      setError(null);
      
      const token = localStorage.getItem('accessToken');
      
      if (!token) {
        throw new Error('No hay sesión activa');
      }
      
      // Buscar la imagen actual
      const imageToUpdate = profile.images.find(img => img.id === imageId);
      
      if (!imageToUpdate) {
        throw new Error('Imagen no encontrada');
      }
      
      // Actualizar la imagen para marcarla como principal
      const response = await fetch(`${API_BASE_URL}/api/profiles/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          id: imageId,
          imageUrl: imageToUpdate.imageUrl,
          thumbnailUrl: imageToUpdate.thumbnailUrl,
          mediumUrl: imageToUpdate.mediumUrl,
          isMain: true,
          description: imageToUpdate.description,
          orderPosition: imageToUpdate.orderPosition,
          isPrivate: false // Mantenemos esto por compatibilidad
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        // Actualizar el perfil con la nueva imagen principal
        fetchProfileData();
        setSuccessMessage('Imagen principal actualizada');
        
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        throw new Error(data.message || 'Error al establecer la imagen principal');
      }
    } catch (err) {
      console.error('Error al establecer imagen principal:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Función para obtener la URL completa de una imagen
  const getImageUrl = (url) => {
    if (!url) return `${API_BASE_URL}/images/publicacion.jpg`;
    if (url.startsWith('blob:')) return url; // Mantener URLs de blob para visualización
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };
  
  // Función para manejar errores en las imágenes
  const handleImageError = (e) => {
    console.log("Error cargando imagen, usando imagen por defecto");
    e.target.onerror = null; // Prevenir bucle infinito
    e.target.src = `${API_BASE_URL}/images/publicacion.jpg`;
    
    // Si también falla la imagen por defecto, usar una base64 mínima
    setTimeout(() => {
      if (!e.target.complete || e.target.naturalHeight === 0) {
        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2VlZWVlZSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
      }
    }, 1000);
  };
  
  // Renderizado condicional durante la carga
  if (loading && !profile) {
    return (
      <div className="insta-profile-container">
        <div className="insta-loading">
          <div className="insta-loading-spinner"></div>
        </div>
      </div>
    );
  }
  
  // Renderizado en caso de error
  if (error && !profile) {
    return (
      <div className="insta-profile-container">
        <div className="insta-error">
          <h2>Error al cargar el perfil</h2>
          <p>{error}</p>
          <button className="insta-btn-primary" onClick={fetchProfileData}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="insta-profile-container">
      {/* Visualizador de imagen a pantalla completa */}
      {viewingImage && (
        <div className="insta-image-viewer" onClick={() => setViewingImage(null)}>
          <div className="insta-image-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button className="insta-close-btn" onClick={() => setViewingImage(null)}>
              <FaTimes />
            </button>
            <img 
              src={getImageUrl(viewingImage.imageUrl)} 
              alt="Imagen ampliada" 
              onError={handleImageError}
            />
            <div className="insta-image-viewer-actions">
              {!viewingImage.isMain && (
                <button 
                  className="insta-action-btn"
                  onClick={() => {
                    handleSetMainImage(viewingImage.id);
                    setViewingImage(null);
                  }}
                >
                  <FaStar /> Establecer como principal
                </button>
              )}
              <button 
                className="insta-action-btn insta-delete-btn"
                onClick={() => {
                  handleDeleteImage(viewingImage.id);
                  setViewingImage(null);
                }}
              >
                <FaTrash /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* Navbar superior */}
      <header className="insta-header">
        <div className="insta-header-content">
          <h1 onClick={() => setMenu('mainpage')}>MyProfile</h1>
          
          <div className="insta-header-actions">
            {editMode ? (
              <>
                <button 
                  className="insta-save-btn"
                  onClick={handleSaveProfile}
                  disabled={loading}
                >
                  <FaSave />
                </button>
                <button 
                  className="insta-cancel-btn"
                  onClick={handleCancelEdit}
                >
                  <FaTimes />
                </button>
              </>
            ) : (
              <button 
                className="insta-edit-btn"
                onClick={() => setEditMode(true)}
              >
                <FaPencilAlt />
              </button>
            )}
          </div>
        </div>
        
        {/* Notificaciones */}
        {successMessage && (
          <div className="insta-notification insta-success">
            <FaCheck className="insta-notification-icon" />
            <span>{successMessage}</span>
          </div>
        )}
        
        {error && (
          <div className="insta-notification insta-error">
            <FaTimes className="insta-notification-icon" />
            <span>{error}</span>
          </div>
        )}
        
        {/* Información de perfil - estilo Instagram */}
        {profile && (
          <div className="insta-profile-info">
            <div className="insta-profile-avatar">
              {profile.images && profile.images.length > 0 ? (
                <img
                  src={getImageUrl(profile.images.find(img => img.isMain)?.mediumUrl || profile.images[0].mediumUrl)}
                  alt={profile.displayName}
                  onError={handleImageError}
                />
              ) : (
                <img
                  src={getImageUrl(profile.user?.profileImageUrl)}
                  alt={profile.displayName}
                  onError={handleImageError}
                />
              )}
            </div>
            
            <div className="insta-profile-details">
              <div className="insta-profile-name">
                <h2>{profile.displayName}</h2>
                {profile.verificationStatus === 'verificado' && (
                  <span className="insta-verified-badge">
                    <FaCheck />
                  </span>
                )}
              </div>
              
              <div className="insta-profile-stats">
                <div className="insta-stat">
                  <strong>{profile.images?.length || 0}</strong> 
                  <span>fotos</span>
                </div>
                <div className="insta-stat">
                  <strong>{profile.totalViews || 0}</strong> 
                  <span>vistas</span>
                </div>
                <div className="insta-stat">
                  <strong>{profile.totalFavorites || 0}</strong> 
                  <span>favoritos</span>
                </div>
              </div>
              
              <div className="insta-profile-bio">
                <p className="insta-real-name">{profile.realName}</p>
                <p className="insta-description">{profile.shortDescription}</p>
                {profile.location?.city && (
                  <p className="insta-location">
                    <FaMapMarkerAlt /> {profile.location.city}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </header>
      
      {/* Tabs de navegación */}
      <div className="insta-tabs">
        <button 
          className={`insta-tab ${selectedTab === 'images' ? 'active' : ''}`}
          onClick={() => setSelectedTab('images')}
        >
          <FaImages />
        </button>
        <button 
          className={`insta-tab ${selectedTab === 'info' ? 'active' : ''}`}
          onClick={() => setSelectedTab('info')}
        >
          <FaInfoCircle />
        </button>
        <button 
          className={`insta-tab ${selectedTab === 'services' ? 'active' : ''}`}
          onClick={() => setSelectedTab('services')}
        >
          <FaMoneyBillWave />
        </button>
        <button 
          className={`insta-tab ${selectedTab === 'contact' ? 'active' : ''}`}
          onClick={() => setSelectedTab('contact')}
        >
          <FaPhoneAlt />
        </button>
      </div>
      
      {/* Contenido principal */}
      <main className="insta-content">
        {/* Galería de fotos (Tab principal) */}
        {selectedTab === 'images' && (
          <div className="insta-gallery-tab">
            <div className="insta-upload-area">
              <button 
                className="insta-upload-btn"
                onClick={handleUploadButtonClick}
                disabled={uploadingImage || (profile.images && profile.images.length >= 5)}
              >
                <FaCamera /> {uploadingImage ? 'Subiendo...' : 'Subir Foto'}
              </button>
              <span className="insta-image-counter">
                {profile?.images?.length || 0}/5 fotos
              </span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </div>
            
            {profile.images && profile.images.length > 0 ? (
              <div className="insta-gallery-grid">
                {profile.images.map(image => (
                  <div 
                    key={image.id} 
                    className={`insta-gallery-item ${image.isMain ? 'main-photo' : ''}`}
                    onClick={() => setViewingImage(image)}
                  >
                    <img
                      src={getImageUrl(image.mediumUrl || image.imageUrl)}
                      alt="Foto de perfil"
                      onError={handleImageError}
                    />
                    
                    {image.isMain && (
                      <div className="insta-main-badge">
                        <FaStar />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="insta-no-photos">
                <FaImages className="insta-no-photos-icon" />
                <h3>Aún no tienes fotos</h3>
                <p>Las fotos son fundamentales para atraer interés. ¡Sube tu primera foto ahora!</p>
                <button 
                  className="insta-upload-btn-large"
                  onClick={handleUploadButtonClick}
                >
                  <FaCamera /> Subir mi primera foto
                </button>
              </div>
            )}
          </div>
        )}
        
        {/* Información personal */}
        {selectedTab === 'info' && (
          <div className="insta-tab-content">
            <div className="insta-section">
              <h3><FaUser /> Información Personal</h3>
              
              <div className="insta-form-group">
                <label>Nombre a mostrar</label>
                <input
                  type="text"
                  name="displayName"
                  value={formData.displayName || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Tu nombre público"
                />
              </div>
              
              <div className="insta-form-group">
                <label>Nombre real</label>
                <input
                  type="text"
                  name="realName"
                  value={formData.realName || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Tu nombre completo"
                />
              </div>
              
              <div className="insta-form-row">
                <div className="insta-form-group">
                  <label>Género</label>
                  <select
                    name="gender"
                    value={formData.gender || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-select"
                  >
                    <option value="">Selecciona género</option>
                    <option value="femenino">Femenino</option>
                    <option value="masculino">Masculino</option>
                    <option value="trans">Trans</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>
                
                <div className="insta-form-group">
                  <label>Edad</label>
                  <input
                    type="number"
                    name="age"
                    value={formData.age || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Tu edad"
                  />
                </div>
              </div>
              
              <div className="insta-form-row">
                <div className="insta-form-group">
                  <label>Nacionalidad</label>
                  <input
                    type="text"
                    name="nationality"
                    value={formData.nationality || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Tu nacionalidad"
                  />
                </div>
                
                <div className="insta-form-group">
                  <label>Ciudad</label>
                  <input
                    type="text"
                    name="location.city"
                    value={formData.location?.city || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Tu ciudad"
                  />
                </div>
              </div>
            </div>
            
            <div className="insta-section">
              <h3>Descripción</h3>
              
              <div className="insta-form-group">
                <label>Descripción corta</label>
                <input
                  type="text"
                  name="shortDescription"
                  value={formData.shortDescription || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  maxLength={100}
                  placeholder="Una breve descripción sobre ti"
                />
                <div className="insta-char-counter">
                  {(formData.shortDescription?.length || 0)}/100
                </div>
              </div>
              
              <div className="insta-form-group">
                <label>Descripción completa</label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-textarea"
                  rows={4}
                  placeholder="Cuéntanos sobre ti con más detalle"
                ></textarea>
              </div>
            </div>
            
            <div className="insta-section">
              <h3>Características Físicas</h3>
              
              <div className="insta-form-row">
                <div className="insta-form-group">
                  <label>Altura (cm)</label>
                  <input
                    type="number"
                    name="height"
                    value={formData.height || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Tu altura en cm"
                  />
                </div>
                
                <div className="insta-form-group">
                  <label>Peso (kg)</label>
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Tu peso en kg"
                  />
                </div>
              </div>
              
              <div className="insta-form-row">
                <div className="insta-form-group">
                  <label>Color de ojos</label>
                  <input
                    type="text"
                    name="eyeColor"
                    value={formData.eyeColor || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Color de tus ojos"
                  />
                </div>
                
                <div className="insta-form-group">
                  <label>Color de cabello</label>
                  <input
                    type="text"
                    name="hairColor"
                    value={formData.hairColor || ''}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-input"
                    placeholder="Color de tu cabello"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Servicios y Precios */}
        {selectedTab === 'services' && (
          <div className="insta-tab-content">
            <div className="insta-section">
              <h3>Servicios Ofrecidos</h3>
              
              {editMode ? (
                <div className="insta-form-group">
                  <label>Servicios (separados por comas)</label>
                  <textarea
                    name="services"
                    value={Array.isArray(formData.services) ? formData.services.join(', ') : ''}
                    onChange={handleInputChange}
                    className="insta-textarea"
                    rows={3}
                    placeholder="Describe los servicios que ofreces"
                  ></textarea>
                </div>
              ) : (
                <div className="insta-services-list">
                  {Array.isArray(formData.services) && formData.services.length > 0 ? (
                    <div className="insta-service-tags">
                      {formData.services.map((service, index) => (
                        <span key={index} className="insta-service-tag">
                          {service}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="insta-no-data">No has agregado servicios todavía</p>
                  )}
                </div>
              )}
            </div>
            
            <div className="insta-section">
              <h3>Precios</h3>
              
              <div className="insta-price-list">
                {editMode ? (
                  <>
                    <div className="insta-form-row">
                      <div className="insta-form-group">
                        <label>Precio por hora</label>
                        <div className="insta-input-group">
                          <input
                            type="number"
                            name="priceHour"
                            value={formData.priceHour || ''}
                            onChange={handleInputChange}
                            className="insta-input"
                            placeholder="0"
                          />
                          <select
                            name="currency"
                            value={formData.currency || 'USD'}
                            onChange={handleInputChange}
                            className="insta-select insta-currency-select"
                          >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="DOP">DOP</option>
                          </select>
                        </div>
                      </div>
                      
                      <div className="insta-form-group">
                        <label>Hora adicional</label>
                        <input
                          type="number"
                          name="priceAdditionalHour"
                          value={formData.priceAdditionalHour || ''}
                          onChange={handleInputChange}
                          className="insta-input"
                          placeholder="0"
                        />
                      </div>
                    </div>
                    
                    <div className="insta-form-row">
                      <div className="insta-form-group">
                        <label>Noche completa</label>
                        <input
                          type="number"
                          name="priceOvernight"
                          value={formData.priceOvernight || ''}
                          onChange={handleInputChange}
                          className="insta-input"
                          placeholder="0"
                        />
                      </div>
                      
                      <div className="insta-form-group">
                        <label>Fin de semana</label>
                        <input
                          type="number"
                          name="priceWeekend"
                          value={formData.priceWeekend || ''}
                          onChange={handleInputChange}
                          className="insta-input"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="insta-price-cards">
                    {formData.priceHour && (
                      <div className="insta-price-card">
                        <h4>Por hora</h4>
                        <p className="insta-price">{formData.priceHour} {formData.currency || 'USD'}</p>
                      </div>
                    )}
                    
                    {formData.priceAdditionalHour && (
                      <div className="insta-price-card">
                        <h4>Hora adicional</h4>
                        <p className="insta-price">{formData.priceAdditionalHour} {formData.currency || 'USD'}</p>
                      </div>
                    )}
                    
                    {formData.priceOvernight && (
                      <div className="insta-price-card">
                        <h4>Noche completa</h4>
                        <p className="insta-price">{formData.priceOvernight} {formData.currency || 'USD'}</p>
                      </div>
                    )}
                    
                    {formData.priceWeekend && (
                      <div className="insta-price-card">
                        <h4>Fin de semana</h4>
                        <p className="insta-price">{formData.priceWeekend} {formData.currency || 'USD'}</p>
                      </div>
                    )}
                    
                    {!formData.priceHour && !formData.priceAdditionalHour && 
                     !formData.priceOvernight && !formData.priceWeekend && (
                      <p className="insta-no-data">No has establecido precios todavía</p>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="insta-section">
              <h3>Información Adicional</h3>
              
              <div className="insta-form-group">
                <label>Métodos de pago aceptados</label>
                <input
                  type="text"
                  name="paymentMethods"
                  value={formData.paymentMethods || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Efectivo, tarjeta, etc."
                />
              </div>
              
              <div className="insta-form-group insta-checkbox-group">
                <label className="insta-checkbox-label">
                  <input
                    type="checkbox"
                    name="travelAvailability"
                    checked={formData.travelAvailability || false}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-checkbox"
                  />
                  <span>Disponible para viajar</span>
                </label>
              </div>
              
              {formData.travelAvailability && (
                <>
                  <div className="insta-form-group">
                    <label>Destinos disponibles</label>
                    <input
                      type="text"
                      name="travelDestinations"
                      value={Array.isArray(formData.travelDestinations) 
                        ? formData.travelDestinations.join(', ')
                        : formData.travelDestinations || ''}
                      onChange={handleInputChange}
                      disabled={!editMode}
                      className="insta-input"
                      placeholder="Lista de ciudades o países"
                    />
                  </div>
                  
                  {!editMode && Array.isArray(formData.travelDestinations) && 
                   formData.travelDestinations.length > 0 && (
                    <div className="insta-destinations">
                      {formData.travelDestinations.map((destination, index) => (
                        <span key={index} className="insta-destination-tag">
                          <FaMapMarkerAlt /> {destination}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <div className="insta-form-group">
                    <label>Precio por viaje</label>
                    <input
                      type="number"
                      name="priceTravel"
                      value={formData.priceTravel || ''}
                      onChange={handleInputChange}
                      disabled={!editMode}
                      className="insta-input"
                      placeholder="0"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        
        {/* Información de contacto */}
        {selectedTab === 'contact' && (
          <div className="insta-tab-content">
            <div className="insta-section">
              <h3>Datos de Contacto</h3>
              
              <div className="insta-form-group">
                <label>Teléfono</label>
                <input
                  type="tel"
                  name="contactMethods.telefono"
                  value={formData.contactMethods?.telefono || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Tu número de teléfono"
                />
              </div>
              
              <div className="insta-form-group">
                <label>WhatsApp</label>
                <input
                  type="tel"
                  name="contactMethods.whatsapp"
                  value={formData.contactMethods?.whatsapp || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Tu número de WhatsApp"
                />
              </div>
              
              <div className="insta-form-group">
                <label>Email</label>
                <input
                  type="email"
                  name="contactMethods.email"
                  value={formData.contactMethods?.email || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Tu correo electrónico"
                />
              </div>
            </div>
            
            <div className="insta-section">
              <h3>Disponibilidad</h3>
              
              <div className="insta-form-group insta-checkbox-group">
                <label className="insta-checkbox-label">
                  <input
                    type="checkbox"
                    name="availabilityStatus"
                    checked={formData.availabilityStatus === 'disponible'}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    className="insta-checkbox"
                  />
                  <span>Estoy disponible actualmente</span>
                </label>
              </div>
              
              <div className="insta-form-group">
                <label>Horario preferido de contacto</label>
                <input
                  type="text"
                  name="preferredContactHours"
                  value={formData.preferredContactHours || ''}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  className="insta-input"
                  placeholder="Ej: Lunes a Viernes de 10:00 a 20:00"
                />
              </div>
              
              <div className="insta-form-group">
                <label>Mi horario de disponibilidad</label>
                <textarea
                  name="availabilitySchedule"
                  value={typeof formData.availabilitySchedule === 'object' 
                    ? JSON.stringify(formData.availabilitySchedule) 
                    : formData.availabilitySchedule || ''}
                  onChange={(e) => {
                    let value = e.target.value;
                    try {
                      if (value.startsWith('{') && value.endsWith('}')) {
                        value = JSON.parse(value);
                      }
                    } catch (err) {
                      console.log('No es un JSON válido, tratando como texto');
                    }
                    
                    setFormData(prev => ({
                      ...prev,
                      availabilitySchedule: value
                    }));
                  }}
                  disabled={!editMode}
                  className="insta-textarea"
                  rows={3}
                  placeholder="Ej: Lunes a Viernes de 10:00 a 22:00, Sábados de 12:00 a 02:00"
                ></textarea>
                <div className="insta-form-hint">
                  Si el horario es complejo, introduce texto descriptivo o un objeto JSON para días específicos.
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfileEditInsta;