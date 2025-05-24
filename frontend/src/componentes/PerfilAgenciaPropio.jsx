import React, { useState, useEffect } from 'react';
import { FaMapMarkerAlt, FaCalendarAlt, FaBuilding, FaEnvelope, FaPhone, FaInstagram, FaTwitter, FaFacebook, FaWhatsapp, FaEdit, FaUserPlus, FaFileContract } from 'react-icons/fa';
import '../estilos/PerfilAgencia.css';
import '../estilos/Header.css';
import Header from './Header';
import defaultProfilePic from '../assets/perfil agencia.png';

const PerfilAgenciaPropio = ({ userData = {}, onUpdateProfile, setMenu }) => {
  const [activeTab, setActiveTab] = useState('informacion');
  const [isEditing, setIsEditing] = useState(false);
  const [isOwnProfile] = useState(true);
  const [contractForm, setContractForm] = useState({
    escort: '',
    client: '',
    date: '',
    duration: '',
    rate: '',
    status: 'pending'
  });
  const [contracts, setContracts] = useState([
    {
      id: 1,
      escort: 'Maria Gomez',
      client: 'Cliente VIP 1',
      date: '2025-06-01',
      duration: '3 horas',
      rate: 'RD$1500',
      status: 'confirmed'
    },
    {
      id: 2,
      escort: 'Juan Perez',
      client: 'Cliente VIP 2',
      date: '2025-06-05',
      duration: '5 horas',
      rate: 'RD$2500',
      status: 'pending'
    }
  ]);

  const defaultData = {
    agencia: {
      nombre: "Elite Companions",
      ubicacion: "Santo Domingo, República Dominicana",
      fotoPerfil: "https://via.placeholder.com/150",
      descripcion: "Agencia premium ofreciendo servicios de acompañamiento de alto nivel.",
      telefono: "+1 809-555-1234",
      email: "contacto@elitecompanions.com",
      fechaRegistro: "Mayo 2025",
      servicios: ["Eventos exclusivos", "Cenas privadas", "Viajes internacionales"],
      horarioAtencion: "Lunes a Sábado: 9:00 - 20:00",
      redes: {
        instagram: "elite_companions",
        twitter: "elitecomp",
        facebook: "elitecompanions"
      },
      acompanantes: [
        { nombre: "Maria Gomez", edad: 28, genero: "Femenino", foto: "https://via.placeholder.com/200" },
        { nombre: "Juan Perez", edad: 32, genero: "Masculino", foto: "https://via.placeholder.com/200" },
        { nombre: "Sofia Martinez", edad: 25, genero: "Femenino", foto: "https://via.placeholder.com/200" }
      ]
    }
  };

  const profileData = userData && userData.nombre ? userData : defaultData.agencia;
  
  const safeProfileData = {
    ...profileData,
    servicios: Array.isArray(profileData.servicios) ? profileData.servicios : [],
    acompanantes: Array.isArray(profileData.acompanantes) ? profileData.acompanantes : [],
    redes: profileData.redes || { instagram: '', twitter: '', facebook: '' }
  };

  const [formData, setFormData] = useState(safeProfileData);

  useEffect(() => {
    const updatedProfileData = userData && userData.nombre ? userData : defaultData.agencia;
    const updatedSafeProfileData = {
      ...updatedProfileData,
      servicios: Array.isArray(updatedProfileData.servicios) ? updatedProfileData.servicios : [],
      acompanantes: Array.isArray(updatedProfileData.acompanantes) ? updatedProfileData.acompanantes : [],
      redes: updatedProfileData.redes || { instagram: '', twitter: '', facebook: '' }
    };
    setFormData(updatedSafeProfileData);
  }, [userData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleRedesChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, redes: { ...formData.redes, [name]: value } });
  };

  const handleSubmit = () => {
    onUpdateProfile && onUpdateProfile(formData);
    setIsEditing(false);
  };

  const handleContractChange = (e) => {
    const { name, value } = e.target;
    setContractForm({ ...contractForm, [name]: value });
  };

  const handleContractSubmit = (e) => {
    e.preventDefault();
    const newContract = {
      id: contracts.length + 1,
      ...contractForm
    };
    setContracts([...contracts, newContract]);
    setContractForm({
      escort: '',
      client: '',
      date: '',
      duration: '',
      rate: '',
      status: 'pending'
    });
  };

  const handleContractEdit = (contractId) => {
    const contract = contracts.find(c => c.id === contractId);
    setContractForm({ ...contract });
    setContracts(contracts.filter(c => c.id !== contractId));
  };

  const handleContractDelete = (contractId) => {
    setContracts(contracts.filter(c => c.id !== contractId));
  };

  const whatsappNumber = formData.telefono ? formData.telefono.replace(/\D/g, '') : '';
  const whatsappLink = `https://wa.me/${whatsappNumber}`;

  return (
    <div className="perfil-container">
      <Header setMenu={setMenu} userLoggedIn={true} handleLogout={() => {
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setMenu("mainpage");
      }} />
      <div className="perfil-content">
        <div className="perfil-header">
          <div className="perfil-foto-container">
            <img
              src={formData.fotoPerfil || defaultProfilePic}
              alt={formData.nombre || "Perfil Agencia"}
              className="perfil-foto"
            />
            {isEditing && (
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setFormData({ ...formData, fotoPerfil: URL.createObjectURL(e.target.files[0]) })}
                className="perfil-foto-upload"
              />
            )}
          </div>
          <div className="perfil-info-header">
            <div className="perfil-name-buttons">
              {isEditing ? (
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre || ""}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : (
                <h1>{formData.nombre || ""}</h1>
              )}
              {isOwnProfile && (
                <button
                  className="btn-editar-perfil"
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <FaEdit /> {isEditing ? 'Cancelar' : 'Editar Perfil'}
                </button>
              )}
            </div>
            <p className="perfil-ubicacion">
              <FaMapMarkerAlt />
              {isEditing ? (
                <input
                  type="text"
                  name="ubicacion"
                  value={formData.ubicacion || ""}
                  onChange={handleInputChange}
                  className="perfil-edit-input"
                />
              ) : (
                formData.ubicacion || ""
              )}
            </p>
            <div className="perfil-contact-icons">
              {formData.redes?.instagram && (
                <a href={`https://instagram.com/${formData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                  <FaInstagram className="contact-icon instagram" />
                </a>
              )}
              {formData.telefono && (
                <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  <FaWhatsapp className="contact-icon whatsapp" />
                </a>
              )}
            </div>
            <div className="perfil-datos-rapidos">
              <span><FaBuilding /> Agencia</span>
              <span><FaCalendarAlt /> Desde {formData.fechaRegistro || "No especificado"}</span>
            </div>
          </div>
        </div>

        <div className="perfil-tabs">
          <button
            className={`perfil-tab ${activeTab === 'informacion' ? 'active' : ''}`}
            onClick={() => setActiveTab('informacion')}
          >
            Información
          </button>
          <button
            className={`perfil-tab ${activeTab === 'acompanantes' ? 'active' : ''}`}
            onClick={() => setActiveTab('acompanantes')}
          >
            Acompañantes
          </button>
          <button
            className={`perfil-tab ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={`perfil-tab ${activeTab === 'contracts' ? 'active' : ''}`}
            onClick={() => setActiveTab('contracts')}
          >
            Contratos
          </button>
        </div>

        <div className="perfil-tab-content">
          {activeTab === 'informacion' && (
            <div className="perfil-informacion">
              <div className="perfil-seccion perfil-sobre-mi">
                <h3>Sobre Nosotros</h3>
                {isEditing ? (
                  <textarea
                    name="descripcion"
                    value={formData.descripcion || ""}
                    onChange={handleInputChange}
                    className="perfil-edit-textarea"
                  />
                ) : (
                  <p>{formData.descripcion || ""}</p>
                )}
              </div>

              <div className="perfil-seccion perfil-detalles">
                <h3>Detalles</h3>
                <div className="perfil-detalles-content">
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Horario de Atención:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="horarioAtencion"
                        value={formData.horarioAtencion || ""}
                        onChange={handleInputChange}
                        className="perfil-edit-input"
                      />
                    ) : (
                      <span>{formData.horarioAtencion || "No especificado"}</span>
                    )}
                  </div>
                  <div className="perfil-detalle-item">
                    <span className="detalle-label">Servicios:</span>
                    {isEditing ? (
                      <input
                        type="text"
                        name="servicios"
                        value={formData.servicios?.join(', ') || ""}
                        onChange={(e) => setFormData({ 
                          ...formData, 
                          servicios: e.target.value.split(', ').filter(serv => serv.trim())
                        })}
                        className="perfil-edit-input"
                      />
                    ) : (
                      <ul className="perfil-servicios-list">
                        {formData.servicios?.map((servicio, index) => (
                          <li key={index}>{servicio}</li>
                        ))}
                        {(!formData.servicios || formData.servicios.length === 0) && (
                          <li>No hay servicios especificados</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="perfil-seccion perfil-contacto">
                <h3>Información de Contacto</h3>
                <div className="perfil-contacto-info">
                  {isEditing ? (
                    <>
                      <div className="perfil-contacto-item">
                        <FaEnvelope className="perfil-contacto-icon" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email || ""}
                          onChange={handleInputChange}
                          className="perfil-edit-input"
                        />
                      </div>
                      <div className="perfil-contacto-item">
                        <FaPhone className="perfil-contacto-icon" />
                        <input
                          type="text"
                          name="telefono"
                          value={formData.telefono || ""}
                          onChange={handleInputChange}
                          className="perfil-edit-input"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      {formData.email && (
                        <div className="perfil-contacto-item">
                          <FaEnvelope className="perfil-contacto-icon" />
                          <span>{formData.email}</span>
                        </div>
                      )}
                      {formData.telefono && (
                        <div className="perfil-contacto-item">
                          <FaPhone className="perfil-contacto-icon" />
                          <span>{formData.telefono}</span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {formData.redes && (
                <div className="perfil-seccion perfil-redes">
                  <h3>Redes Sociales</h3>
                  {isEditing ? (
                    <div className="perfil-redes-sociales">
                      <input
                        type="text"
                        name="instagram"
                        value={formData.redes?.instagram || ""}
                        onChange={handleRedesChange}
                        placeholder="Instagram"
                        className="perfil-edit-input"
                      />
                      <input
                        type="text"
                        name="twitter"
                        value={formData.redes?.twitter || ""}
                        onChange={handleRedesChange}
                        placeholder="Twitter"
                        className="perfil-edit-input"
                      />
                      <input
                        type="text"
                        name="facebook"
                        value={formData.redes?.facebook || ""}
                        onChange={handleRedesChange}
                        placeholder="Facebook"
                        className="perfil-edit-input"
                      />
                    </div>
                  ) : (
                    <div className="perfil-redes-sociales">
                      {formData.redes?.instagram && (
                        <a href={`https://instagram.com/${formData.redes.instagram}`} target="_blank" rel="noopener noreferrer">
                          <FaInstagram className="red-social-icon instagram" />
                        </a>
                      )}
                      {formData.redes?.twitter && (
                        <a href={`https://twitter.com/${formData.redes.twitter}`} target="_blank" rel="noopener noreferrer">
                          <FaTwitter className="red-social-icon twitter" />
                        </a>
                      )}
                      {formData.redes?.facebook && (
                        <a href={`https://facebook.com/${formData.redes.facebook}`} target="_blank" rel="noopener noreferrer">
                          <FaFacebook className="red-social-icon facebook" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              )}

              {isEditing && (
                <div className="perfil-seccion">
                  <button onClick={handleSubmit} className="btn-unirse-agencia">
                    Guardar Cambios
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'acompanantes' && (
            <div className="perfil-acompanantes">
              {formData.acompanantes?.map((acompanante, index) => (
                <div className="perfil-acompanante-card" key={index}>
                  <img src={acompanante.foto || defaultProfilePic} alt={acompanante.nombre || "Acompañante"} />
                  <h4>{acompanante.nombre || ""}</h4>
                  <button className="btn-ver-perfil">Ver Perfil</button>
                </div>
              ))}
              {(!formData.acompanantes || formData.acompanantes.length === 0) && (
                <div>No hay acompañantes disponibles</div>
              )}
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="perfil-dashboard">
              <div className="perfil-seccion">
                <h3>Dashboard de Acompañantes</h3>
                <button className="btn-unirse-agencia" onClick={() => alert('Funcionalidad para añadir acompañante')}>
                  <FaUserPlus /> Añadir Acompañante
                </button>
                <div className="perfil-acompanantes">
                  {formData.acompanantes?.map((acompanante, index) => (
                    <div className="perfil-acompanante-card" key={index}>
                      <img src={acompanante.foto || defaultProfilePic} alt={acompanante.nombre || "Acompañante"} />
                      <h4>{acompanante.nombre || ""}</h4>
                      <p>Edad: {acompanante.edad || "No especificado"}</p>
                      <p>Género: {acompanante.genero || "No especificado"}</p>
                      <button className="btn-ver-perfil">Ver Perfil</button>
                      <button className="btn-editar-perfil" onClick={() => alert(`Editar perfil de ${acompanante.nombre}`)}>
                        <FaEdit /> Editar
                      </button>
                    </div>
                  ))}
                  {(!formData.acompanantes || formData.acompanantes.length === 0) && (
                    <div>No hay acompañantes disponibles</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contracts' && (
            <div className="perfil-contracts">
              <div className="perfil-seccion">
                <h3>Administración de Contratos</h3>
                <form onSubmit={handleContractSubmit} className="contract-form">
                  <div className="contract-form-row">
                    <div className="contract-form-group">
                      <label>Acompañante</label>
                      <select
                        name="escort"
                        value={contractForm.escort}
                        onChange={handleContractChange}
                        required
                      >
                        <option value="">Selecciona un acompañante</option>
                        {formData.acompanantes.map((acompanante, index) => (
                          <option key={index} value={acompanante.nombre}>
                            {acompanante.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="contract-form-group">
                      <label>Cliente</label>
                      <input
                        type="text"
                        name="client"
                        value={contractForm.client}
                        onChange={handleContractChange}
                        placeholder="Nombre del cliente"
                        required
                      />
                    </div>
                  </div>
                  <div className="contract-form-row">
                    <div className="contract-form-group">
                      <label>Fecha</label>
                      <input
                        type="date"
                        name="date"
                        value={contractForm.date}
                        onChange={handleContractChange}
                        required
                      />
                    </div>
                    <div className="contract-form-group">
                      <label>Duración</label>
                      <input
                        type="text"
                        name="duration"
                        value={contractForm.duration}
                        onChange={handleContractChange}
                        placeholder="Ej. 3 horas"
                        required
                      />
                    </div>
                  </div>
                  <div className="contract-form-row">
                    <div className="contract-form-group">
                      <label>Tarifa</label>
                      <input
                        type="text"
                        name="rate"
                        value={contractForm.rate}
                        onChange={handleContractChange}
                        placeholder="Ej. RD$1500"
                        required
                      />
                    </div>
                    <div className="contract-form-group">
                      <label>Estado</label>
                      <select
                        name="status"
                        value={contractForm.status}
                        onChange={handleContractChange}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="completed">Completado</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn-unirse-agencia">
                    <FaFileContract /> {contractForm.id ? 'Actualizar Contrato' : 'Añadir Contrato'}
                  </button>
                </form>
              </div>
              <div className="perfil-seccion">
                <h3>Lista de Contratos</h3>
                <div className="contract-list">
                  {contracts.map((contract) => (
                    <div key={contract.id} className="contract-item">
                      <div className="contract-details">
                        <span><strong>Acompañante:</strong> {contract.escort}</span>
                        <span><strong>Cliente:</strong> {contract.client}</span>
                        <span><strong>Fecha:</strong> {contract.date}</span>
                        <span><strong>Duración:</strong> {contract.duration}</span>
                        <span><strong>Tarifa:</strong> {contract.rate}</span>
                        <span><strong>Estado:</strong> {contract.status}</span>
                      </div>
                      <div className="contract-actions">
                        <button
                          className="btn-editar-perfil"
                          onClick={() => handleContractEdit(contract.id)}
                        >
                          <FaEdit /> Editar
                        </button>
                        <button
                          className="btn-ver-perfil"
                          onClick={() => handleContractDelete(contract.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                  {contracts.length === 0 && <p>No hay contratos disponibles.</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerfilAgenciaPropio;