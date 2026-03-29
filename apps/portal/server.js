const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');

const KEYCLOAK_INT  = process.env.KEYCLOAK_URL          || 'http://keycloak:8080';
const KEYCLOAK_EXT  = process.env.KEYCLOAK_EXTERNAL_URL || 'http://localhost:8080';
const PORTAL_URL    = 'http://localhost:3000';
const REDIRECT_URI  = `${PORTAL_URL}/callback`;
const CLIENT_ID     = 'portal';

// Role → app mapping (priority order: first match wins)
const ROLE_ROUTES = [
  { role: 'it-admin',     app: { name: 'Admin Dashboard', url: 'http://localhost:3005', color: '#9b59b6' } },
  { role: 'hr-manager',   app: { name: 'HR Portal',       url: 'http://localhost:3001', color: '#e74c3c' } },
  { role: 'finance-team', app: { name: 'Payroll App',     url: 'http://localhost:3002', color: '#f39c12' } },
  { role: 'sales-team',   app: { name: 'CRM System',      url: 'http://localhost:3003', color: '#27ae60' } },
  { role: 'employee',     app: { name: 'Docs Portal',     url: 'http://localhost:3004', color: '#3498db' } },
];

const ALL_APPS = [
  { name: 'HR Portal',       url: 'http://localhost:3001', color: '#e74c3c', roles: ['hr-manager'] },
  { name: 'Payroll App',     url: 'http://localhost:3002', color: '#f39c12', roles: ['finance-team'] },
  { name: 'CRM System',      url: 'http://localhost:3003', color: '#27ae60', roles: ['sales-team'] },
  { name: 'Docs Portal',     url: 'http://localhost:3004', color: '#3498db', roles: [] },
  { name: 'Admin Dashboard', url: 'http://localhost:3005', color: '#9b59b6', roles: ['it-admin'] },
];

function getPrimaryApp(roles) {
  for (const { role, app } of ROLE_ROUTES) {
    if (roles.includes(role)) return app;
  }
  return null;
}

function getAccessibleApps(roles) {
  if (roles.includes('it-admin')) return ALL_APPS;
  return ALL_APPS.filter(a => a.roles.length === 0 || a.roles.some(r => roles.includes(r)));
}

const app = express();
app.use(session({ secret: 'portal-secret', resave: false, saveUninitialized: false }));

const css = `
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;margin:0;background:#1a1a2e;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .portal{width:100%;max-width:520px;padding:20px}
  .logo{text-align:center;color:white;margin-bottom:30px}
  .logo h1{font-size:28px;margin:0}
  .logo p{opacity:0.6;margin:8px 0 0}
  .card{background:white;border-radius:12px;padding:35px;box-shadow:0 8px 32px rgba(0,0,0,0.3)}
  .btn-login{display:block;width:100%;padding:14px;background:#4a90d9;color:white;border:none;border-radius:8px;font-size:16px;cursor:pointer;text-align:center;text-decoration:none;font-weight:bold}
  .btn-login:hover{background:#357abd}
  .divider{text-align:center;color:#999;margin:20px 0;font-size:13px}
  .app-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}
  .app-btn{display:block;padding:14px;border-radius:8px;color:white;text-decoration:none;font-weight:bold;text-align:center;font-size:14px}
  .app-btn small{display:block;font-weight:normal;font-size:11px;opacity:0.85;margin-top:3px}
  .user-info{display:flex;align-items:center;gap:12px;margin-bottom:20px;padding-bottom:20px;border-bottom:1px solid #eee}
  .avatar{width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:bold;color:white}
  .user-info h3{margin:0;font-size:16px}
  .user-info p{margin:4px 0 0;font-size:13px;color:#666}
  .role-badge{display:inline-block;padding:2px 10px;border-radius:10px;font-size:11px;color:white;margin:2px}
  .logout-link{text-align:center;margin-top:18px}
  .logout-link a{color:#999;font-size:13px;text-decoration:none}
  .logout-link a:hover{color:#e74c3c}
  .redirect-box{text-align:center;padding:10px 0}
  .redirect-box p{color:#666;font-size:14px}
  .spinner{display:inline-block;width:20px;height:20px;border:3px solid #ddd;border-top-color:#4a90d9;border-radius:50%;animation:spin 0.8s linear infinite;vertical-align:middle;margin-right:8px}
  @keyframes spin{to{transform:rotate(360deg)}}
`;

