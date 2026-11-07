
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Login from './Login.jsx'

function SistemaSST() {
  const [sesion, setSesion] = useState(null)

  if (!sesion) {
    return <Login onLogin={setSesion} />
  }

  return <App sesion={sesion} />
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SistemaSST />
  </StrictMode>,
)
