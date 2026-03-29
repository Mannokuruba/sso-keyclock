const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');

const app = express();
const PORT = 3000;

const KEYCLOAK_INTERNAL = process.env.KEYCLOAK_URL || 'http://keycloak:8080';  // Node→Keycloak (Docker network)
const KEYCLOAK_EXTERNAL = process.env.KEYCLOAK_EXTERNAL_URL || 'http://localhost:8080'; // Browser→Keycloak
const CLIENT_ID = 'web-app';
const REDIRECT_URI = 'http://localhost:3000/callback';

app.use(session({
  secret: 'sso-demo-secret',
  resave: false,
  saveUninitialized: false,
}));

// Inline CSS for all pages
const style = `
  body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 0 20px; background: #f5f5f5; }
  .card { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); margin-bottom: 20px; }
  h1 { color: #333; }
  a.btn { display: inline-block; padding: 10px 20px; background: #4a90d9; color: white; text-decoration: none; border-radius: 5px; margin: 5px; }
  a.btn.red { background: #e74c3c; }
  a.btn.green { background: #27ae60; }
  pre { background: #f0f0f0; padding: 15px; border-radius: 5px; overflow-x: auto; font-size: 13px; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: bold; }
  .badge.admin { background: #e74c3c; color: white; }
  .badge.editor { background: #f39c12; color: white; }
  .badge.viewer { background: #27ae60; color: white; }
`;

let oidcClient;

