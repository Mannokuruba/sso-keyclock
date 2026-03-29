const express = require('express');
const session = require('express-session');
const { Issuer, generators } = require('openid-client');

// ── Config from environment ──────────────────────────────────────────────────
const APP_NAME       = process.env.APP_NAME       || 'App';
const APP_COLOR      = process.env.APP_COLOR      || '#4a90d9';
const APP_DESC       = process.env.APP_DESC       || 'Company application';
const REQUIRED_ROLES = (process.env.REQUIRED_ROLES || '').split(',').filter(Boolean);
const PORT           = parseInt(process.env.PORT  || '3000');
const CLIENT_ID      = process.env.CLIENT_ID      || 'web-app';
const KEYCLOAK_INT   = process.env.KEYCLOAK_URL   || 'http://keycloak:8080';  // Node→Keycloak
const KEYCLOAK_EXT   = process.env.KEYCLOAK_EXTERNAL_URL || 'http://localhost:8080'; // Browser→Keycloak
const APP_URL        = process.env.APP_URL        || `http://localhost:${PORT}`;
const REDIRECT_URI   = `${APP_URL}/callback`;

// ── All 5 apps (for navigation bar) ─────────────────────────────────────────
const ALL_APPS = [
  { name: 'HR Portal',       url: 'http://localhost:3001', roles: ['hr-manager'],   color: '#e74c3c', desc: 'Employee records & hiring' },
  { name: 'Payroll App',     url: 'http://localhost:3002', roles: ['finance-team'], color: '#f39c12', desc: 'Salaries & financial reports' },
  { name: 'CRM System',      url: 'http://localhost:3003', roles: ['sales-team'],   color: '#27ae60', desc: 'Customers & sales pipeline' },
  { name: 'Docs Portal',     url: 'http://localhost:3004', roles: [],               color: '#3498db', desc: 'Company wikis & shared docs' },
  { name: 'Admin Dashboard', url: 'http://localhost:3005', roles: ['it-admin'],     color: '#9b59b6', desc: 'System config & user mgmt' },
];

// ── Role check ───────────────────────────────────────────────────────────────
// it-admin can access everything; empty requiredRoles = open to all logged-in users
function canAccess(userRoles, requiredRoles) {
  if (userRoles.includes('it-admin')) return true;
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some(r => userRoles.includes(r));
}

// ── Fake dashboard content per app ──────────────────────────────────────────
const DASHBOARD_CONTENT = {
  'hr-portal': `
    <h3>Employee Directory</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f0f0f0"><th>Name</th><th>Dept</th><th>Status</th></tr>
      <tr><td>Alice Kumar</td><td>HR</td><td>✅ Active</td></tr>
      <tr><td>Bob Smith</td><td>Finance</td><td>✅ Active</td></tr>
      <tr><td>Carol Jones</td><td>Sales</td><td>✅ Active</td></tr>
      <tr><td>Dave Patel</td><td>IT</td><td>✅ Active</td></tr>
      <tr><td>Eve Chen</td><td>Operations</td><td>✅ Active</td></tr>
    </table>`,
  'payroll-app': `
    <h3>Salary Summary — March 2026</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f0f0f0"><th>Employee</th><th>Salary</th><th>Status</th></tr>
      <tr><td>Alice Kumar</td><td>$85,000</td><td>✅ Paid</td></tr>
      <tr><td>Bob Smith</td><td>$92,000</td><td>✅ Paid</td></tr>
      <tr><td>Carol Jones</td><td>$78,000</td><td>⏳ Pending</td></tr>
      <tr><td>Dave Patel</td><td>$105,000</td><td>✅ Paid</td></tr>
      <tr><td>Eve Chen</td><td>$70,000</td><td>✅ Paid</td></tr>
    </table>`,
  'crm-system': `
    <h3>Active Deals Pipeline</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f0f0f0"><th>Deal</th><th>Value</th><th>Stage</th></tr>
      <tr><td>Acme Corp</td><td>$120,000</td><td>🔥 Negotiation</td></tr>
      <tr><td>TechStart Ltd</td><td>$45,000</td><td>📋 Proposal</td></tr>
      <tr><td>GlobalBank</td><td>$300,000</td><td>🤝 Closed Won</td></tr>
      <tr><td>RetailPlus</td><td>$67,000</td><td>📞 Discovery</td></tr>
    </table>`,
  'docs-portal': `
    <h3>Company Documents</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f0f0f0"><th>Document</th><th>Updated</th><th>By</th></tr>
      <tr><td>📄 Employee Handbook</td><td>Mar 2026</td><td>HR Team</td></tr>
      <tr><td>📄 IT Security Policy</td><td>Feb 2026</td><td>Dave Patel</td></tr>
      <tr><td>📄 Sales Playbook</td><td>Mar 2026</td><td>Carol Jones</td></tr>
      <tr><td>📄 Onboarding Guide</td><td>Jan 2026</td><td>HR Team</td></tr>
    </table>`,
  'admin-dashboard': `
    <h3>System Overview</h3>
    <table style="width:100%;border-collapse:collapse">
      <tr style="background:#f0f0f0"><th>Service</th><th>Status</th><th>Uptime</th></tr>
      <tr><td>Keycloak (SSO)</td><td>✅ Running</td><td>99.9%</td></tr>
      <tr><td>HR Portal</td><td>✅ Running</td><td>99.8%</td></tr>
      <tr><td>Payroll App</td><td>✅ Running</td><td>100%</td></tr>
      <tr><td>CRM System</td><td>✅ Running</td><td>99.5%</td></tr>
      <tr><td>Docs Portal</td><td>✅ Running</td><td>100%</td></tr>
    </table>
    <h3 style="margin-top:20px">Active SSO Sessions: 3</h3>`,
};

