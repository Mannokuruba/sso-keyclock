// Auth0 configuration for InsureConnect B2C Insurance Portal
// All values are loaded from environment variables — never hardcode credentials

export const auth0Config = {
  domain: import.meta.env.VITE_AUTH0_DOMAIN,
  clientId: import.meta.env.VITE_AUTH0_CLIENT_ID,

  authorizationParams: {
    redirect_uri: import.meta.env.VITE_AUTH0_REDIRECT_URI || window.location.origin + '/callback',

    // Only include audience if configured — avoids Auth0 "invalid audience" error
    ...(import.meta.env.VITE_AUTH0_AUDIENCE
      ? { audience: import.meta.env.VITE_AUTH0_AUDIENCE }
      : {}),

    // Custom scopes (read:policies, read:claims) require an API audience.
    // Use minimal OIDC scopes when no audience is configured.
    scope: import.meta.env.VITE_AUTH0_AUDIENCE
      ? 'openid profile email read:policies read:claims offline_access'
      : 'openid profile email',

    // MFA enforcement — NAIC insurance compliance standard
    acr_values: 'http://schemas.openid.net/pape/policies/2007/06/multi-factor',
  },

  // PKCE is the default for SPAs in Auth0 React SDK — no client secret needed
  cacheLocation: 'memory',           // 'memory' is most secure for SPAs
  useRefreshTokens: true,            // silent token refresh without re-login
  useRefreshTokensFallback: true,    // fallback if refresh token rotation fails
}

export const logoutConfig = {
  logoutParams: {
    returnTo: import.meta.env.VITE_AUTH0_LOGOUT_URI || window.location.origin,
  },
}
