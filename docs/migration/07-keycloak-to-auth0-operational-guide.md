# Keycloak → Auth0 Zero-Risk Migration — Complete Operational Guide
## InsureConnect Single Page Application

> **Goal achieved:** Users log in with their existing Keycloak password — no password reset, no disruption, no data loss. Auth0 silently migrates each user on their first login.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites & Inventory](#prerequisites--inventory)
3. [Phase 1 — Keycloak Preparation](#phase-1--keycloak-preparation)
4. [Phase 2 — Auth0 Tenant Setup](#phase-2--auth0-tenant-setup)
5. [Phase 3 — Public Tunnel Setup](#phase-3--public-tunnel-setup)
6. [Phase 4 — Custom Database Connection](#phase-4--custom-database-connection)
7. [Phase 5 — Login Script](#phase-5--login-script)
8. [Phase 6 — Auth0 App Wiring](#phase-6--auth0-app-wiring)
9. [Phase 7 — Testing & Verification](#phase-7--testing--verification)
10. [Critical Lessons Learned](#critical-lessons-learned)
11. [Production Checklist](#production-checklist)
12. [Rollback Plan](#rollback-plan)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        MIGRATION FLOW                           │
│                                                                 │
│  User visits InsureConnect (Auth0 SPA)                          │
│           ↓                                                     │
│  Clicks Login → Auth0 Universal Login page                      │
│           ↓                                                     │
│  Enters email + Keycloak password                               │
│           ↓                                                     │
│  Auth0 checks keycloak-migration DB                             │
│           │                                                     │
│    User not found yet ──→ Custom DB Login Script fires          │
│                                    ↓                            │
│                         Calls Keycloak ROPC via HTTPS tunnel    │
│                                    ↓                            │
│                         Keycloak verifies password ✅           │
│                                    ↓                            │
│                         Auth0 imports user + stores hash        │
│                                    ↓                            │
│                         User logged in — NO reset needed        │
│                                                                 │
│    Next login ──────────→ Auth0 uses stored hash directly       │
│                           Keycloak never called again ✅        │
└─────────────────────────────────────────────────────────────────┘
```

**Why this is zero-risk:**
- Users log in with their existing password — nothing changes for them
- No emails, no password resets, no forced re-enrollment
- Keycloak stays alive as a silent fallback during the migration window
- Each user is migrated exactly once, on their own schedule

---

## Prerequisites & Inventory

### What you need before starting

| Item | Value (InsureConnect example) |
|---|---|
| Keycloak URL (local) | `http://localhost:8080` |
| Keycloak realm | `insurance` |
| Keycloak admin user | `admin` / `admin123` |
| Keycloak client ID | `insurance-portal` |
| Auth0 tenant domain | `dev-lmezv6ucdrtju3c1.jp.auth0.com` |
| Auth0 SPA client ID | `zRPjBIhXTJsKj1Chd57KZ1pCaVMkLZCi` |
| Auth0 M2M client ID | `1uS23b3m44disstVPEJ5063YzYPbJzmp` |
| Auth0 M2M client secret | stored securely, never hardcode |

### Auth0 M2M Token Scopes Required

The M2M app (Default App) must have these Management API permissions granted:

```
read:connections
update:connections
create:connections
create:users
read:users
update:users
delete:users
create:user_tickets
read:clients
update:clients
```

Grant these at: **Auth0 Dashboard → Applications → Default App → APIs tab → Auth0 Management API → Edit**

---

## Phase 1 — Keycloak Preparation

### Step 1.1 — Enable Direct Access Grants (ROPC) on Keycloak client

The Custom DB Login script calls Keycloak using Resource Owner Password Credentials (ROPC). This must be enabled on the `insurance-portal` client.

**Via Admin REST API:**
```bash
# Get admin token
KC_TOKEN=$(curl -s -X POST "http://localhost:8080/realms/master/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=admin-cli&username=admin&password=admin123" \
  | jq -r '.access_token')

# Get client UUID
CLIENT_UUID=$(curl -s "http://localhost:8080/admin/realms/insurance/clients?clientId=insurance-portal" \
  -H "Authorization: Bearer $KC_TOKEN" | jq -r '.[0].id')

# Enable ROPC
curl -s -X PUT "http://localhost:8080/admin/realms/insurance/clients/$CLIENT_UUID" \
  -H "Authorization: Bearer $KC_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"directAccessGrantsEnabled": true}'
```

**Via Keycloak Admin Console:**
1. Go to `http://localhost:8080/admin` → Realm: insurance
2. Clients → insurance-portal → Settings
3. Toggle **Direct Access Grants** to ON
4. Save

### Step 1.2 — Verify ROPC works

```bash
curl -s -X POST "http://localhost:8080/realms/insurance/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=insurance-portal&username=USER_EMAIL&password=USER_PASSWORD&scope=openid"
```

Expected response must contain **`id_token`** (not just `access_token`). The login script uses `id_token` to decode the user profile. If `id_token` is missing, ensure `scope=openid` is included.

### Step 1.3 — Keycloak user password format (InsureConnect)

Users seeded via `scripts/seed-keycloak-users.js` follow this pattern:

| Username | Email | Password |
|---|---|---|
| user001 | james.harris1@insureconnect-demo.com | InsurePass1! |
| user002 | mary.walker2@insureconnect-demo.com | InsurePass2! |
| user003 | john.gonzalez3@insureconnect-demo.com | InsurePass3! |
| userNNN | firstname.lastnameN@insureconnect-demo.com | InsurePassN! |

---

## Phase 2 — Auth0 Tenant Setup

### Step 2.1 — Get a Management API Token

```javascript
// scripts/get-mgmt-token.js
node << 'EOF'
const https = require('https');
const qs = require('querystring');
const fs = require('fs');

const body = qs.stringify({
  grant_type: 'client_credentials',
  client_id: 'YOUR_M2M_CLIENT_ID',
  client_secret: 'YOUR_M2M_CLIENT_SECRET',
  audience: 'https://YOUR_TENANT.auth0.com/api/v2/'
});

// ... standard https.request POST to /oauth/token
// Save result to /tmp/auth0_token.json
EOF
```

Verify the token has the required scopes (`create:connections`, `update:connections`, etc.)

### Step 2.2 — Disable Username-Password-Authentication for InsureConnect

**This is critical.** If the default `Username-Password-Authentication` connection stays enabled for your app, Auth0 routes all logins there first — bypassing your Custom DB connection entirely.

**Auth0 Dashboard → Authentication → Database → Username-Password-Authentication → Applications tab → toggle InsureConnect to OFF**

There is no Management API v2 endpoint to set `enabled_clients` on database connections — this must be done manually in the dashboard.

---

## Phase 3 — Public Tunnel Setup

### Why a tunnel is needed

Auth0's Custom Database scripts run on Auth0's cloud servers. They cannot reach `localhost:8080`. You need Keycloak to be publicly accessible via HTTPS.

### Option A — localhost.run (no install, no account)

```bash
ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 \
  -R 80:localhost:8080 nokey@localhost.run
```

Output gives you a URL like: `https://3f320b4126c246.lhr.life`

**Important limitations:**
- URL changes every time the tunnel restarts
- You must update `KEYCLOAK_URL` in the Auth0 connection config each time
- Not suitable for production — use for development/testing only

**Verify tunnel:**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://YOUR-TUNNEL.lhr.life/realms/insurance"
# Must return 200
```

### Option B — Production alternative

For production, deploy Keycloak to a server with a stable HTTPS URL, or use:
- AWS/GCP/Azure with a domain + SSL cert
- Cloudflare Tunnel (`cloudflared tunnel`) — free, stable URLs, no account for basic use
- ngrok with a paid account (stable subdomain)

### Step 3.1 — Update tunnel URL in Auth0 connection after each restart

Every time the tunnel restarts, update the `KEYCLOAK_URL` in the connection configuration:

```javascript
// PATCH /api/v2/connections/{CONN_ID}
{
  options: {
    configuration: {
      KEYCLOAK_URL: 'https://NEW-TUNNEL-URL.lhr.life'
    }
  }
}
```

---

## Phase 4 — Custom Database Connection

### Step 4.1 — Create the connection via Management API

```javascript
// POST /api/v2/connections
{
  name: 'keycloak-migration',
  strategy: 'auth0',
  options: {
    import_mode: true,                    // ← CRITICAL: enables lazy migration
    enabledDatabaseCustomization: true,   // ← enables custom scripts
    enable_script_context: true,          // ← adds context param to script signature
    customScripts: {
      login: '<login script content>'
    },
    configuration: {
      KEYCLOAK_URL:       'https://YOUR-TUNNEL.lhr.life',
      KEYCLOAK_REALM:     'insurance',
      KEYCLOAK_CLIENT_ID: 'insurance-portal'
    }
  }
}
```

**`import_mode: true` explained:**
- When a user tries to log in and is **not found** in Auth0 → login script runs → on success Auth0 stores user + password hash permanently
- On every subsequent login → Auth0 uses the stored hash, script never called again
- This is the lazy/just-in-time migration

### Step 4.2 — Enable the connection for InsureConnect

**Auth0 Dashboard → Authentication → Database → keycloak-migration → Applications tab → toggle InsureConnect to ON**

Again — this cannot be done via the Management API `PATCH /connections/{id}` endpoint (`enabled_clients` is rejected). Must be done in the dashboard.

---

## Phase 5 — Login Script

### The complete working script

```javascript
// scripts/auth0-custom-db-login.js
// IMPORTANT: signature is (email, password, context, callback) when enable_script_context=true

function login(email, password, context, callback) {
  var request = require('request');   // ← use 'request', NOT 'axios' (axios is not in Auth0 sandbox)

  var KEYCLOAK_URL   = configuration.KEYCLOAK_URL;
  var KEYCLOAK_REALM = configuration.KEYCLOAK_REALM;
  var CLIENT_ID      = configuration.KEYCLOAK_CLIENT_ID;

  var tokenUrl = KEYCLOAK_URL + '/realms/' + KEYCLOAK_REALM + '/protocol/openid-connect/token';

  request.post({
    url: tokenUrl,
    form: {
      grant_type: 'password',
      client_id:  CLIENT_ID,
      username:   email,
      password:   password,
      scope:      'openid profile email'
    }
  }, function(err, response, body) {
    if (err) {
      return callback(new Error('Keycloak unreachable: ' + err.message));
    }

    var data;
    try { data = JSON.parse(body); }
    catch(e) { return callback(new Error('Invalid response from Keycloak')); }

    if (response.statusCode === 401 || response.statusCode === 400) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    if (!data.id_token) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    // Decode id_token JWT (no signature check needed — came from our Keycloak)
    var parts   = data.id_token.split('.');
    var payload = JSON.parse(new Buffer(parts[1], 'base64').toString('utf8'));

    return callback(null, {
      user_id:        payload.sub,
      email:          payload.email,
      email_verified: payload.email_verified || false,
      name:           payload.name || payload.preferred_username,
      given_name:     payload.given_name  || '',
      family_name:    payload.family_name || '',
      nickname:       payload.preferred_username,
      app_metadata: {
        keycloak_id:      payload.sub,
        keycloak_realm:   KEYCLOAK_REALM,
        roles:            (payload.realm_access && payload.realm_access.roles) || [],
        policy_number:    payload.policy_number || null,
        migration_status: 'complete'
      }
    });
  });
}
```

### Critical script mistakes to avoid

| Mistake | Symptom | Fix |
|---|---|---|
| Using `axios` instead of `request` | "Oops something went wrong" on login | Use `require('request')` — always available in Auth0 sandbox |
| Wrong function signature `(email, password, callback)` | `fp` failed password on every attempt | When `enable_script_context=true`, signature is `(email, password, context, callback)` |
| Pre-creating shell accounts | Script never fires, login always fails with "Wrong email or password" | Delete shell accounts — `import_mode` only calls the script for users who don't exist in Auth0 yet |
| Not including `scope=openid` in ROPC | `id_token` missing from Keycloak response | Always include `scope=openid` in the ROPC form body |
| Tunnel URL expired | "Oops something went wrong" after tunnel restart | Update `KEYCLOAK_URL` in connection config after each tunnel restart |

---

## Phase 6 — Auth0 App Wiring

### What NOT to change in the SPA

The InsureConnect React app (`src/auth0-config.js`) requires **zero changes**. The Auth0 SDK handles everything transparently:

```javascript
// auth0-config.js — unchanged
export const auth0Config = {
  domain: 'dev-lmezv6ucdrtju3c1.jp.auth0.com',
  clientId: 'zRPjBIhXTJsKj1Chd57KZ1pCaVMkLZCi',
  authorizationParams: {
    redirect_uri: window.location.origin + '/callback',
    scope: 'openid profile email',
  },
  cacheLocation: 'memory',
  useRefreshTokens: true,
}
```

Auth0's Universal Login handles connection routing automatically. The user sees the same login page — nothing changes from their perspective.

### Dashboard checklist (manual steps required)

These two steps cannot be automated via API and must be done in the Auth0 dashboard:

| Step | Location | Action |
|---|---|---|
| 1 | Authentication → Database → Username-Password-Authentication → Applications | Toggle InsureConnect **OFF** |
| 2 | Authentication → Database → keycloak-migration → Applications | Toggle InsureConnect **ON** |

---

## Phase 7 — Testing & Verification

### Step 7.1 — Verify the tunnel is reachable from the internet

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://YOUR-TUNNEL.lhr.life/realms/insurance"
# Must return 200, not 503
```

### Step 7.2 — Verify ROPC works end-to-end through tunnel

```bash
curl -s -X POST "https://YOUR-TUNNEL.lhr.life/realms/insurance/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=password&client_id=insurance-portal&username=USER_EMAIL&password=USER_PASS&scope=openid"
# Must return JSON with id_token field
```

### Step 7.3 — Debug the login script before deploying the real one

Deploy this debug script first to confirm Auth0 is calling the script at all:

```javascript
function login(email, password, context, callback) {
  return callback(null, {
    user_id:        'debug-' + email.replace('@','_'),
    email:          email,
    email_verified: true,
    name:           'Debug User',
    app_metadata:   { migration_status: 'debug' }
  });
}
```

If the user can log in with any password → script is firing correctly → swap in the real script.
If login still fails → check Auth0 logs for the exact error type.

### Step 7.4 — Read Auth0 logs correctly

```javascript
// GET /api/v2/logs?per_page=10&sort=date:-1
```

| Log type | Meaning |
|---|---|
| `fp` | Failed password — wrong credentials OR script returned WrongUsernameOrPasswordError |
| `fepft` | Failed exchange / permission — script syntax error or module error |
| `s` | Successful login |
| `sapi` | Management API call |
| `ss` | Successful signup |

When you see `fepft` with description "Grant type 'password' not allowed" — the client doesn't have ROPC enabled. Enable it at: **Dashboard → Applications → your client → Advanced Settings → Grant Types**.

### Step 7.5 — Check migration status after successful login

```bash
node -e "
const https = require('https');
const TOKEN = require('fs').readFileSync('/tmp/auth0_token.json', 'utf8');
const token = JSON.parse(TOKEN).access_token;
// GET /api/v2/users-by-email?email=USER_EMAIL
// Check app_metadata.migration_status === 'complete'
"
```

After first successful login:
- `migration_status` changes from `pending` → `complete`
- Auth0 stores the password hash
- Keycloak is never called again for this user

---

## Critical Lessons Learned

### 1. Do NOT pre-create shell accounts

**What we tried:** Import shell accounts (no password) via bulk import, then rely on the login script for verification.

**What happened:** Auth0's `import_mode: true` only calls the login script for users who **don't exist at all** in Auth0. Shell accounts with no password hash are treated as locked accounts — login always fails with "Wrong email or password" without ever reaching the script.

**Correct approach:** Do not pre-create accounts. Let users attempt login naturally. Auth0 finds no record → calls the login script → migrates on success.

### 2. The function signature changes with enable_script_context

When Auth0 has `enable_script_context: true` on a connection (set automatically when you enable the feature in the dashboard), the login function **must** be:

```javascript
// WRONG — callback receives the context object, not the callback function
function login(email, password, callback) { ... }

// CORRECT
function login(email, password, context, callback) { ... }
```

### 3. Use `request`, not `axios`

Auth0's Custom Database script sandbox supports a specific set of npm modules. `axios` is NOT on the list. Use `request` (the classic Node.js HTTP client), which is always available.

Supported modules in Auth0 sandbox: `request`, `bcrypt`, `mysql`, `pg`, `mongo`, `ldapjs`, `crypto`, `async`, `q`, `xmldom`, `xpath`, `xml2js`, and a few others.

### 4. enabled_clients cannot be set via PATCH API

Auth0's `PATCH /api/v2/connections/{id}` rejects `enabled_clients` with `"Additional properties not allowed"`. The only way to enable a connection for an app is through the Auth0 dashboard manually.

### 5. The tunnel URL changes on every restart

`localhost.run` gives a new random subdomain each time the SSH connection is restarted. After every restart, you must update the `KEYCLOAK_URL` in the connection configuration via:

```javascript
// PATCH /api/v2/connections/{CONN_ID}
{ options: { configuration: { KEYCLOAK_URL: 'https://NEW-URL.lhr.life' } } }
```

### 6. Username-Password-Authentication must be disabled for the app

Even with `keycloak-migration` enabled for InsureConnect, if `Username-Password-Authentication` is also enabled, Auth0 routes to that connection first (alphabetically or by default order). Always disable the old connection for the app when switching.

---

## Production Checklist

### Before go-live

- [ ] Replace `localhost.run` tunnel with a stable HTTPS Keycloak URL (domain + SSL cert)
- [ ] Store `KEYCLOAK_URL`, `KEYCLOAK_REALM`, `KEYCLOAK_CLIENT_ID` as Auth0 connection configuration (not hardcoded in script)
- [ ] Rotate M2M client secret and store it in a secrets manager (not in shell history)
- [ ] Remove debug script — deploy production script with real Keycloak verification
- [ ] Test with 3–5 real users before full rollout
- [ ] Enable Auth0 log streaming (to Datadog / Splunk / CloudWatch) to monitor `fp` and `s` events

### Connection configuration final state

| Setting | Value |
|---|---|
| Connection name | `keycloak-migration` |
| Strategy | `auth0` (Database) |
| Import mode | `true` |
| Custom Database | Enabled |
| enable_script_context | `true` |
| KEYCLOAK_URL | `https://your-stable-keycloak-domain.com` |
| KEYCLOAK_REALM | `insurance` |
| KEYCLOAK_CLIENT_ID | `insurance-portal` |
| Enabled for InsureConnect | ✅ Yes |
| Username-Password-Authentication enabled | ❌ No (disabled for InsureConnect) |

### Keycloak configuration final state

| Setting | Value |
|---|---|
| Client: insurance-portal | Direct Access Grants: **Enabled** |
| When to disable | After all users have `migration_status: complete` |

### Post-migration cleanup (Month 3)

Once Auth0 logs show zero `s` events going through the login script (all users migrated):

1. Disable Direct Access Grants on Keycloak `insurance-portal` client
2. Stop the tunnel / remove Keycloak public URL
3. Archive Keycloak Postgres data for compliance
4. Decommission Keycloak container
5. Remove `customScripts.login` from the `keycloak-migration` connection (or keep as a no-op)

---

## Rollback Plan

The migration is inherently safe to roll back at any point:

| Stage | Rollback action |
|---|---|
| Before any logins | Re-enable `Username-Password-Authentication` for InsureConnect, disable `keycloak-migration` |
| Some users migrated | Both connections can coexist. Migrated users are in Auth0, others still in Keycloak |
| All users migrated | Restore from Keycloak Postgres backup, re-enable ROPC, re-enable the connection |

Keycloak is never modified during migration (ROPC is just turned on, no data deleted). Rolling back is always safe.

---

## Files Reference

| File | Purpose |
|---|---|
| `scripts/auth0-custom-db-login.js` | The Custom DB Login script — paste into Auth0 connection |
| `scripts/seed-keycloak-users.js` | Seeds 100 demo users into Keycloak |
| `scripts/migrate-to-auth0.js` | Bulk export/import (for hash migration strategy) |
| `scripts/migrate-one-user.js` | Migrate a single user by username or email |
| `apps/insurance-portal/` | Auth0 SPA — untouched during migration |
| `apps/insurance-portal-kc/` | Keycloak SPA — same app, different IDP |
| `docs/migration/01-lazy-migration.md` | Strategy 1: Lazy / Just-in-Time Migration |
| `docs/migration/02-bulk-hash-migration.md` | Strategy 2: Bulk bcrypt Hash Import |
| `docs/migration/03-proactive-email-migration.md` | Strategy 3: Proactive Email Campaign |
| `docs/migration/04-background-migration-service.md` | Strategy 4: Background Migration Service |
| `docs/migration/05-permanent-fallback.md` | Strategy 5: Keep Both IDPs (not recommended) |
| `docs/migration/06-decision-guide.md` | How to choose the right strategy |
| `docs/migration/07-keycloak-to-auth0-operational-guide.md` | This file — step-by-step operational runbook |
