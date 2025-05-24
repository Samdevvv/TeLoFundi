import React, { useState, useEffect } from "react";
import ProfileFullScreen from "./ProfileModal";
import "../estilos/ProfileGrid.css";

const ProfileGrid = ({ setMenu, userLoggedIn, appConfig }) => {
  const [profiles, setProfiles] = useState([]);
  const [featuredProfiles, setFeaturedProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [currentImageIndices, setCurrentImageIndices] = useState({});
  const [filters, setFilters] = useState({
    location: "",
    service: "",
    verified: false,
    priceMin: "",
    priceMax: "",
    gender: "",
    searchQuery: "",
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 12,
    totalPages: 0,
  });

  const API_BASE_URL = appConfig?.API_BASE_URL || "http://localhost:5000";

  const fetchProfiles = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(
          Object.entries(filters).filter(
            ([_, value]) => value !== "" && value !== false
          )
        ),
      });

      const response = await fetch(
        `${API_BASE_URL}/api/profiles?${queryParams}`
      );

      if (!response.ok) {
        throw new Error("Error al cargar perfiles");
      }

      const data = await response.json();

      if (data.success) {
        setProfiles(data.data);
        const initialIndices = {};
        data.data.forEach((profile) => {
          initialIndices[profile.id] = 0;
        });
        setCurrentImageIndices(initialIndices);
        setPagination({
          ...pagination,
          totalPages: data.meta?.totalPages || 0,
        });
      } else {
        throw new Error(data.message || "Error al cargar perfiles");
      }
    } catch (err) {
      console.error("Error al cargar perfiles:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFeaturedProfiles = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/profiles/featured`);
      if (!response.ok) {
        throw new Error("Error al cargar perfiles destacados");
      }
      const data = await response.json();
      if (data.success) {
        setFeaturedProfiles(data.data);
      } else {
        throw new Error(data.message || "Error al cargar perfiles destacados");
      }
    } catch (err) {
      console.error("Error al cargar perfiles destacados:", err);
    }
  };

  useEffect(() => {
    fetchProfiles();
    fetchFeaturedProfiles();
  }, [pagination.page, filters]);

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFilters({
      ...filters,
      [name]: type === "checkbox" ? checked : value,
    });
    setPagination({
      ...pagination,
      page: 1,
    });
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchProfiles();
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination({
        ...pagination,
        page: newPage,
      });
    }
  };

  const handleProfileClick = async (profileId) => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/profiles/${profileId}`);
      if (!response.ok) {
        throw new Error("Error al cargar detalles del perfil");
      }
      const data = await response.json();
      if (data.success) {
        setSelectedProfile(data.data);
        setShowModal(true);
        document.body.style.overflow = "hidden";
      } else {
        throw new Error(data.message || "Error al cargar detalles del perfil");
      }
    } catch (err) {
      console.error("Error al cargar detalles del perfil:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    document.body.style.overflow = "auto";
  };

  const handleFeedCarouselNav = (profileId, direction, e) => {
    e.stopPropagation();
    const profile = profiles.find((p) => p.id === profileId);
    if (!profile || !profile.images || profile.images.length <= 1) return;

    const imagesLength = profile.images.length;
    const currentIndex = currentImageIndices[profileId] || 0;
    let newIndex;
    if (direction === "next") {
      newIndex = (currentIndex + 1) % imagesLength;
    } else {
      newIndex = (currentIndex - 1 + imagesLength) % imagesLength;
    }
    setCurrentImageIndices({
      ...currentImageIndices,
      [profileId]: newIndex,
    });
  };

  const handleToggleFavorite = async (profileId, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!userLoggedIn) {
      if (setMenu) {
        setMenu("login");
      }
      return;
    }
    try {
      const profile = profiles.find((p) => p.id === profileId);
      if (!profile) return;
      const isFavorite = profile.isFavorite;
      setProfiles(
        profiles.map((p) =>
          p.id === profileId ? { ...p, isFavorite: !isFavorite } : p
        )
      );
      setFeaturedProfiles(
        featuredProfiles.map((p) =>
          p.id === profileId ? { ...p, isFavorite: !isFavorite } : p
        )
      );
      if (selectedProfile && selectedProfile.id === profileId) {
        setSelectedProfile({
          ...selectedProfile,
          isFavorite: !isFavorite,
        });
      }
      const token = localStorage.getItem("accessToken");
      if (!token) {
        throw new Error("No hay sesión activa");
      }
      const response = await fetch(`${API_BASE_URL}/api/profiles/favorite`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId,
          action: isFavorite ? "remove" : "add",
        }),
      });
      if (!response.ok) {
        throw new Error("Error al actualizar favoritos");
      }
    } catch (err) {
      console.error("Error al actualizar favoritos:", err);
      fetchProfiles();
      fetchFeaturedProfiles();
    }
  };

  const handleWhatsAppContact = (profile, e) => {
    if (e) {
      e.stopPropagation();
    }
    if (!userLoggedIn) {
      if (setMenu) {
        setMenu("login");
      }
      return;
    }
    const whatsappNumber = profile.contactMethods?.whatsapp || "";
    if (whatsappNumber) {
      const formattedNumber = whatsappNumber.replace(/[^0-9]/g, "");
      const whatsappUrl = `https://wa.me/${formattedNumber}?text=Hola,%20te%20contacto%20desde%20la%20plataforma`;
      window.open(whatsappUrl, "_blank");
      registerContact(profile.id, "whatsapp");
    } else {
      alert(
        "Este perfil no tiene WhatsApp disponible. Por favor, usa otro método de contacto."
      );
    }
  };

  const registerContact = async (profileId, method) => {
    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        console.log("No hay sesión activa");
        return;
      }
      const response = await fetch(`${API_BASE_URL}/api/profiles/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          profileId,
          contactMethod: method,
          notes: "Contacto desde la plataforma",
        }),
      });
      if (!response.ok) {
        console.error("Error al registrar contacto");
      }
    } catch (err) {
      console.error("Error al registrar contacto:", err);
    }
  };

  const getMainImage = (profile) => {
    try {
      if (profile.images && profile.images.length > 0) {
        const mainImage =
          profile.images.find((img) => img.isMain) || profile.images[0];
        if (mainImage.thumbnailUrl) {
          return mainImage.thumbnailUrl.startsWith("http")
            ? mainImage.thumbnailUrl
            : `${API_BASE_URL}${mainImage.thumbnailUrl}`;
        } else if (mainImage.imageUrl) {
          return mainImage.imageUrl.startsWith("http")
            ? mainImage.imageUrl
            : `${API_BASE_URL}${mainImage.imageUrl}`;
        }
      }
      if (profile.user && profile.user.profileImageUrl) {
        return profile.user.profileImageUrl.startsWith("http")
          ? profile.user.profileImageUrl
          : `${API_BASE_URL}${profile.user.profileImageUrl}`;
      }
      return `${API_BASE_URL}/images/publicacion.jpg`;
    } catch (err) {
      console.error("Error obteniendo imagen:", err);
      return `${API_BASE_URL}/images/publicacion.jpg`;
    }
  };

  const getImageUrl = (image) => {
    if (!image) return `${API_BASE_URL}/images/publicacion.jpg`;
    if (image.imageUrl) {
      return image.imageUrl.startsWith("http")
        ? image.imageUrl
        : `${API_BASE_URL}${image.imageUrl}`;
    } else {
      return `${API_BASE_URL}/images/publicacion.jpg`;
    }
  };

  const getCurrentFeedImage = (profile) => {
    if (!profile || !profile.images || profile.images.length === 0) {
      return getMainImage(profile);
    }
    const index = currentImageIndices[profile.id] || 0;
    return getImageUrl(profile.images[index]);
  };

  const handleImageError = (e) => {
    e.target.onerror = null;
    e.target.src = `${API_BASE_URL}/images/publicacion.jpg`;
    setTimeout(() => {
      if (!e.target.complete || e.target.naturalHeight === 0) {
        e.target.src =
          "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzMzMzMzMyIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LXNpemU9IjE0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBhbGlnbm1lbnQtYmFzZWxpbmU9Im1pZGRsZSIgZmlsbD0iI2ZmZmZmZiI+SW1hZ2VuIG5vIGRpc3BvbmlibGU8L3RleHQ+PC9zdmc+";
      }
    }, 1000);
  };

  const hasMultipleImages = (profile) => {
    return profile.images && profile.images.length > 1;
  };

  return (
    <div className="dark-container">
      <h1 className="explore-heading">EXPLORA PERFILES</h1>

      <div className="featured-profiles">
        <h2>Perfiles Destacados</h2>
        {featuredProfiles.length > 0 ? (
          featuredProfiles.map((profile) => (
            <div
              key={profile.id}
              className="featured-profile"
              onClick={() => handleProfileClick(profile.id)}
            >
              <div className="featured-profile-avatar">
                <img
                  src={
                    profile.user?.profileImageUrl
                      ? profile.user.profileImageUrl.startsWith("http")
                        ? profile.user.profileImageUrl
                        : `${API_BASE_URL}${profile.user.profileImageUrl}`
                      : `${API_BASE_URL}/images/avatar.jpg`
                  }
                  alt={`Avatar de ${profile.displayName}`}
                  onError={handleImageError}
                />
              </div>
              <div className="featured-profile-info">
                <div className="featured-profile-name">
                  {profile.displayName}
                  {profile.age && (
                    <span className="featured-profile-age">{profile.age}</span>
                  )}
                  {profile.verificationStatus === "verificado" && (
                    <span
                      className="featured-profile-verified"
                      title="Perfil verificado"
                    >
                      <i className="fas fa-check"></i>
                    </span>
                  )}
                </div>
                <div className="featured-profile-location">
                  {typeof profile.location === "string"
                    ? profile.location
                    : profile.location?.city || "Sin ubicación"}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p>No hay perfiles destacados disponibles.</p>
        )}
      </div>

      <div className="main-content">
        {loading && <div className="dark-loading">Cargando perfiles...</div>}
        {error && !loading && (
          <div className="dark-error">
            Error: {error}.{" "}
            <button onClick={fetchProfiles}>Intentar de nuevo</button>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="instagram-posts-container">
              {profiles.length > 0 ? (
                profiles.map((profile) => (
                  <div
                    key={profile.id}
                    className="instagram-post"
                    onClick={() => handleProfileClick(profile.id)}
                  >
                    <div className="post-header">
                      <div className="post-avatar">
                        <img
                          src={
                            profile.user?.profileImageUrl
                              ? profile.user.profileImageUrl.startsWith("http")
                                ? profile.user.profileImageUrl
                                : `${API_BASE_URL}${profile.user.profileImageUrl}`
                              : `${API_BASE_URL}/images/avatar.jpg`
                          }
                          alt={`Avatar de ${profile.displayName}`}
                          onError={handleImageError}
                        />
                      </div>
                      <div className="post-user-info">
                        <div className="post-username">
                          {profile.displayName}
                          {profile.age && (
                            <span className="post-age">{profile.age}</span>
                          )}
                          {profile.verificationStatus === "verificado" && (
                            <span
                              className="verified-badge"
                              title="Perfil verificado"
                            >
                              <i className="fas fa-check"></i>
                            </span>
                          )}
                        </div>
                        <div className="post-location">
                          {typeof profile.location === "string"
                            ? profile.location
                            : profile.location?.city || "Sin ubicación"}
                        </div>
                      </div>
                      <div className="post-options">
                        <i className="fas fa-ellipsis-h"></i>
                      </div>
                    </div>
                    <div className="post-image-container">
                      <img
                        src={getCurrentFeedImage(profile)}
                        alt={profile.displayName}
                        className="post-image"
                        onError={handleImageError}
                        crossOrigin="anonymous"
                      />
                      {hasMultipleImages(profile) && (
                        <div className="post-carousel-controls">
                          <button
                            className="carousel-arrow prev"
                            onClick={(e) =>
                              handleFeedCarouselNav(profile.id, "prev", e)
                            }
                          >
                            <i className="fas fa-chevron-left"></i>
                          </button>
                          <button
                            className="carousel-arrow next"
                            onClick={(e) =>
                              handleFeedCarouselNav(profile.id, "next", e)
                            }
                          >
                            <i className="fas fa-chevron-right"></i>
                          </button>
                        </div>
                      )}
                      {hasMultipleImages(profile) && (
                        <div className="post-carousel-dots">
                          {profile.images.map((_, index) => (
                            <div
                              key={index}
                              className={`pagination-dot ${
                                index === (currentImageIndices[profile.id] || 0)
                                  ? "active"
                                  : ""
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="post-actions">
                      <div>
                        <button
                          className={`post-action-button ${
                            profile.isFavorite ? "is-liked" : ""
                          }`}
                          onClick={(e) => handleToggleFavorite(profile.id, e)}
                          title={
                            profile.isFavorite
                              ? "Quitar de favoritos"
                              : "Me gusta"
                          }
                        >
                          <i
                            className={
                              profile.isFavorite
                                ? "fas fa-heart"
                                : "far fa-heart"
                            }
                          ></i>
                        </button>
                        <button
                          className="post-action-button"
                          onClick={(e) => handleWhatsAppContact(profile, e)}
                          title="Contactar por WhatsApp"
                        >
                          <i className="fab fa-whatsapp"></i>
                        </button>
                        <button
                          className="post-action-button"
                          onClick={(e) => {
                            e.stopPropagation();
                            alert("Función de chat por Telo Fundi en desarrollo");
                          }}
                          title="Chat por Telo Fundi"
                        >
                          <i className="far fa-comment"></i>
                        </button>
                      </div>
                      <button
                        className="post-action-button save-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProfileClick(profile.id);
                        }}
                        title="Ver perfil completo"
                      >
                        <i className="far fa-bookmark"> </i></button>
                    </div>
                    <div className="post-info">
                      <div className="post-price">
                        <i className="fas fa-gift"></i> Desde:{" "}
                        {profile.priceHour} {profile.currency || "USD"}
                      </div>
                      <div className="post-caption">
                        <span className="post-username">
                          {profile.displayName}
                        </span>{" "}
                        <span className="post-description">
                          {profile.shortDescription ||
                            profile.description?.substring(0, 100)}
                          {profile.description?.length > 100 ? "..." : ""}
                        </span>
                      </div>
                      {profile.services && profile.services.length > 0 && (
                        <div className="post-tags">
                          {profile.services.slice(0, 3).map((service, idx) => (
                            <span key={idx} className="post-tag">
                              #{typeof service === "string"
                                ? service.replace(/\s+/g, "")
                                : service}
                            </span>
                          ))}
                          {profile.services.length > 3 && (
                            <span className="post-tag">
                              +{profile.services.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                      <div
                        className="post-view-more"
                        onClick={() => handleProfileClick(profile.id)}
                      >
                        Ver todos los detalles
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
            {profiles.length > 0 && pagination.totalPages > 1 && (
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
      </div>

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

      {showModal && selectedProfile && (
        <ProfileFullScreen
          profile={selectedProfile}
          onClose={handleCloseModal}
          userLoggedIn={userLoggedIn}
          setMenu={setMenu}
          appConfig={appConfig}
        />
      )}
    </div>
  );
};

export default ProfileGrid;