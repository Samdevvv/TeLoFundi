import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaUser, FaEnvelope, FaPhone, FaGlobe, FaInstagram, FaTwitter, FaFacebook, FaBuilding } from 'react-icons/fa';
import '../estilos/Perfil.css';
import Header from './Header'; // Asumiendo que tienes un componente Header separado
import defaultProfilePic from '../assets/logo png.png'; // Imagen por defecto
import loginImage from '../assets/logo png.png'; // Asegúrate de que la ruta sea correcta


const Perfil = ({ userType = "acompanante", userData = {} }) => {
  // Estado para manejar las pestañas del perfil
  const [activeTab, setActiveTab] = useState('informacion');
  
  // Estado para manejar si es el perfil propio o de otro usuario
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  
  // Datos de ejemplo (reemplazarías esto con datos reales)
  const defaultData = {
    acompanante: {
      nombre: "Laura Martínez",
      ubicacion: "Madrid, España",
      fotoPerfil: defaultProfilePic,
      edad: 28,
      genero: "Femenino",
      descripcion: "Hola, soy Laura. Me encanta viajar y conocer nuevas culturas. Soy una acompañante profesional con experiencia en eventos sociales y corporativos.",
      telefono: "+34 612 345 678",
      email: "laura@example.com",
      fechaRegistro: "Enero 2023",
      servicios: ["Eventos sociales", "Cenas de negocios", "Turismo"],
      disponibilidad: "Lunes a Sábado",
      idiomas: ["Español", "Inglés", "Francés"],
      redes: {
        instagram: "laura_martinez",
        twitter: "lauram",
        facebook: "lauramartinez"
      },
      galeria: [defaultProfilePic, defaultProfilePic, defaultProfilePic, defaultProfilePic, defaultProfilePic, defaultProfilePic]
    },
    agencia: {
      nombre: "Élite Acompañantes",
      ubicacion: "Barcelona, España",
      fotoPerfil: defaultProfilePic,
      descripcion: "Agencia premium especializada en servicios de acompañamiento para eventos de alto nivel. Contamos con los mejores profesionales del sector.",
      telefono: "+34 913 456 789",
      email: "contacto@eliteacompanantes.com",
      fechaRegistro: "Marzo 2022",
      servicios: ["Eventos corporativos", "Galas benéficas", "Congresos internacionales"],
      horarioAtencion: "Lunes a Viernes: 9:00 - 18:00",
      redes: {
        instagram: "elite_acompanantes",
        twitter: "eliteacomp",
        facebook: "eliteacompanantes"
      },
      acompanantes: [
        { nombre: "Sara López", foto: defaultProfilePic },
        { nombre: "Carlos Ruiz", foto: defaultProfilePic },
        { nombre: "Ana Belén", foto: defaultProfilePic }
      ],
      galeria: [defaultProfilePic, defaultProfilePic, defaultProfilePic, defaultProfilePic]
    },
    cliente: {
      nombre: "Miguel Ángel Fernández",
      ubicacion: "Valencia, España",
      fotoPerfil: defaultProfilePic,
      email: "miguel@example.com",
      fechaRegistro: "Junio 2023",
      descripcion: "Empresario del sector tecnológico. Busco acompañantes para eventos corporativos y conferencias internacionales.",
      preferencias: ["Eventos corporativos", "Conversación inteligente", "Conocimiento de tecnología"],
      eventosRecientes: 5
    }
  };
  
  // Usar datos pasados como prop, o los datos de ejemplo si no hay datos
  const profileData = userData.nombre ? userData : defaultData[userType];

  // Efecto para determinar si es el perfil propio (simulado)
  useEffect(() => {
    // Aquí podrías comparar con el ID del usuario logueado
    // Para el ejemplo, lo definimos como falso
    setIsOwnProfile(false);
  }, []);

  return (
    <div className="perfil-container">
      <Header />
      
      <div className="perfil-content">
        <div className="perfil-header">
          <div className="perfil-foto-container">
            <img 
              src={profileData.fotoPerfil} 
              alt={profileData.nombre} 
              className="perfil-foto"
            />
          </div>
          <div className="perfil-info-header">
            <div className="perfil-name-buttons">
              <h1>{profileData.nombre}</h1>
              {!isOwnProfile && (
                <div className="perfil-action-buttons">
                  <button className="btn-contactar">Contactar</button>
                  <button className="btn-favorito">Favorito</button>
                </div>
              )}
              {isOwnProfile && (
                <button className="btn-editar-perfil">Editar Perfil</button>
              )}
            </div>
            <p className="perfil-ubicacion">
              <FaMapMarkerAlt /> {profileData.ubicacion}
            </p>
            {userType === "acompanante" && (
              <div className="perfil-datos-rapidos">
                <span><FaUser /> {profileData.edad} años</span>
                <span>{profileData.genero}</span>
                <span><FaGlobe /> {profileData.idiomas && profileData.idiomas.join(', ')}</span>
              </div>
            )}
            {userType === "agencia" && (
              <div className="perfil-datos-rapidos">
                <span><FaBuilding /> Agencia</span>
                <span><FaCalendarAlt /> Desde {profileData.fechaRegistro}</span>
              </div>
            )}
            {userType === "cliente" && (
              <div className="perfil-datos-rapidos">
                <span><FaUser /> Cliente</span>
                <span><FaCalendarAlt /> Miembro desde {profileData.fechaRegistro}</span>
                <span>{profileData.eventosRecientes} eventos recientes</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="perfil-tabs">
          <button 
            className={`perfil-tab ${activeTab === 'informacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('informacion')}
          >
            Información
          </button>
          {(userType === "acompanante" || userType === "agencia") && (
            <button 
              className={`perfil-tab ${activeTab === 'galeria' ? 'active' : ''}`}
              onClick={() => setActiveTab('galeria')}
            >
              Galería
            </button>
          )}
          {userType === "agencia" && (
            <button 
              className={`perfil-tab ${activeTab === 'acompanantes' ? 'active' : ''}`}
              onClick={() => setActiveTab('acompanantes')}
            >
              Acompañantes
            </button>
          )}
          {userType === "cliente" && (
            <button 
              className={`perfil-tab ${activeTab === 'preferencias' ? 'active' : ''}`}
              onClick={() => setActiveTab('preferencias')}
            >
              Preferencias
            </button>
          )}
        </div>
        
        <div className="perfil-tab-content">
          {/* Contenido de la pestaña de Información */}
          {activeTab === 'informacion' && (
            <div className="perfil-informacion">
              <div className="perfil-seccion">
                <h3>Sobre {userType === "cliente" ? "mí" : userType === "agencia" ? "nosotros" : "mí"}</h3>
                <p>{profileData.descripcion}</p>
              </div>
              
              {(userType === "acompanante" || userType === "agencia") && (
                <div className="perfil-seccion">
                  <h3>Servicios</h3>
                  <ul className="perfil-servicios-list">
                    {profileData.servicios && profileData.servicios.map((servicio, index) => (
                      <li key={index}>{servicio}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {userType === "acompanante" && (
                <div className="perfil-seccion">
                  <h3>Disponibilidad</h3>
                  <p>{profileData.disponibilidad}</p>
                </div>
              )}
              
              {userType === "agencia" && (
                <div className="perfil-seccion">
                  <h3>Horario de Atención</h3>
                  <p>{profileData.horarioAtencion}</p>
                </div>
              )}
              
              {userType === "cliente" && profileData.preferencias && (
                <div className="perfil-seccion">
                  <h3>Preferencias</h3>
                  <ul className="perfil-preferencias-list">
                    {profileData.preferencias.map((preferencia, index) => (
                      <li key={index}>{preferencia}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="perfil-seccion">
                <h3>Información de Contacto</h3>
                <div className="perfil-contacto-info">
                  {profileData.email && (
                    <div className="perfil-contacto-item">
                      <FaEnvelope className="perfil-contacto-icon" />
                      <span>{profileData.email}</span>
                    </div>
                  )}
                  {profileData.telefono && (
                    <div className="perfil-contacto-item">
                      <FaPhone className="perfil-contacto-icon" />
                      <span>{profileData.telefono}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {(userType === "acompanante" || userType === "agencia") && profileData.redes && (
                <div className="perfil-seccion">
                  <h3>Redes Sociales</h3>
                  <div className="perfil-redes-sociales">
                    {profileData.redes.instagram && (
                      <a href={`https://instagram.com/${profileData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                        <FaInstagram className="red-social-icon instagram" />
                      </a>
                    )}
                    {profileData.redes.twitter && (
                      <a href={`https://twitter.com/${profileData.redes.twitter}`} target="_blank" rel="noopener noreferrer">
                        <FaTwitter className="red-social-icon twitter" />
                      </a>
                    )}
                    {profileData.redes.facebook && (
                      <a href={`https://facebook.com/${profileData.redes.facebook}`} target="_blank" rel="noopener noreferrer">
                        <FaFacebook className="red-social-icon facebook" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* Contenido de la pestaña de Galería */}
          {activeTab === 'galeria' && (userType === "acompanante" || userType === "agencia") && (
            <div className="perfil-galeria">
              {profileData.galeria && profileData.galeria.map((imagen, index) => (
                <div className="perfil-galeria-item" key={index}>
                  <img src={imagen} alt={`Imagen ${index + 1}`} />
                </div>
              ))}
            </div>
          )}
          
          {/* Contenido de la pestaña de Acompañantes (solo para agencias) */}
          {activeTab === 'acompanantes' && userType === "agencia" && (
            <div className="perfil-acompanantes">
              {profileData.acompanantes && profileData.acompanantes.map((acompanante, index) => (
                <div className="perfil-acompanante-card" key={index}>
                  <img src={acompanante.foto} alt={acompanante.nombre} />
                  <h4>{acompanante.nombre}</h4>
                  <button className="btn-ver-perfil">Ver Perfil</button>
                </div>
              ))}
            </div>
          )}
          
          {/* Contenido de la pestaña de Preferencias (solo para clientes) */}
          {activeTab === 'preferencias' && userType === "cliente" && (
            <div className="perfil-preferencias">
              <div className="perfil-seccion">
                <h3>Mis Preferencias</h3>
                <ul className="perfil-preferencias-list">
                  {profileData.preferencias && profileData.preferencias.map((preferencia, index) => (
                    <li key={index}>{preferencia}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Perfil;