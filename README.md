# InsureConnect — SSO Migration Project
## Keycloak → Auth0 (Zero-Risk Migration)

---

## Branch Guide — Which branch do I use?

| Branch | What's in it | When to use |
|---|---|---|
| `main` | Everything — both apps + migration scripts + docs | Migration work, running both IDPs together |
| `sso/auth0` | Auth0 insurance portal only | Working purely on the Auth0 SPA |
| `sso/keycloak` | Keycloak insurance portal only | Working purely on the Keycloak SPA |

```bash
# Switch to Auth0 app only
git checkout sso/auth0

# Switch to Keycloak app only
git checkout sso/keycloak

# Back to full migration view
git checkout main
```

---

## Folder Guide — What lives where?

```
sso-local/
│
├── apps/
│   ├── insurance-portal/        ← AUTH0 version of InsureConnect
│   │   └── src/auth0-config.js     Auth0 domain, clientId, PKCE
│   │
│   └── insurance-portal-kc/     ← KEYCLOAK version of InsureConnect
│       └── src/keycloak-config.js  Keycloak URL, realm, clientId
│
├── scripts/
│   ├── seed-keycloak-users.js   ← Create 100 test users in Keycloak
│   ├── migrate-to-auth0.js      ← Bulk export Keycloak → Auth0
│   ├── migrate-one-user.js      ← Migrate a single user by email/username
│   └── auth0-custom-db-login.js ← Paste this into Auth0 Custom DB connection
│
├── docs/
│   └── migration/
│       ├── 01-lazy-migration.md
│       ├── 02-bulk-hash-migration.md
│       ├── 03-proactive-email-migration.md
│       ├── 04-background-migration-service.md
│       ├── 05-permanent-fallback.md
│       ├── 06-decision-guide.md
│       └── 07-keycloak-to-auth0-operational-guide.md  ← START HERE
│
├── keycloak/realms/             ← Keycloak realm config (auto-imported)
├── nginx/                       ← nginx reverse proxy config
└── docker-compose.yml           ← Runs Keycloak + nginx together
```

---

## Quick Start

### Run the Auth0 portal
```bash
cd apps/insurance-portal
npm run dev
# Opens at https://localhost:3010
```

### Run the Keycloak portal
```bash
cd apps/insurance-portal-kc
npm run dev
# Opens at http://localhost:3020
```

### Start Keycloak (Docker)
```bash
docker-compose up -d
# Keycloak at http://localhost:8080
# Admin: admin / admin123
```

### Start the migration tunnel (exposes Keycloak to Auth0 cloud)
```bash
ssh -o StrictHostKeyChecking=no \
    -o ServerAliveInterval=15 \
    -o ServerAliveCountMax=10 \
    -R 80:localhost:8080 nokey@localhost.run
# Copy the https://xxxx.lhr.life URL and update KEYCLOAK_URL in Auth0
```

---

## Auth0 Configuration (InsureConnect)

| Item | Value |
|---|---|
| Tenant | `dev-lmezv6ucdrtju3c1.jp.auth0.com` |
| App (SPA) | InsureConnect — `zRPjBIhXTJsKj1Chd57KZ1pCaVMkLZCi` |
| Migration DB | `keycloak-migration` (con_tSxZhmckd9PGHWhj) |
| Strategy | Custom Database, import_mode: true |
| Old DB | `Username-Password-Authentication` — **disabled for InsureConnect** |

## Keycloak Configuration

| Item | Value |
|---|---|
| URL | `http://localhost:8080` |
| Realm | `insurance` |
| Client | `insurance-portal` |
| ROPC | Direct Access Grants: **Enabled** (required for migration) |
| Test users | user001–user100, passwords: InsurePass1! → InsurePass100! |

---

## Migration Status

The migration uses **lazy/just-in-time** migration:
- User logs in → Auth0 calls Keycloak to verify password → migrated silently
- No password resets, no emails, no disruption
- Full guide: `docs/migration/07-keycloak-to-auth0-operational-guide.md`