// ── Home: login page or user's app launcher ──────────────────────────────────
app.get('/', (req, res) => {
  const user = req.session.user;

  if (!user) {
    return res.send(`<html><head><style>${css}</style></head><body>
      <div class="portal">
        <div class="logo">
          <h1>🏢 Company Portal</h1>
          <p>Single Sign-On — login once, access your apps</p>
        </div>
        <div class="card">
          <a class="btn-login" href="/login">Login with Company SSO →</a>
          <div class="divider">Powered by Keycloak</div>
          <p style="font-size:13px;color:#999;text-align:center;margin:0">
            Your role determines which apps you can access.<br>
            You'll be redirected automatically after login.
          </p>
        </div>
      </div>
    </body></html>`);
  }

  const roles = user.roles || [];
  const accessible = getAccessibleApps(roles);
  const primaryApp = getPrimaryApp(roles);
  const avatarColor = ROLE_ROUTES.find(r => roles.includes(r.role))?.app.color || '#999';

  res.send(`<html><head><style>${css}</style></head><body>
    <div class="portal" style="max-width:480px">
      <div class="logo">
        <h1>🏢 Company Portal</h1>
      </div>
      <div class="card">
        <div class="user-info">
          <div class="avatar" style="background:${avatarColor}">${user.given_name?.[0] || '?'}</div>
          <div>
            <h3>${user.name || user.preferred_username}</h3>
            <p>${user.email}</p>
            <div>${roles.map(r => `<span class="role-badge" style="background:${ROLE_ROUTES.find(x=>x.role===r)?.app.color||'#999'}">${r}</span>`).join('')}</div>
          </div>
        </div>

        <p style="font-size:13px;color:#666;margin:0 0 12px">Your apps (${accessible.length} of ${ALL_APPS.length}):</p>
        <div class="app-grid">
          ${accessible.map(a => `
            <a class="app-btn" href="${a.url}" style="background:${a.color}">
              ${a.name}
              <small>${a.roles.length ? a.roles[0] : 'all employees'}</small>
            </a>`).join('')}
        </div>

        ${accessible.length < ALL_APPS.length ? `
          <p style="font-size:12px;color:#bbb;margin-top:15px;text-align:center">
            🚫 ${ALL_APPS.length - accessible.length} app(s) hidden — not in your role
          </p>` : ''}
      </div>
      <div class="logout-link">
        <a href="/logout-local">Logout this portal</a> &nbsp;·&nbsp;
        <a href="/logout-sso" style="color:#e74c3c">Logout all apps (SSO)</a>
      </div>
    </div>
  </body></html>`);
});

// ── Auto-redirect after login ────────────────────────────────────────────────
app.get('/redirect', (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/');

  const primaryApp = getPrimaryApp(user.roles || []);
  if (!primaryApp) return res.redirect('/');

  res.send(`<html><head><style>${css}</style>
    <meta http-equiv="refresh" content="2;url=${primaryApp.url}">
    </head><body>
    <div class="portal">
      <div class="card" style="text-align:center;padding:40px">
        <div class="redirect-box">
          <p><span class="spinner"></span>Welcome <strong>${user.preferred_username}</strong>!</p>
          <p>Redirecting you to <strong style="color:${primaryApp.color}">${primaryApp.name}</strong>...</p>
          <p style="color:#bbb;font-size:13px">Based on your role: <strong>${user.roles?.join(', ')}</strong></p>
          <a href="${primaryApp.url}" style="color:#4a90d9;font-size:14px">Click here if not redirected</a>
        </div>
      </div>
    </div>
  </body></html>`);
});

// ── OIDC ─────────────────────────────────────────────────────────────────────
let oidcClient;
async function initOIDC() {
  try {
    const issuer = await Issuer.discover(`${KEYCLOAK_INT}/realms/demo`);
    const patch = url => typeof url === 'string' ? url.replace(KEYCLOAK_EXT, KEYCLOAK_INT) : url;
    const patchedIssuer = new Issuer({
      ...issuer.metadata,
      token_endpoint:       patch(issuer.metadata.token_endpoint),
      userinfo_endpoint:    patch(issuer.metadata.userinfo_endpoint),
      end_session_endpoint: patch(issuer.metadata.end_session_endpoint),
      jwks_uri:             patch(issuer.metadata.jwks_uri),
      authorization_endpoint: issuer.metadata.authorization_endpoint?.replace(KEYCLOAK_INT, KEYCLOAK_EXT),
    });
    oidcClient = new patchedIssuer.Client({
      client_id: CLIENT_ID,
      redirect_uris: [REDIRECT_URI],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    });
    console.log('[Portal] OIDC ready on port 3000');
  } catch (err) {
    console.error('[Portal] OIDC init failed, retrying:', err.message);
    setTimeout(initOIDC, 5000);
  }
}

app.get('/login', (req, res) => {
  if (!oidcClient) return res.send('SSO not ready, please refresh.');
  const state = generators.state();
  const nonce = generators.nonce();
  req.session.state = state;
  req.session.nonce = nonce;
  res.redirect(oidcClient.authorizationUrl({ scope: 'openid profile email', state, nonce }));
});

app.get('/callback', async (req, res) => {
  if (!oidcClient) return res.send('SSO not ready.');
  try {
    const params = oidcClient.callbackParams(req);
    if (params.error) return res.redirect('/login');
    const tokenSet = await oidcClient.callback(REDIRECT_URI, params, {
      state: req.session.state,
      nonce: req.session.nonce,
    });
    const claims = tokenSet.claims();
    const payload = JSON.parse(Buffer.from(tokenSet.access_token.split('.')[1], 'base64').toString());
    const roles = payload.realm_access?.roles?.filter(r =>
      !['default-roles-demo','offline_access','uma_authorization'].includes(r)
    ) || [];
    req.session.user = { ...claims, roles };
    res.redirect('/redirect');   // ← auto-route to primary app
  } catch (err) {
    if (err.message?.includes('state') || err.message?.includes('nonce')) return res.redirect('/login');
    res.send(`<pre>SSO Error: ${err.message}</pre>`);
  }
});

app.get('/logout-local', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/logout-sso', (req, res) => {
  req.session.destroy();
  res.redirect(`${KEYCLOAK_EXT}/realms/demo/protocol/openid-connect/logout?post_logout_redirect_uri=${PORTAL_URL}&client_id=${CLIENT_ID}`);
});

initOIDC();
app.listen(3000, () => console.log('[Portal] running on port 3000'));
