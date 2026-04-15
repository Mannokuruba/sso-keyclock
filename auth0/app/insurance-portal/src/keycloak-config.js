// Keycloak configuration for InsureConnect Insurance Portal
// All values loaded from environment variables — never hardcode credentials

import Keycloak from 'keycloak-js'

export const keycloak = new Keycloak({
  url:      import.meta.env.VITE_KEYCLOAK_URL,       // e.g. http://localhost:8080
  realm:    import.meta.env.VITE_KEYCLOAK_REALM,     // e.g. insurance
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID, // e.g. insurance-portal
})

// Keycloak init options — PKCE S256 + check-sso on page load
export const keycloakInitOptions = {
  onLoad:     'check-sso',  // silently checks if user is already logged in
  pkceMethod: 'S256',       // PKCE code challenge — same security as Auth0 setup
  checkLoginIframe: false,  // avoids cross-origin iframe issues on local dev
}
