import "../estilos/ageRestriction.css";
import loginImage from '../assets/logo png.png';

const AgeRestriction = ({ setMenu }) => {
  return (
    <div className="age-restriction-container">
      <div className="age-restriction-logo-container">
        <img src={loginImage} alt="Logo" className="age-restriction-logo-image" />
      </div>
      <p className="age-restriction-text">
        ESTE SITIO WEB ESTA DIRIGIDO SOLO A USUARIOS MAYORES DE 18 AÑOS
      </p>
      <button
        className="age-restriction-back-button"
        onClick={() => setMenu("mainpage")}
      >
        Volver
      </button>
    </div>
  );
};

export default AgeRestriction;