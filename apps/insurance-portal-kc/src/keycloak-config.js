import Keycloak from 'keycloak-js'

export const keycloak = new Keycloak({
  url:      import.meta.env.VITE_KEYCLOAK_URL,
  realm:    import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
})

export const keycloakInitOptions = {
  onLoad:            'check-sso',  // show landing page first, don't force login immediately
  pkceMethod:        'S256',       // same PKCE security as Auth0 setup
  checkLoginIframe:  false,        // avoids cross-origin iframe issues in Docker/nginx
}
