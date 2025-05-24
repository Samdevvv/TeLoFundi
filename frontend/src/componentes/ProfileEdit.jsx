
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FaCamera, FaTrash, FaStar, FaPencilAlt, FaTimes, FaCheck 
} from 'react-icons/fa';
import '../estilos/ProfileEdit.css';

const ProfileEdit = React.memo(({ setMenu, appConfig }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedEditTab, setSelectedEditTab] = useState('info');
  const [formData, setFormData] = useState({});
  const [uploadingImage, setUploadingImage] = useState(false);
  const [viewingImage, setViewingImage] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const fileInputRef = useRef(null);

  const API_BASE_URL = appConfig?.API_BASE_URL || 'http://localhost:5000';

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No hay sesión activa');
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) throw new Error('No se encontró información del usuario');
      const response = await fetch(`${API_BASE_URL}/api/profiles/${user.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Error al cargar los datos del perfil');
      const data = await response.json();
      if (data.success) {
        setProfile(data.data);
        const initialFormData = {
          ...data.data,
          location: data.data.location || { city: '' },
          contactMethods: data.data.contactMethods || { telefono: '', whatsapp: '', email: '' },
          services: Array.isArray(data.data.services) ? data.data.services : []
        };
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = useCallback(() => {
    const errors = {};
    if (selectedEditTab === 'info') {
      if (!formData.displayName?.trim()) errors.displayName = 'El nombre es obligatorio';
      if (formData.shortDescription?.length > 150) errors.shortDescription = 'La biografía no puede exceder 150 caracteres';
    } else if (selectedEditTab === 'services') {
      if (formData.priceHour && isNaN(formData.priceHour)) errors.priceHour = 'El precio debe ser un número';
    } else if (selectedEditTab === 'contact') {
      if (formData.contactMethods?.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contactMethods.email)) {
        errors.email = 'El email no es válido';
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, selectedEditTab]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormErrors(prev => ({ ...prev, [name.split('.')[0]]: '' }));
    if (type === 'checkbox') {
      if (name === 'availabilityStatus') {
        setFormData(prev => ({ ...prev, [name]: checked ? 'disponible' : 'no_disponible' }));
      } else {
        setFormData(prev => ({ ...prev, [name]: checked }));
      }
    } else if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData(prev => ({ ...prev, [parent]: { ...prev[parent] || {}, [child]: value } }));
    } else if (name === 'services' && type !== 'checkbox') {
      const servicesArray = value.split(',').map(item => item.trim()).filter(item => item);
      setFormData(prev => ({ ...prev, [name]: servicesArray }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) return;
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No hay sesión activa');
      const dataToSend = { ...formData };
      delete dataToSend.id;
      delete dataToSend.user;
      delete dataToSend.agency;
      delete dataToSend.images;
      delete dataToSend.totalViews;
      delete dataToSend.totalContacts;
      delete dataToSend.totalFavorites;
      if (typeof dataToSend.services === 'string') {
        dataToSend.services = dataToSend.services.split(',').map(item => item.trim()).filter(item => item);
      }
      ['priceHour', 'priceOvernight'].forEach(field => {
        if (dataToSend[field]) dataToSend[field] = parseFloat(dataToSend[field]);
      });
      ['height', 'weight', 'age'].forEach(field => {
        if (dataToSend[field]) dataToSend[field] = parseInt(dataToSend[field], 10);
      });
      const checkForBlobUrls = (obj) => {
        if (!obj) return;
        Object.keys(obj).forEach(key => {
          if (typeof obj[key] === 'string' && obj[key].startsWith('blob:')) {
            delete obj[key];
          } else if (typeof obj[key] === 'object' && obj[key] !== null) {
            checkForBlobUrls(obj[key]);
          }
        });
      };
      checkForBlobUrls(dataToSend);
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
        setEditModalOpen(false);
        fetchProfileData();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'Error al guardar los cambios');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    fetchProfileData();
    setEditModalOpen(false);
    setFormErrors({});
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
      if (!token) throw new Error('No hay sesión activa');
      if (profile.images && profile.images.length >= 5) {
        throw new Error('Ya tienes el máximo de 5 imágenes permitidas.');
      }
      const formData = new FormData();
      formData.append('image', file);
      let imageUrl, thumbnailUrl, mediumUrl;
      try {
        const uploadResponse = await fetch(`${API_BASE_URL}/api/uploads/image`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!uploadResponse.ok) throw new Error('Error al subir la imagen');
        const uploadData = await uploadResponse.json();
        if (uploadData.success) {
          imageUrl = uploadData.data.imageUrl;
          thumbnailUrl = uploadData.data.thumbnailUrl || uploadData.data.imageUrl;
          mediumUrl = uploadData.data.mediumUrl || uploadData.data.imageUrl;
        } else {
          throw new Error(uploadData.message || 'Error al subir imagen');
        }
      } catch (uploadError) {
        const reader = new FileReader();
        const imageLoaded = new Promise((resolve, reject) => {
          reader.onload = resolve;
          reader.onerror = reject;
        });
        reader.readAsDataURL(file);
        await imageLoaded;
        const dataUrl = reader.result;
        const uploadResponse = await fetch(`${API_BASE_URL}/api/uploads/data-image`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ dataUrl })
        });
        if (!uploadResponse.ok) throw new Error('Error al subir la imagen mediante data URL');
        const uploadData = await uploadResponse.json();
        if (!uploadData.success) throw new Error(uploadData.message || 'Error al subir imagen mediante data URL');
        imageUrl = uploadData.data.imageUrl;
        thumbnailUrl = uploadData.data.thumbnailUrl || uploadData.data.imageUrl;
        mediumUrl = uploadData.data.mediumUrl || uploadData.data.imageUrl;
      }
      const imageData = {
        imageUrl,
        thumbnailUrl,
        mediumUrl,
        isMain: !profile.images || profile.images.length === 0,
        description: `Imagen subida el ${new Date().toLocaleString()}`,
        orderPosition: profile.images ? profile.images.length : 0,
        isPrivate: false
      };
      const response = await fetch(`${API_BASE_URL}/api/profiles/image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(imageData)
      });
      if (!response.ok) throw new Error('Error al registrar la imagen');
      const data = await response.json();
      if (data.success) {
        fetchProfileData();
        setSuccessMessage('¡Imagen subida correctamente!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'Error al registrar la imagen');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteImage = async (imageId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta imagen?')) return;
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('No hay sesión activa');
      const isMainImage = profile.images.find(img => img.id === imageId)?.isMain;
      const hasMoreImages = profile.images.length > 1;
      if (isMainImage && !hasMoreImages) {
        throw new Error('No puedes eliminar tu única imagen.');
      }
      const response = await fetch(`${API_BASE_URL}/api/profiles/image/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok && data.success) {
        fetchProfileData();
        setSuccessMessage('Imagen eliminada correctamente');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'Error al eliminar la imagen');
      }
    } catch (err) {
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
      if (!token) throw new Error('No hay sesión activa');
      const imageToUpdate = profile.images.find(img => img.id === imageId);
      if (!imageToUpdate) throw new Error('Imagen no encontrada');
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
          isPrivate: false
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        fetchProfileData();
        setSuccessMessage('Imagen principal actualizada');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        throw new Error(data.message || 'Error al establecer la imagen principal');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (url) => {
    if (!url) return `${API_BASE_URL}/images/publicacion.jpg`;
    if (url.startsWith('blob:')) return url;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = `${API_BASE_URL}/images/publicacion.jpg`;
    setTimeout(() => {
      if (!e.target.complete || e.target.naturalHeight === 0) {
        e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2VlZWVlZSI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+';
      }
    }, 1000);
  };

  if (loading && !profile) {
    return (
      <div className="insta-profile-container">
        <div className="insta-loading">
          <div className="insta-loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="insta-profile-container">
        <div className="insta-error">
          <h2>Error</h2>
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
      {viewingImage && (
        <div className="insta-image-viewer" onClick={() => setViewingImage(null)}>
          <div className="insta-image-viewer-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="insta-close-btn" 
              onClick={() => setViewingImage(null)} 
              aria-label="Cerrar visor de imágenes"
            >
              <FaTimes />
            </button>
            <button
              className="insta-nav-btn insta-prev-btn"
              onClick={() => {
                const currentIndex = profile.images.findIndex(img => img.id === viewingImage.id);
                const prevIndex = (currentIndex - 1 + profile.images.length) % profile.images.length;
                setViewingImage(profile.images[prevIndex]);
              }}
              disabled={profile.images.length <= 1}
              aria-label="Imagen anterior"
            >
              ←
            </button>
            <img 
              src={getImageUrl(viewingImage.imageUrl)} 
              alt="Imagen ampliada" 
              onError={handleImageError}
              loading="lazy"
            />
            <button
              className="insta-nav-btn insta-next-btn"
              onClick={() => {
                const currentIndex = profile.images.findIndex(img => img.id === viewingImage.id);
                const nextIndex = (currentIndex + 1) % profile.images.length;
                setViewingImage(profile.images[nextIndex]);
              }}
              disabled={profile.images.length <= 1}
              aria-label="Siguiente imagen"
            >
              →
            </button>
            <div className="insta-image-viewer-actions">
              {!viewingImage.isMain && (
                <button 
                  className="insta-action-btn"
                  onClick={() => {
                    handleSetMainImage(viewingImage.id);
                    setViewingImage(null);
                  }}
                  aria-label="Establecer como imagen principal"
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
                aria-label="Eliminar imagen"
              >
                <FaTrash /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {editModalOpen && (
        <div className="insta-edit-modal" onClick={() => setEditModalOpen(false)}>
          <div className="insta-edit-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="insta-edit-modal-header">
              <h2>Editar perfil</h2>
              <div className="insta-edit-modal-actions">
                <button 
                  className="insta-save-btn" 
                  onClick={handleSaveProfile} 
                  disabled={loading}
                  aria-label="Guardar cambios"
                >
                  <FaCheck />
                </button>
                <button 
                  className="insta-cancel-btn" 
                  onClick={handleCancelEdit}
                  aria-label="Cancelar edición"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
            <div className="insta-edit-tabs">
              <button 
                className={`insta-edit-tab ${selectedEditTab === 'info' ? 'active' : ''}`}
                onClick={() => setSelectedEditTab('info')}
                aria-label="Editar información personal"
              >
                Información
              </button>
              <button 
                className={`insta-edit-tab ${selectedEditTab === 'services' ? 'active' : ''}`}
                onClick={() => setSelectedEditTab('services')}
                aria-label="Editar servicios"
              >
                Servicios
              </button>
              <button 
                className={`insta-edit-tab ${selectedEditTab === 'contact' ? 'active' : ''}`}
                onClick={() => setSelectedEditTab('contact')}
                aria-label="Editar información de contacto"
              >
                Contacto
              </button>
            </div>
            <div className="insta-edit-modal-body">
              {selectedEditTab === 'info' && (
                <div className="insta-section">
                  <div className="insta-form-group">
                    <label>Nombre</label>
                    <input
                      type="text"
                      name="displayName"
                      value={formData.displayName || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                      aria-required="true"
                    />
                    {formErrors.displayName && <span className="insta-form-error">{formErrors.displayName}</span>}
                  </div>
                  <div className="insta-form-group">
                    <label>Nombre completo</label>
                    <input
                      type="text"
                      name="realName"
                      value={formData.realName || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                    />
                  </div>
                  <div className="insta-form-group">
                    <label>Biografía</label>
                    <textarea
                      name="shortDescription"
                      value={formData.shortDescription || ''}
                      onChange={handleInputChange}
                      className="insta-textarea"
                      maxLength={150}
                      aria-describedby="bio-char-counter"
                    />
                    <div className="insta-char-counter" id="bio-char-counter">
                      {(formData.shortDescription?.length || 0)}/150
                    </div>
                    {formErrors.shortDescription && <span className="insta-form-error">{formErrors.shortDescription}</span>}
                  </div>
                  <div className="insta-form-group">
                    <label>Ciudad</label>
                    <input
                      type="text"
                      name="location.city"
                      value={formData.location?.city || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                    />
                  </div>
                </div>
              )}
              {selectedEditTab === 'services' && (
                <div className="insta-section">
                  <div className="insta-form-group">
                    <label>Servicios</label>
                    <textarea
                      name="services"
                      value={Array.isArray(formData.services) ? formData.services.join(', ') : ''}
                      onChange={handleInputChange}
                      className="insta-textarea"
                      rows={3}
                      maxLength={200}
                      aria-describedby="services-char-counter"
                    />
                    <div className="insta-char-counter" id="services-char-counter">
                      {(Array.isArray(formData.services) ? formData.services.join(', ').length : 0)}/200
                    </div>
                  </div>
                  <div className="insta-form-group">
                    <label>Precio por hora</label>
                    <input
                      type="number"
                      name="priceHour"
                      value={formData.priceHour || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                      min="0"
                    />
                    {formErrors.priceHour && <span className="insta-form-error">{formErrors.priceHour}</span>}
                  </div>
                </div>
              )}
              {selectedEditTab === 'contact' && (
                <div className="insta-section">
                  <div className="insta-form-group">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      name="contactMethods.telefono"
                      value={formData.contactMethods?.telefono || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                    />
                  </div>
                  <div className="insta-form-group">
                    <label>Email</label>
                    <input
                      type="email"
                      name="contactMethods.email"
                      value={formData.contactMethods?.email || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                    />
                    {formErrors.email && <span className="insta-form-error">{formErrors.email}</span>}
                  </div>
                  <div className="insta-form-group">
                    <label>WhatsApp</label>
                    <input
                      type="tel"
                      name="contactMethods.whatsapp"
                      value={formData.contactMethods?.whatsapp || ''}
                      onChange={handleInputChange}
                      className="insta-input"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <header className="insta-header">
        <div className="insta-header-content">
          <h1>{profile?.displayName || 'Usuario'}</h1>
          <div className="insta-header-actions">
            <button 
              className="insta-edit-btn insta-btn-primary" 
              onClick={() => setEditModalOpen(true)}
              aria-label="Editar perfil"
            >
              <FaPencilAlt style={{ marginRight: '6px' }} /> Editar perfil
            </button>
          </div>
        </div>
      </header>

      <div className="insta-profile-info">
        <div className="insta-profile-avatar">
          {profile?.images && profile.images.length > 0 ? (
            <img
              src={getImageUrl(profile.images.find(img => img.isMain)?.mediumUrl || profile.images[0].mediumUrl)}
              alt={profile.displayName}
              onError={handleImageError}
              loading="lazy"
            />
          ) : (
            <img
              src={getImageUrl(profile.user?.profileImageUrl)}
              alt={profile.displayName}
              onError={handleImageError}
              loading="lazy"
            />
          )}
        </div>
        <div className="insta-profile-details">
          <div className="insta-profile-name">
            <h2>{profile?.displayName || 'Usuario'}</h2>
            {profile?.isVerified && (
              <span className="insta-verified-badge" aria-label="Usuario verificado">✔</span>
            )}
          </div>
          <div className="insta-profile-stats">
            <div className="insta-stat">
              <strong>{profile?.images?.length || 0}</strong>
              <span>Publicaciones</span>
            </div>
            <div className="insta-stat">
              <strong>{profile?.totalFollowers || 0}</strong>
              <span>Seguidores</span>
            </div>
            <div className="insta-stat">
              <strong>{profile?.totalFollowing || 0}</strong>
              <span>Seguidos</span>
            </div>
          </div>
          <div className="insta-profile-bio">
            <div className="insta-real-name">{profile?.realName}</div>
            <div className="insta-description">{profile?.shortDescription}</div>
            {profile?.location?.city && (
              <div className="insta-location">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                </svg>
                {profile.location.city}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="insta-content">
        <div className="insta-gallery-tab">
          <div className="insta-upload-area">
            <button 
              className="insta-upload-btn" 
              onClick={handleUploadButtonClick} 
              disabled={uploadingImage}
              aria-label="Subir nueva foto"
            >
              <FaCamera /> {uploadingImage ? 'Subiendo...' : 'Subir foto'}
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
              aria-hidden="true"
            />
          </div>
          {profile.images && profile.images.length > 0 ? (
            <div className="insta-gallery-grid">
              {profile.images.map(image => (
                <div 
                  key={image.id} 
                  className="insta-gallery-item"
                  onClick={() => setViewingImage(image)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setViewingImage(image)}
                  aria-label={`Ver imagen ${image.description}`}
                >
                  <img
                    src={getImageUrl(image.mediumUrl || image.imageUrl)}
                    alt={image.description || 'Foto de perfil'}
                    onError={handleImageError}
                    loading="lazy"
                  />
                  {image.isMain && (
                    <div className="insta-main-badge" aria-label="Imagen principal">
                      <FaStar />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="insta-no-photos">
              <div className="insta-no-photos-icon" aria-hidden="true">+</div>
              <h3>Comparte fotos</h3>
              <p>Cuando compartas fotos, aparecerán en tu perfil.</p>
              <button 
                className="insta-upload-btn-large" 
                onClick={handleUploadButtonClick}
                aria-label="Subir tu primera foto"
              >
                <FaCamera /> Comparte tu primera foto
              </button>
            </div>
          )}
        </div>
      </div>

      {successMessage && (
        <div className="insta-notification insta-success">
          <FaCheck className="insta-notification-icon" />
          <span>{successMessage}</span>
        </div>
      )}
      {error && (
        <div className="insta-notification insta-error-notification">
          <FaTimes className="insta-notification-icon" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
});

export default ProfileEdit;
