
import { useState } from 'react'
import './Login.css'

export default function Login({ onLogin }) {
  const [usuario, setUsuario] = useState('')
  const [clave, setClave] = useState('')

  const ingresar = (e) => {
    e.preventDefault()

    // Solo demostración académica.
    // Todavía no valida cuentas reales.
    onLogin({
      usuario,
      rol: usuario.trim().toLowerCase() === 'admin' ? 'admin' : 'contratista'
    })
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <img
          src="/logo pga.png"
          alt="Agro Industrial Paramonga"
          className="login-logo"
        />

        <h1>CONTROL SST</h1>
        <p>Gestión documental de contratistas</p>

        <form onSubmit={ingresar}>
          <label htmlFor="login-usuario">Usuario</label>
          <input
            id="login-usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            placeholder="Ingrese su usuario"
            required
          />

          <label htmlFor="login-clave">Contraseña</label>
          <input
            id="login-clave"
            type="password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            placeholder="Ingrese su contraseña"
            required
          />

          <button type="submit">Ingresar</button>
        </form>

        <small>Prototipo académico · Anjhely C.</small>
      </div>
    </div>
  )
}
