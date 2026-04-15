import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Auth0Provider } from '@auth0/auth0-react'
import { auth0Config } from './auth0-config'
import App from './App'
import './styles/global.css'

const root = document.getElementById('root')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <Auth0Provider {...auth0Config}>
        <App />
      </Auth0Provider>
    </BrowserRouter>
  </StrictMode>
)