// ── Express setup ────────────────────────────────────────────────────────────
const app = express();
app.use(session({ secret: `${CLIENT_ID}-secret`, resave: false, saveUninitialized: false }));

const css = `
  body{font-family:Arial,sans-serif;margin:0;background:#f5f5f5}
  .topbar{background:${APP_COLOR};color:white;padding:15px 30px;display:flex;align-items:center;justify-content:space-between}
  .topbar h1{margin:0;font-size:20px}
  .topbar .user{font-size:14px;opacity:0.9}
  .content{max-width:1000px;margin:30px auto;padding:0 20px}
  .card{background:white;border-radius:8px;padding:25px;box-shadow:0 2px 8px rgba(0,0,0,0.1);margin-bottom:20px}
  .apps-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:10px}
  .app-tile{border-radius:8px;padding:12px;text-align:center;text-decoration:none;display:block;font-size:13px;font-weight:bold;border:2px solid transparent}
  .app-tile.allowed{color:white;border-color:transparent}
  .app-tile.denied{background:#f5f5f5;color:#999;border:2px solid #ddd;cursor:not-allowed;pointer-events:none}
  .app-tile.current{outline:3px solid #333}
  .app-tile small{display:block;font-weight:normal;margin-top:4px;font-size:11px;opacity:0.85}
  .btn{display:inline-block;padding:9px 18px;border-radius:5px;text-decoration:none;font-size:14px;margin:4px}
  .btn-primary{background:${APP_COLOR};color:white}
  .btn-danger{background:#e74c3c;color:white}
  .btn-outline{background:white;color:${APP_COLOR};border:2px solid ${APP_COLOR}}
  .badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:bold;background:${APP_COLOR};color:white;margin:2px}
  .denied-box{background:#fff5f5;border:2px solid #e74c3c;border-radius:8px;padding:25px;text-align:center}
  table td,table th{padding:8px 12px;border-bottom:1px solid #eee;text-align:left}
  .role-tag{background:#eee;padding:2px 8px;border-radius:10px;font-size:12px;margin:2px;display:inline-block}
`;

function navbar(user) {
  const userRoles = user?.roles || [];
  const tiles = ALL_APPS.map(a => {
    const allowed = user && canAccess(userRoles, a.roles);
    const isCurrent = a.url === APP_URL;
    const cls = `app-tile ${allowed ? 'allowed' : 'denied'} ${isCurrent ? 'current' : ''}`;
    const bg = allowed ? `background:${a.color}` : '';
    const lock = !user ? '🔒' : allowed ? '✅' : '🚫';
    return `<a href="${a.url}" class="${cls}" style="${bg}" ${allowed && !isCurrent ? '' : 'onclick="return false"'}>
      ${lock} ${a.name}<small>${a.desc}</small></a>`;
  }).join('');
  return `<div class="card"><strong>All Company Apps</strong><div class="apps-grid">${tiles}</div>
    ${!user ? '<p style="color:#999;font-size:13px;margin-top:10px">Login to see your access</p>' : ''}</div>`;
}

// ── OIDC setup ───────────────────────────────────────────────────────────────
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
    console.log(`[${APP_NAME}] OIDC ready on port ${PORT}`);
  } catch (err) {
    console.error(`[${APP_NAME}] OIDC init failed, retrying:`, err.message);
    setTimeout(initOIDC, 5000);
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  const user = req.session.user;
  res.send(`<html><head><style>${css}</style></head><body>
    <div class="topbar">
      <h1>${APP_NAME}</h1>
      ${user ? `<span class="user">👤 ${user.preferred_username} &nbsp;|&nbsp; ${(user.roles||[]).map(r=>`<b>${r}</b>`).join(', ')}</span>` : ''}
    </div>
    <div class="content">
      ${navbar(user)}
      <div class="card">
        <h2>${APP_NAME}</h2>
        <p>${APP_DESC}</p>
        <p><strong>Required role:</strong> ${REQUIRED_ROLES.length ? REQUIRED_ROLES.map(r=>`<span class="role-tag">${r}</span>`).join(' ') : '<span class="role-tag">any employee</span>'}</p>
        ${user
          ? canAccess(user.roles || [], REQUIRED_ROLES)
            ? `<p style="color:green">✅ You have access to this app.</p>
               <a class="btn btn-primary" href="/dashboard">Open Dashboard →</a>`
            : `<p style="color:red">🚫 You don't have access to this app.</p>
               <a class="btn btn-outline" href="/dashboard">Try anyway (see error)</a>`
          : `<a class="btn btn-primary" href="/login">Login with SSO →</a>`
        }
        ${user ? `<a class="btn btn-outline" href="/logout-local">Logout this app</a>
                  <a class="btn btn-danger" href="/logout-sso">Logout ALL apps (SSO)</a>` : ''}
      </div>
    </div>
  </body></html>`);
});

