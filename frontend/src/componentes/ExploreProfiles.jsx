// src/componentes/ExploreProfiles.jsx
import React from 'react';
import Header from './Header';
import ProfileGrid from './ProfileGrid';
import '../estilos/ExploreProfiles.css';

const ExploreProfiles = ({ setMenu, userLoggedIn, handleLogout, appConfig }) => {
  return (
    <div className="explore-profiles-page">
      <Header 
        onNavigate={setMenu} 
        userLoggedIn={userLoggedIn} 
        handleLogout={handleLogout} 
      />
      <div className="explore-profiles-content">

        <ProfileGrid 
          setMenu={setMenu} 
          userLoggedIn={userLoggedIn}
          appConfig={appConfig}
        />
      </div>
    </div>
  );
};

export default ExploreProfiles;