import React from 'react';
import "../estilos/homepage.css";

const users = [
    {
      id: 1,
      name: "Sofía Martínez",
      age: 26,
      location: "Madrid, España",
      photo: "https://randomuser.me/api/portraits/women/44.jpg",
      description: "Amante de los viajes y la buena música. Busco nuevas experiencias y conversaciones interesantes."
    },
    {
      id: 2,
      name: "Carlos Rodríguez",
      age: 29,
      location: "Ciudad de México, México",
      photo: "https://randomuser.me/api/portraits/men/34.jpg",
      description: "Amante del cine y la tecnología. Me encanta explorar nuevos lugares y conocer gente nueva."
    },
    {
      id: 3,
      name: "Laura Pérez",
      age: 24,
      location: "Buenos Aires, Argentina",
      photo: "https://randomuser.me/api/portraits/women/28.jpg",
      description: "Me encanta el arte, la fotografía y la aventura. Busco alguien con quien compartir momentos únicos."
    }
  ];
  
  const App = () => {
    return (
      <div className="page-container">
        <header className="header">
          <span className="logo">❤️ LoveConnect</span>
          <nav className="nav">Inicio | Explorar | Contacto</nav>
          <div className="auth-buttons">
            <button className="login">Iniciar Sesión</button>
            <button className="signup">Registrarse</button>
          </div>
        </header>
        
        <main className="main-content">
          {users.map((user) => (
            <div key={user.id} className="user-card">
              <img src={user.photo} alt={user.name} className="user-photo" />
              <div className="user-info">
                <h3>{user.name}, {user.age}</h3>
                <p>{user.location}</p>
                <p>{user.description}</p>
                <div className="buttons">
                  <button className="profile">Ver Perfil</button>
                  <button className="chat">Chat</button>
                  <button className="like">❤️</button>
                  <button className="fire">🔥</button>
                </div>
              </div>
            </div>
          ))}
        </main>
        
        <footer className="footer">© 2025 LoveConnect - Encuentra a tu persona especial</footer>
      </div>
    );
  };
  
  export default App;