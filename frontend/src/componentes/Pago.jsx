import React, { useState } from 'react';
import { FaLock, FaCreditCard, FaUser, FaMapMarkerAlt, FaEnvelope, FaCity, FaArrowLeft } from 'react-icons/fa';
import '../estilos/Pago.css';

const PaymentPageV2 = ({ setMenu = () => {}, onLoginSuccess = () => {} }) => {
  const [formData, setFormData] = useState({
    cardNumber: '',
    expiry: '',
    cvc: '',
    name: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'República Dominicana'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [cardType, setCardType] = useState('');

  const formatCardNumber = (value) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const detectCardType = (number) => {
    const patterns = {
      visa: /^4/,
      mastercard: /^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[0-1]|2720)/,
      amex: /^3[47]/,
      discover: /^6011/,
      diners: /^3(?:0[0-5]|[68])/,
      maestro: /^(?:5[06-8]|6)/
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      if (pattern.test(number)) {
        return type;
      }
    }
    return '';
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    if (name === 'cardNumber') {
      formattedValue = formatCardNumber(value);
      const cleanNumber = value.replace(/\s/g, '');
      setCardType(detectCardType(cleanNumber));
    }

    setFormData(prev => ({
      ...prev,
      [name]: formattedValue
    }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Correo electrónico inválido';
    }
    
    if (!formData.cardNumber.replace(/\s/g, '').match(/^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})$/)) {
      newErrors.cardNumber = 'Número de tarjeta inválido';
    }
    
    if (!formData.expiry.match(/^(0[1-9]|1[0-2])\/\d{2}$/)) {
      newErrors.expiry = 'Fecha inválida (MM/AA)';
    }
    
    if (!formData.cvc.match(/^\d{3,4}$/)) {
      newErrors.cvc = 'CVC inválido';
    }
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nombre requerido';
    }
    
    if (!formData.address.trim()) {
      newErrors.address = 'Dirección requerida';
    }
    
    if (!formData.city.trim()) {
      newErrors.city = 'Ciudad requerida';
    }
    
    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'Código postal requerido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Retrieve temporary agency data
      const tempAgencyData = JSON.parse(localStorage.getItem("tempAgencyData") || "{}");
      if (tempAgencyData && tempAgencyData.tipoUsuario === "agencia") {
        // Simulate login after payment
        const userData = {
          ...tempAgencyData,
          nombre: tempAgencyData.username,
          tipoUsuario: "agencia",
          fotoPerfil: "https://via.placeholder.com/150",
          ubicacion: "Santo Domingo, República Dominicana",
          descripcion: "Agencia premium ofreciendo servicios de acompañamiento de alto nivel.",
          telefono: "+1 809-555-1234",
          email: tempAgencyData.email,
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
        };
        
        // Store user data and clear temporary data
        localStorage.setItem("user", JSON.stringify(userData));
        localStorage.setItem("accessToken", "mock-access-token");
        localStorage.setItem("refreshToken", "mock-refresh-token");
        localStorage.removeItem("tempAgencyData");
        
        // Trigger login success
        onLoginSuccess(userData);
        setMenu('perfilAgencia');
      } else {
        throw new Error("No se encontraron datos de registro de agencia.");
      }
    } catch (err) {
      setErrors({ general: err.message });
      console.error("Error al procesar el pago:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-page-container">
      <div className="payment-card-container">
        <div className="payment-form-wrapper">
          <div className="payment-form-section">
            <button
              className="payment-back-button"
              onClick={() => setMenu('mainpage')}
              type="button"
            >
              <FaArrowLeft size={16} />
            </button>

            <h2 className="payment-title">Detalles de Pago</h2>
            <p className="payment-subtitle">Completa tu información para activar tu cuenta de agencia</p>

            <div className="payment-form" onSubmit={handleSubmit}>
              <div className="payment-input-group">
                <label className="payment-label">Correo electrónico</label>
                <div className="payment-input-box">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    className={`payment-input ${errors.email ? 'error' : ''}`}
                    placeholder="tu@email.com"
                  />
                  <FaEnvelope className="payment-input-icon" />
                </div>
                {errors.email && <span className="payment-error">{errors.email}</span>}
              </div>

              <div className="payment-input-group">
                <label className="payment-label">Número de tarjeta</label>
                <div className="payment-input-box card-number-box">
                  <input
                    type="text"
                    name="cardNumber"
                    value={formData.cardNumber}
                    onChange={handleChange}
                    className={`payment-input ${errors.cardNumber ? 'error' : ''}`}
                    placeholder="1234 5678 9012 3456"
                    maxLength="19"
                  />
                  <div className="card-logos">
                    <svg width="40" height="25" viewBox="0 0 40 25" className={`card-logo ${cardType === 'visa' ? 'active' : ''}`}>
                      <rect width="40" height="25" rx="3" fill="#1434CB"/>
                      <text x="20" y="15" textAnchor="middle" fill="white" fontFamily="Arial" fontSize="12" fontWeight="bold" fontStyle="italic">VISA</text>
                    </svg>
                    <svg width="40" height="25" viewBox="0 0 40 25" className={`card-logo ${cardType === 'mastercard' ? 'active' : ''}`}>
                      <rect width="40" height="25" rx="3" fill="#EB001B"/>
                      <circle cx="15" cy="12.5" r="8" fill="#EB001B"/>
                      <circle cx="25" cy="12.5" r="8" fill="#F79E1B" fillOpacity="0.7"/>
                      <path d="M20 5.5C21.5 7 23 9 23.5 12.5C23 16 21.5 18 20 19.5C18.5 18 17 16 16.5 12.5C17 9 18.5 7 20 5.5Z" fill="#FF5F00"/>
                    </svg>
                    <svg width="40" height="25" viewBox="0 0 40 25" className={`card-logo ${cardType === 'amex' ? 'active' : ''}`}>
                      <rect width="40" height="25" rx="3" fill="#006FCF"/>
                      <text x="20" y="15" textAnchor="middle" fill="white" fontFamily="Arial" fontSize="9" fontWeight="bold">AMEX</text>
                    </svg>
                  </div>
                </div>
                {errors.cardNumber && <span className="payment-error">{errors.cardNumber}</span>}
              </div>

              <div className="payment-row">
                <div className="payment-input-group half">
                  <label className="payment-label">MM/AA</label>
                  <input
                    type="text"
                    name="expiry"
                    value={formData.expiry}
                    onChange={handleChange}
                    className={`payment-input ${errors.expiry ? 'error' : ''}`}
                    placeholder="02/27"
                    maxLength="5"
                  />
                  {errors.expiry && <span className="payment-error">{errors.expiry}</span>}
                </div>
                <div className="payment-input-group half">
                  <label className="payment-label">CVC</label>
                  <input
                    type="text"
                    name="cvc"
                    value={formData.cvc}
                    onChange={handleChange}
                    className={`payment-input ${errors.cvc ? 'error' : ''}`}
                    placeholder="123"
                    maxLength="4"
                  />
                  {errors.cvc && <span className="payment-error">{errors.cvc}</span>}
                </div>
              </div>

              <div className="payment-input-group">
                <label className="payment-label">Nombre del titular</label>
                <div className="payment-input-box">
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    className={`payment-input ${errors.name ? 'error' : ''}`}
                    placeholder="Nombre en la tarjeta"
                  />
                  <FaUser className="payment-input-icon" />
                </div>
                {errors.name && <span className="payment-error">{errors.name}</span>}
              </div>

              <div className="payment-input-group">
                <label className="payment-label">Dirección</label>
                <div className="payment-input-box">
                  <input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    className={`payment-input ${errors.address ? 'error' : ''}`}
                    placeholder="Calle y número"
                  />
                  <FaMapMarkerAlt className="payment-input-icon" />
                </div>
                {errors.address && <span className="payment-error">{errors.address}</span>}
              </div>

              <div className="payment-row">
                <div className="payment-input-group half">
                  <label className="payment-label">Ciudad</label>
                  <div className="payment-input-box">
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className={`payment-input ${errors.city ? 'error' : ''}`}
                      placeholder="Santo Domingo"
                    />
                    <FaCity className="payment-input-icon" />
                  </div>
                  {errors.city && <span className="payment-error">{errors.city}</span>}
                </div>
                <div className="payment-input-group half">
                  <label className="payment-label">Código postal</label>
                  <input
                    type="text"
                    name="zipCode"
                    value={formData.zipCode}
                    onChange={handleChange}
                    className={`payment-input ${errors.zipCode ? 'error' : ''}`}
                    placeholder="00000"
                  />
                  {errors.zipCode && <span className="payment-error">{errors.zipCode}</span>}
                </div>
              </div>

              <button 
                type="button"
                onClick={handleSubmit} 
                className={`payment-submit-btn ${loading ? 'loading' : ''}`}
                disabled={loading}
              >
                {loading ? 'Procesando...' : 'Pagar RD$999.00'}
              </button>

              <div className="payment-security">
                <FaLock className="payment-security-icon" />
                <p>Tu información está segura y encriptada</p>
              </div>
              {errors.general && <span className="payment-error">{errors.general}</span>}
            </div>
          </div>

          <div className="payment-logo-section">
            <div className="payment-logo-wrapper">
              <img 
                src="src/assets/logo png.png" 
                alt="Telo Fundi Logo" 
                className="payment-logo"
              />
            </div>
            
            <div className="payment-product-info">
              <h3>Subscripción Agencia</h3>
              <p className="payment-price">RD$999.00 al mes</p>
              <ul className="payment-features">
                <li>Acceso a dashboard de gestión</li>
                <li>Gestión de acompañantes</li>
                <li>Administración de contratos</li>
              </ul>
            </div>

            <div className="payment-decorative-shape shape-1"></div>
            <div className="payment-decorative-shape shape-2"></div>
            <div className="payment-decorative-shape shape-3"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPageV2;