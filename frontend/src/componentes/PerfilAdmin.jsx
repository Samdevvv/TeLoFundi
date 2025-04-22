import React, { useState } from 'react';
import { FaUsers, FaBuilding, FaCog, FaEnvelope, FaBan, FaEdit } from 'react-icons/fa';
import '../estilos/PerfilAdmin.css';
import '../estilos/Header.css';
import Header from './Header';

const PerfilAdmin = ({ onManageUsers, onManageAgencies, onManageSettings }) => {
  const [activeTab, setActiveTab] = useState('usuarios');
  const [users, setUsers] = useState([
    { id: 1, nombre: "Sofía Martínez", tipo: "Cliente", email: "sofia@example.com", estado: "Activo" },
    { id: 2, nombre: "Carlos Rodríguez", tipo: "Acompañante", email: "carlos@example.com", estado: "Activo" },
  ]);
  const [agencies, setAgencies] = useState([
    { id: 1, nombre: "Élite Acompañantes", ubicacion: "Barcelona, España", email: "contacto@eliteacompanantes.com", estado: "Activo" },
  ]);

  const handleBanUser = (userId) => {
    setUsers(users.map(user => user.id === userId ? { ...user, estado: user.estado === "Activo" ? "Baneado" : "Activo" } : user));
  };

  const handleBanAgency = (agencyId) => {
    setAgencies(agencies.map(agency => agency.id === agencyId ? { ...agency, estado: agency.estado === "Activo" ? "Baneada" : "Activo" } : agency));
  };

  return (
    <div className="perfil-container">
      <Header />
      <div className="perfil-content">
        <div className="perfil-header">
          <h1>Panel de Administración</h1>
        </div>

        <div className="perfil-tabs">
          <button
            className={`perfil-tab ${activeTab === 'usuarios' ? 'active' : ''}`}
            onClick={() => setActiveTab('usuarios')}
          >
            Usuarios
          </button>
          <button
            className={`perfil-tab ${activeTab === 'agencias' ? 'active' : ''}`}
            onClick={() => setActiveTab('agencias')}
          >
            Agencias
          </button>
          <button
            className={`perfil-tab ${activeTab === 'configuraciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('configuraciones')}
          >
            Configuraciones
          </button>
        </div>

        <div className="perfil-tab-content">
          {activeTab === 'usuarios' && (
            <div className="admin-usuarios">
              <h3>Gestión de Usuarios</h3>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Tipo</th>
                      <th>Email</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>{user.nombre}</td>
                        <td>{user.tipo}</td>
                        <td>{user.email}</td>
                        <td>{user.estado}</td>
                        <td>
                          <button className="admin-action-btn" onClick={() => onManageUsers(user, 'edit')}>
                            <FaEdit /> Editar
                          </button>
                          <button className="admin-action-btn" onClick={() => handleBanUser(user.id)}>
                            <FaBan /> {user.estado === "Activo" ? "Banear" : "Desbanear"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'agencias' && (
            <div className="admin-agencias">
              <h3>Gestión de Agencias</h3>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Ubicación</th>
                      <th>Email</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map(agency => (
                      <tr key={agency.id}>
                        <td>{agency.nombre}</td>
                        <td>{agency.ubicacion}</td>
                        <td>{agency.email}</td>
                        <td>{agency.estado}</td>
                        <td>
                          <button className="admin-action-btn" onClick={() => onManageAgencies(agency, 'edit')}>
                            <FaEdit /> Editar
                          </button>
                          <button className="admin-action-btn" onClick={() => handleBanAgency(agency.id)}>
                            <FaBan /> {agency.estado === "Activo" ? "Banear" : "Desbanear"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'configuraciones' && (
            <div className="admin-configuraciones">
              <h3>Configuraciones del Sistema</h3>
              <div className="admin-config-form">
                <div className="admin-config-item">
                  <label>Notificaciones por Email</label>
                  <input type="checkbox" onChange={(e) => onManageSettings({ emailNotifications: e.target.checked })} />
                </div>
                <div className="admin-config-item">
                  <label>Límite de Usuarios</label>
                  <input type="number" onChange={(e) => onManageSettings({ userLimit: e.target.value })} />
                </div>
                <button className="admin-save-btn" onClick={() => onManageSettings()}>
                  Guardar Configuraciones
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PerfilAdmin;