import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ReactKeycloakProvider } from '@react-keycloak/web'
import { keycloak, keycloakInitOptions } from './keycloak-config'
import App from './App'
import './styles/global.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <ReactKeycloakProvider authClient={keycloak} initOptions={keycloakInitOptions}>
        <App />
      </ReactKeycloakProvider>
    </BrowserRouter>
  </StrictMode>
)