async function initOIDC() {
  try {
    const issuer = await Issuer.discover(`${KEYCLOAK_INTERNAL}/realms/demo`);

    // Keycloak advertises endpoints with KC_HOSTNAME (localhost:8080).
    // Server-to-server calls must use the internal Docker hostname instead.
    const patchEndpoints = (url) =>
      typeof url === 'string' ? url.replace(KEYCLOAK_EXTERNAL, KEYCLOAK_INTERNAL) : url;

    const patchedIssuer = new Issuer({
      ...issuer.metadata,
      token_endpoint:      patchEndpoints(issuer.metadata.token_endpoint),
      userinfo_endpoint:   patchEndpoints(issuer.metadata.userinfo_endpoint),
      end_session_endpoint: patchEndpoints(issuer.metadata.end_session_endpoint),
      jwks_uri:            patchEndpoints(issuer.metadata.jwks_uri),
      // Keep authorization_endpoint as external (browser uses it)
      authorization_endpoint: issuer.metadata.authorization_endpoint
        ?.replace(KEYCLOAK_INTERNAL, KEYCLOAK_EXTERNAL),
    });

    oidcClient = new patchedIssuer.Client({
      client_id: CLIENT_ID,
      redirect_uris: [REDIRECT_URI],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    console.log('OIDC client initialized');
    console.log('  auth endpoint:', patchedIssuer.metadata.authorization_endpoint);
    console.log('  token endpoint:', patchedIssuer.metadata.token_endpoint);
  } catch (err) {
    console.error('OIDC init failed, retrying in 5s:', err.message);
    setTimeout(initOIDC, 5000);
  }
}

// Home page
app.get('/', (req, res) => {
  const user = req.session.user;
  res.send(`
    <html><head><style>${style}</style></head><body>
    <div class="card">
      <h1>SSO Demo App</h1>
      <p>This app demonstrates Single Sign-On using <strong>Keycloak</strong> + <strong>OpenID Connect</strong>.</p>
      ${user
        ? `<p>Logged in as <strong>${user.preferred_username}</strong> &nbsp;
           ${(user.roles || []).map(r => `<span class="badge ${r.replace('app-','')}">${r}</span>`).join(' ')}</p>
           <a class="btn green" href="/profile">My Profile</a>
           <a class="btn green" href="/token">View Token</a>
           <a class="btn red" href="/logout">Logout</a>`
        : `<p>You are <strong>not logged in</strong>.</p>
           <a class="btn" href="/login">Login with Keycloak</a>`
      }
    </div>
    <div class="card">
      <h3>How SSO works</h3>
      <ol>
        <li>Click <b>Login</b> — you're redirected to Keycloak</li>
        <li>Enter credentials at Keycloak's login page</li>
        <li>Keycloak issues an <b>Authorization Code</b> and redirects back</li>
        <li>This app exchanges the code for an <b>Access Token + ID Token</b></li>
        <li>Your identity and roles are decoded from the JWT</li>
      </ol>
    </div>
    </body></html>
  `);
});

// Login — redirect to Keycloak
app.get('/login', (req, res) => {
  if (!oidcClient) return res.send('OIDC not ready yet, please wait and refresh.');
  const state = generators.state();
  const nonce = generators.nonce();
  req.session.state = state;
  req.session.nonce = nonce;
  const url = oidcClient.authorizationUrl({ scope: 'openid profile email', state, nonce });
  res.redirect(url);
});

// Callback — exchange code for tokens
app.get('/callback', async (req, res) => {
  if (!oidcClient) return res.send('OIDC not ready.');
  try {
    const params = oidcClient.callbackParams(req);

    // If Keycloak redirected back with an error (e.g. already_logged_in), restart login
    if (params.error) {
      console.warn('Keycloak callback error:', params.error, params.error_description);
      return res.redirect('/login');
    }

    const tokenSet = await oidcClient.callback(REDIRECT_URI, params, {
      state: req.session.state,
      nonce: req.session.nonce,
    });
    const claims = tokenSet.claims();
    const accessPayload = JSON.parse(Buffer.from(tokenSet.access_token.split('.')[1], 'base64').toString());
    const roles = accessPayload.realm_access?.roles?.filter(r => r.startsWith('app-')) || [];

    req.session.user = { ...claims, roles };
    req.session.tokens = {
      id_token: tokenSet.id_token,
      access_token: tokenSet.access_token,
    };
    res.redirect('/');
  } catch (err) {
    console.error('Callback error:', err);
    // State mismatch usually means stale session — restart login flow
    if (err.message?.includes('state') || err.message?.includes('nonce')) {
      return res.redirect('/login');
    }
    res.send(`<pre>Callback error: ${err.message}\n\n${err.stack}</pre>`);
  }
});

// Profile page (protected)
app.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const u = req.session.user;
  res.send(`
    <html><head><style>${style}</style></head><body>
    <div class="card">
      <h1>User Profile</h1>
      <table>
        <tr><td><b>Username</b></td><td>${u.preferred_username}</td></tr>
        <tr><td><b>Email</b></td><td>${u.email}</td></tr>
        <tr><td><b>Name</b></td><td>${u.name || u.given_name + ' ' + u.family_name}</td></tr>
        <tr><td><b>Roles</b></td><td>${(u.roles||[]).map(r=>`<span class="badge ${r.replace('app-','')}">${r}</span>`).join(' ')}</td></tr>
        <tr><td><b>Subject (sub)</b></td><td><code>${u.sub}</code></td></tr>
        <tr><td><b>Issuer</b></td><td><code>${u.iss}</code></td></tr>
        <tr><td><b>Token expires</b></td><td>${new Date(u.exp * 1000).toLocaleString()}</td></tr>
      </table>
      <br>
      <a class="btn" href="/">Home</a>
      <a class="btn" href="/token">View Raw Token</a>
      <a class="btn red" href="/logout">Logout</a>
    </div>
    </body></html>
  `);
});

// Token viewer
app.get('/token', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  const tokens = req.session.tokens;
  const decodeJWT = (token) => {
    const [header, payload] = token.split('.');
    return {
      header: JSON.parse(Buffer.from(header, 'base64').toString()),
      payload: JSON.parse(Buffer.from(payload, 'base64').toString()),
    };
  };
  const at = decodeJWT(tokens.access_token);
  const it = decodeJWT(tokens.id_token);
  res.send(`
    <html><head><style>${style}</style></head><body>
    <div class="card">
      <h1>JWT Tokens</h1>
      <p>These are the raw tokens issued by Keycloak — decoded for inspection.</p>
      <h3>Access Token (used to call APIs)</h3>
      <pre>${JSON.stringify(at.payload, null, 2)}</pre>
      <h3>ID Token (user identity)</h3>
      <pre>${JSON.stringify(it.payload, null, 2)}</pre>
      <a class="btn" href="/profile">Back to Profile</a>
    </div>
    </body></html>
  `);
});

// Logout
app.get('/logout', (req, res) => {
  req.session.destroy();
  const logoutUrl = `${KEYCLOAK_EXTERNAL}/realms/demo/protocol/openid-connect/logout?redirect_uri=http://localhost:3000/`;
  res.redirect(logoutUrl);
});

initOIDC();
app.listen(PORT, () => console.log(`App running on port ${PORT}`));
