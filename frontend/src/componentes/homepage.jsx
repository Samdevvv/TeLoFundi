import React, { useState } from "react";
import "../estilos/homepage.css";
import chica1 from "../assets/imagen chica 1.jpg";
import chica2 from "../assets/chica 2.jpg";
import chica3 from "../assets/chica 3.jpg";
import "../estilos/Header.css";
import Header from "./Header";

const users = [
  {
    id: 1,
    name: "Sofía Martínez",
    age: 26,
    location: "Madrid, España",
    photo: chica1,
    description:
      "Amante de los viajes y la buena música. Busco nuevas experiencias y conversaciones interesantes.",
  },
  {
    id: 2,
    name: "Carlos Rodríguez",
    age: 29,
    location: "Ciudad de México, México",
    photo: chica2,
    description:
      "Amante del cine y la tecnología. Me encanta explorar nuevos lugares y conocer gente nueva.",
  },
  {
    id: 3,
    name: "Laura Pérez",
    age: 24,
    location: "Buenos Aires, Argentina",
    photo: chica3,
    description:
      "Me encanta el arte, la fotografía y la aventura. Busco alguien con quien compartir momentos únicos.",
  },
  {
    id: 1,
    name: "Sofía Martínez",
    age: 26,
    location: "Madrid, España",
    photo: chica1,
    description:
      "Amante de los viajes y la buena música. Busco nuevas experiencias y conversaciones interesantes.",
  },
  {
    id: 2,
    name: "Carlos Rodríguez",
    age: 29,
    location: "Ciudad de México, México",
    photo: chica2,
    description:
      "Amante del cine y la tecnología. Me encanta explorar nuevos lugares y conocer gente nueva.",
  },
  {
    id: 3,
    name: "Laura Pérez",
    age: 24,
    location: "Buenos Aires, Argentina",
    photo: chica3,
    description:
      "Me encanta el arte, la fotografía y la aventura. Busco alguien con quien compartir momentos únicos.",
  },
];

const HomePage = ({ setMenu, userLoggedIn, handleLogout }) => {
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

  return (
    <div className="page-container">
      <Header onNavigate={setMenu} userLoggedIn={userLoggedIn} handleLogout={handleLogout} />

      <main className="main-content">
        <div className="search-container">
          <div className="search-box">
            <input
              type="text"
              placeholder="Buscar personas..."
              className="search-input"
              onClick={openFiltersModal}
              readOnly
            />
            <button className="search-button" onClick={openFiltersModal}>
              🔍
            </button>
          </div>
        </div>

        {/* Modal de Filtros Mejorado */}
        {showFiltersModal && (
          <div className="modal-overlay" onClick={closeFiltersModal}>
            <div className="filters-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3 className="Titulo-Busqueda">Búsqueda avanzada</h3>
                <button className="close-modal" onClick={closeFiltersModal}>
                  ×
                </button>
              </div>

              <div className="modal-search">
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="modal-search-input"
                />
              </div>

              <div className="filters-container-modal">
                <div className="filter-group">
                  <label>Edad</label>
                  <div className="range-inputs">
                    <input
                      type="number"
                      placeholder="Min"
                      min="18"
                      max="100"
                      className="range-input"
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder="Max"
                      min="18"
                      max="100"
                      className="range-input"
                    />
                  </div>
                </div>

                <div className="filter-group">
                  <label>Ubicación</label>
                  <select className="filter-select">
                    <option value="">Todas las ubicaciones</option>
                    <option value="España">España</option>
                    <option value="México">México</option>
                    <option value="Argentina">Argentina</option>
                    <option value="Colombia">Colombia</option>
                    <option value="Chile">Chile</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label>Sexo</label>
                  <select className="filter-select">
                    <option value="">Todos</option>
                    <option value="Hombre">Hombre</option>
                    <option value="Mujer">Mujer</option>
                    <option value="No binario">No binario</option>
                  </select>
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

        <div className="cards-container">
          {users.map((user) => (
            <div key={user.id} className="user-card">
              <img src={user.photo} alt={user.name} className="user-photo" />
              <div className="user-info">
                <h3>
                  {user.name}, {user.age}
                </h3>
                <p className="location">{user.location}</p>
                <p className="description">{user.description}</p>
                <div className="buttons">
                  <button className="profile">Ver Perfil</button>
                  <button className="chat">Chat</button>
                  <button className="like">❤️</button>
                  <button className="fire">🔥</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="footer">
        <div className="footer-content">
          © 2025 LoveConnect - Encuentra a tu persona especial
        </div>
      </footer>
    </div>
  );
};

export default HomePage;