app.get('/dashboard', (req, res) => {
  const user = req.session.user;
  if (!user) return res.redirect('/login');

  const userRoles = user.roles || [];
  const allowed = canAccess(userRoles, REQUIRED_ROLES);

  if (!allowed) {
    const canAccessApps = ALL_APPS.filter(a => canAccess(userRoles, a.roles));
    return res.status(403).send(`<html><head><style>${css}</style></head><body>
      <div class="topbar"><h1>${APP_NAME}</h1>
        <span class="user">👤 ${user.preferred_username}</span></div>
      <div class="content">
        ${navbar(user)}
        <div class="denied-box">
          <h2>🚫 Access Denied</h2>
          <p>You tried to access <strong>${APP_NAME}</strong></p>
          <p>Required role: ${REQUIRED_ROLES.map(r=>`<span class="badge">${r}</span>`).join(' or ')}</p>
          <p>Your roles: ${userRoles.map(r=>`<span class="badge" style="background:#999">${r}</span>`).join(' ')}</p>
          <hr style="margin:20px 0">
          <p><strong>Apps you CAN access:</strong></p>
          ${canAccessApps.map(a =>
            `<a class="btn" style="background:${a.color};color:white" href="${a.url}">${a.name}</a>`
          ).join('')}
        </div>
      </div>
    </body></html>`);
  }

  const content = DASHBOARD_CONTENT[CLIENT_ID] || '<p>Dashboard content here.</p>';
  res.send(`<html><head><style>${css}</style></head><body>
    <div class="topbar"><h1>${APP_NAME} — Dashboard</h1>
      <span class="user">👤 ${user.preferred_username} &nbsp;|&nbsp; ${userRoles.map(r=>`<b>${r}</b>`).join(', ')}</span>
    </div>
    <div class="content">
      ${navbar(user)}
      <div class="card">
        <p style="color:green">✅ Access granted — your role <strong>${userRoles.filter(r => REQUIRED_ROLES.includes(r) || r === 'it-admin').join(', ')}</strong> allows access.</p>
        ${content}
      </div>
      <div class="card">
        <a class="btn btn-outline" href="/">← Back</a>
        <a class="btn btn-outline" href="/logout-local">Logout this app</a>
        <a class="btn btn-danger" href="/logout-sso">Logout ALL apps (SSO)</a>
      </div>
    </div>
  </body></html>`);
});

app.get('/login', (req, res) => {
  if (!oidcClient) return res.send('SSO not ready yet, please refresh in a moment.');
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
    const roles = payload.realm_access?.roles?.filter(r => !['default-roles-demo','offline_access','uma_authorization'].includes(r)) || [];
    req.session.user = { ...claims, roles };
    res.redirect('/dashboard');
  } catch (err) {
    if (err.message?.includes('state') || err.message?.includes('nonce')) return res.redirect('/login');
    res.send(`<pre>SSO Error: ${err.message}</pre>`);
  }
});

// Logout just this app (Keycloak SSO session stays alive)
app.get('/logout-local', (req, res) => {
  req.session.destroy();
  res.send(`<html><head><style>${css}</style></head><body>
    <div class="content" style="text-align:center;padding-top:60px">
      <div class="card">
        <h2>✅ Logged out of ${APP_NAME}</h2>
        <p>Your <strong>Keycloak SSO session is still active</strong>.</p>
        <p>If you visit any other app, you'll be automatically logged in — no password needed.</p>
        <a class="btn btn-primary" href="/login">Login again (will be instant)</a>
        <a class="btn btn-danger" href="${KEYCLOAK_EXT}/realms/demo/protocol/openid-connect/logout?post_logout_redirect_uri=${APP_URL}&client_id=${CLIENT_ID}">Logout ALL apps (SSO)</a>
      </div>
    </div>
  </body></html>`);
});

// Full SSO logout — kills Keycloak session, all apps lose access
app.get('/logout-sso', (req, res) => {
  req.session.destroy();
  res.redirect(`${KEYCLOAK_EXT}/realms/demo/protocol/openid-connect/logout?post_logout_redirect_uri=${APP_URL}&client_id=${CLIENT_ID}`);
});

initOIDC();
app.listen(PORT, () => console.log(`[${APP_NAME}] running on port ${PORT}`));
