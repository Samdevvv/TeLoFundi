import { useState } from "react";
import { FaUser, FaLock } from 'react-icons/fa';
import PasswordStrengthBar from 'react-password-strength-bar';
import "../estilos/registr.css";

const Registro = (props) => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [email, setEmail] = useState("");
    const [isEmailFocused, setIsEmailFocused] = useState(false);
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

    const handleFocus = (input) => {
        if (input === 'email') setIsEmailFocused(true);
        else if (input === 'password') setIsPasswordFocused(true);
        else setIsConfirmPasswordFocused(true);
    };

    const handleBlur = (input) => {
        if (input === 'email') setIsEmailFocused(false);
        else if (input === 'password') setIsPasswordFocused(false);
        else setIsConfirmPasswordFocused(false);
    };

    return (
        <div className="login-container">
            <div className="login-right">
                <form className="login-form">
                    <h2 className="login-title">Crea tu cuenta</h2>
                    <p className="login-subtitle">Ingresa tus datos para registrarte</p>

                    <div className={`input-box ${email || isEmailFocused ? 'filled' : ''}`}>
                        <FaUser className="input-icon" />
                        <input
                            type="email"
                            id="email"
                            className="form-control"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            onFocus={() => handleFocus('email')}
                            onBlur={() => handleBlur('email')}
                        />
                        <label htmlFor="email">Correo Electrónico</label>
                    </div>

                    <div className={`input-box ${password || isPasswordFocused ? 'filled' : ''}`}>
                        <FaLock className="input-icon" />
                        <input
                            type="password"
                            id="password"
                            className="form-control"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            onFocus={() => handleFocus('password')}
                            onBlur={() => handleBlur('password')}
                        />
                        <label htmlFor="password">Contraseña</label>
                    </div>

                    <div className={`input-box ${confirmPassword || isConfirmPasswordFocused ? 'filled' : ''}`}>
                        <FaLock className="input-icon" />
                        <input
                            type="password"
                            id="confirm-password"
                            className="form-control"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            onFocus={() => handleFocus('confirm-password')}
                            onBlur={() => handleBlur('confirm-password')}
                        />
                        <label htmlFor="confirm-password">Confirmar Contraseña</label>
                    </div>

                    <div style={{ marginTop: "-10px", marginBottom: "20px" }}>
                        <PasswordStrengthBar
                            password={password}
                            scoreWords={["Un tollo de clave", "mmg", "ta jevi", "sipi", "Muy duro"]}
                            shortScoreWord="Muy débil"
                        />
                    </div>

                    <select className="form-control custom-select" defaultValue="">
                        <option value="" hidden>Seleccione su tipo de Usuario</option>
                        <option value="profesor">Un loco</option>
                        <option value="administrador">Administrador</option>
                    </select>

                    <button className="login-button">Regístrate</button>

                    <div className="login-footer">
                        ¿Ya tienes cuenta?
                        <button onClick={() => props.setMenu("login")}>
                            Inicia Sesion!
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Registro;
