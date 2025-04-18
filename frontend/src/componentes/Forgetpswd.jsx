import { useState } from "react";
import { FaEnvelope } from "react-icons/fa";
import "../estilos/forgetpsw.css";

const ForgetPsw = (props) => {
  const [email, setEmail] = useState("");

  return (
    <div className="">
      <div className="form-container">
        <div className="logo-container">Olvidé mi contraseña</div>

        <form className="form">
          <div className="input-box">
            <input
              type="email"
              id="email"
              name="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`form-control ${email ? "filled" : ""}`}
            />
            <label htmlFor="email">Correo Electrónico</label>
            <FaEnvelope className="input-icon" />
          </div>

          <button className="form-submit-btn" type="submit">
            Enviar
          </button>
        </form>

        <p className="signup-link">
          ¿Ya tienes cuenta?
          <button
            className="link"
            type="button"
            onClick={() => props.setMenu("login")}
          >
            Inicia sesión
          </button>
        </p>
      </div>
    </div>
  );
};

export default ForgetPsw;