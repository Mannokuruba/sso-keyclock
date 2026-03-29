# Single Sign-On (SSO) Architecture
### Enterprise Identity & Access Management
**Version:** 1.0 | **Status:** Production Ready (Local) | **Owner:** Platform Team

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [What Problem Does SSO Solve](#2-what-problem-does-sso-solve)
3. [System Architecture](#3-system-architecture)
4. [Authentication Flow — Step by Step](#4-authentication-flow--step-by-step)
5. [Role-Based Access Control (RBAC)](#5-role-based-access-control-rbac)
6. [Central Portal — Intelligent Routing](#6-central-portal--intelligent-routing)
7. [Session Management — Login & Logout](#7-session-management--login--logout)
8. [Security Model](#8-security-model)
9. [Dynamic User Management](#9-dynamic-user-management)
10. [Azure AD + Keycloak Integration](#10-azure-ad--keycloak-integration)
11. [What We Built — Current Setup](#11-what-we-built--current-setup)
12. [Next Steps — Production Roadmap](#12-next-steps--production-roadmap)

---

## 1. Executive Summary

**For Stakeholders and Decision Makers**

This document describes an enterprise Single Sign-On (SSO) system built using
**Keycloak** — an open-source identity platform trusted by Red Hat, Deutsche Bank,
and thousands of enterprises globally.

### What This Gives the Business

| Business Need | How SSO Solves It |
|---|---|
| Employee logs in 5 times a day across 5 tools | Login ONCE — access everything |
| IT manually creates accounts in every system | Create account in ONE place |
| Employee leaves — access revoked from 5 systems | Disable ONE account — locked out everywhere instantly |
| "Who accessed payroll at 2am?" | ONE audit log, ONE answer |
| New app added to company — integrate with users | Register in Keycloak — done in hours |
| Compliance audit (SOC2/ISO27001) | Centralised access logs, MFA, role evidence |

### Cost Impact
```
Without SSO:
  IT time to onboard 1 employee across 5 apps  →  45 minutes
  IT time to offboard 1 employee across 5 apps →  60 minutes (often incomplete)
  Security incidents from forgotten accounts    →  HIGH RISK

With SSO:
  IT time to onboard 1 employee                →  5 minutes (one account)
  IT time to offboard 1 employee               →  30 seconds (one disable)
  Security incidents from orphaned accounts    →  ELIMINATED
```

---

## 2. What Problem Does SSO Solve

### Before SSO — The Fragmented Identity Problem

```
┌─────────────────────────────────────────────────────────────────┐
│                    WITHOUT SSO                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Employee MANOJ                                                │
│       │                                                         │
│       ├── HR Portal      → username: manoj, password: abc123   │
│       ├── Payroll App    → username: manoj, password: xyz789   │
│       ├── CRM System     → username: mKumar, password: qwe456  │
│       ├── Docs Portal    → email login,     password: abc123   │
│       └── Admin Panel    → username: manoj.k, password: ???    │
│                                                                 │
│   PROBLEMS:                                                     │
│   ✗ 5 passwords to remember                                     │
│   ✗ 5 user databases to maintain                               │
│   ✗ 5 places IT must remove access when Manoj leaves           │
│   ✗ Password reuse across systems = one breach = all breached  │
│   ✗ No single audit trail                                       │
│   ✗ No central MFA enforcement                                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### After SSO — Centralised Identity

```
┌─────────────────────────────────────────────────────────────────┐
│                      WITH SSO                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Employee MANOJ                                                │
│       │                                                         │
│       └── Keycloak (ONE login) ──────────────────────────────  │
│                   │                                             │
│                   ├── HR Portal      ✅ (has hr-manager role)   │
│                   ├── Payroll App    ❌ (not in finance-team)   │
│                   ├── CRM System     ❌ (not in sales-team)     │
│                   ├── Docs Portal    ✅ (all employees)         │
│                   └── Admin Panel    ✅ (has it-admin role)     │
│                                                                 │
│   SOLVED:                                                       │
│   ✓ ONE password, ONE login                                     │
│   ✓ ONE user database — Keycloak                               │
│   ✓ Disable in Keycloak → locked out of everything instantly   │
│   ✓ Passwords never shared with apps — only JWT tokens         │
│   ✓ ONE audit log for all access                               │
│   ✓ MFA configured once — applies to all apps                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. System Architecture

### High-Level Architecture

```
                        ┌─────────────────────────────────┐
                        │          INTERNET / LAN          │
                        └───────────────┬─────────────────┘
                                        │
                                        ▼
                        ┌─────────────────────────────────┐
                        │        COMPANY PORTAL           │
                        │     http://portal.company.com   │
                        │   (Single entry point for all   │
                        │        employees)               │
                        └───────────────┬─────────────────┘
                                        │ Login Request
                                        ▼
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    KEYCLOAK (Identity Provider)                   │
│                    http://sso.company.com                         │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐  │
│  │  User Store │  │    Roles    │  │     Audit & Sessions     │  │
│  │             │  │             │  │                          │  │
│  │  manoj      │  │  it-admin   │  │  Login at 09:01 ✅       │  │
│  │  alice      │  │  hr-manager │  │  Access HR at 09:02 ✅   │  │
│  │  bob        │  │  finance    │  │  Failed login 10:00 ❌   │  │
│  │  carol      │  │  sales-team │  │  Logout at 17:30 ✅      │  │
│  │  dave       │  │  employee   │  │                          │  │
│  │  eve        │  │             │  │                          │  │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘  │
│                                                                   │
└────────┬──────────┬──────────┬──────────┬──────────┬─────────────┘
         │          │          │          │          │
         ▼          ▼          ▼          ▼          ▼
    ┌─────────┐ ┌─────────┐ ┌──────┐ ┌──────┐ ┌─────────┐
    │HR Portal│ │Payroll  │ │ CRM  │ │Docs  │ │ Admin   │
    │  :3001  │ │  :3002  │ │:3003 │ │:3004 │ │  :3005  │
    └─────────┘ └─────────┘ └──────┘ └──────┘ └─────────┘

Infrastructure:
┌─────────────────────────────────────────────────────────┐
│  PostgreSQL Database  ←  Keycloak stores all data here  │
│  (users, sessions, roles, audit logs)                   │
└─────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Role | Technology |
|---|---|---|
| **Portal** | Central entry point, role-based routing | Node.js / Express |
| **Keycloak** | Authentication, token issuing, user store | Keycloak 26 |
| **PostgreSQL** | Persistent storage for Keycloak | PostgreSQL 16 |
| **HR Portal** | HR-specific app | Node.js / Express |
| **Payroll App** | Finance-specific app | Node.js / Express |
| **CRM System** | Sales-specific app | Node.js / Express |
| **Docs Portal** | Company-wide knowledge base | Node.js / Express |
| **Admin Dashboard** | IT admin control panel | Node.js / Express |

---

## 4. Authentication Flow — Step by Step

### The OpenID Connect (OIDC) Authorization Code Flow

This is the industry standard flow used by Google, Microsoft, Okta, and every
enterprise SSO system in the world.

```
STEP 1 — Employee visits the portal
─────────────────────────────────────
  Browser                Portal              Keycloak
    │                       │                   │
    │  GET /                │                   │
    │──────────────────────►│                   │
    │                       │                   │
    │  "Not logged in"      │                   │
    │  302 → /login         │                   │
    │◄──────────────────────│                   │


STEP 2 — Portal redirects to Keycloak with a security token
─────────────────────────────────────────────────────────────
    │  GET /login           │                   │
    │──────────────────────►│                   │
    │                       │  Generates:       │
    │                       │  state=abc123     │ ← anti-CSRF token
    │                       │  nonce=xyz789     │ ← replay attack prevention
    │                       │                   │
    │  302 → Keycloak       │                   │
    │  ?client_id=portal    │                   │
    │  &state=abc123        │                   │
    │  &redirect_uri=...    │                   │
    │◄──────────────────────│                   │


STEP 3 — User enters credentials at Keycloak (NOT at the app)
──────────────────────────────────────────────────────────────
    │  Login page           │                   │
    │◄──────────────────────────────────────────│
    │                       │                   │
    │  POST username +      │                   │
    │       password        │                   │
    │──────────────────────────────────────────►│
    │                       │                   │
    │                       │  ✅ Valid user     │
    │                       │  Issues short-    │
    │                       │  lived auth CODE  │


STEP 4 — Keycloak sends one-time Authorization Code back
──────────────────────────────────────────────────────────
    │  302 → /callback      │                   │
    │  ?code=ONE_TIME_CODE  │                   │
    │  &state=abc123        │                   │
    │──────────────────────►│                   │
    │                       │  Verifies state   │
    │                       │  matches abc123   │ ← CSRF check


STEP 5 — Portal exchanges code for tokens (server-to-server, never in browser)
────────────────────────────────────────────────────────────────────────────────
    │                       │  POST /token      │
    │                       │  code=ONE_TIME    │
    │                       │  client_id=portal │
    │                       │──────────────────►│
    │                       │                   │
    │                       │  Returns:         │
    │                       │  access_token     │ ← who you are + roles
    │                       │  id_token         │ ← your identity
    │                       │  refresh_token    │ ← stay logged in
    │                       │◄──────────────────│


STEP 6 — Portal routes user to their app based on role
────────────────────────────────────────────────────────
    │                       │  Decode JWT       │
    │                       │  roles: [it-admin]│
    │                       │                   │
    │                       │  it-admin  → Admin Dashboard
    │                       │  hr-manager→ HR Portal
    │                       │  finance   → Payroll App
    │                       │  sales     → CRM System
    │                       │  employee  → Docs Portal
    │                       │                   │
    │  302 → target app     │                   │
    │◄──────────────────────│                   │
    │                       │                   │
```

### What is a JWT Token?

```
Every app receives a JWT (JSON Web Token) — a digitally signed passport.

Structure:
  eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyMTIz...signature
  └──── Header ────┘  └──────── Payload ────────┘└─ Signature ┘

Decoded Payload:
{
  "sub":   "0b141e97-3482-4e2a-87bf-d05ad03a7959",  ← unique user ID
  "name":  "Manoj Kumar",
  "email": "manoj@company.com",
  "realm_access": {
    "roles": ["it-admin", "employee"]                ← permissions
  },
  "iss":   "http://sso.company.com/realms/demo",     ← issued by Keycloak
  "exp":   1711234567,                               ← expires in 15 minutes
  "iat":   1711233667                                ← issued at
}

KEY SECURITY POINT:
  Apps NEVER call Keycloak to validate a token.
  They verify the SIGNATURE using Keycloak's public key.
  → No extra network call needed.
  → Works even if Keycloak is temporarily unavailable.
  → Token expires automatically — no manual revocation needed.
```

---

## 5. Role-Based Access Control (RBAC)

### Role → Access Matrix

```
                  HR      Payroll   CRM     Docs    Admin
                Portal    App      System  Portal  Dashboard
                ──────────────────────────────────────────
alice           ✅         ❌        ❌       ✅       ❌
(hr-manager)

bob             ❌         ✅        ❌       ✅       ❌
(finance-team)

carol           ❌         ❌        ✅       ✅       ❌
(sales-team)

dave            ✅         ✅        ✅       ✅       ✅
(it-admin)

eve             ❌         ❌        ❌       ✅       ❌
(employee)

manoj           ✅         ✅        ✅       ✅       ✅
(it-admin)
```

### How Role Check Works in Each App

```
User arrives at HR Portal with JWT token
              │
              ▼
  App decodes token (no network call)
              │
              ▼
  roles = ["hr-manager", "employee"]
              │
              ▼
  Does roles include "hr-manager" OR "it-admin"?
              │
       ┌──────┴──────┐
       YES           NO
       │              │
       ▼              ▼
  ✅ Show          🚫 403 Access Denied
  Dashboard        "You need hr-manager role"
                   "Your role: finance-team"
                   "Apps you CAN access: [Payroll, Docs]"
```

### Role Hierarchy

```
it-admin        ← Superuser. Bypasses all role checks. Access everywhere.
    │
    ├── hr-manager    → HR Portal + Docs Portal
    ├── finance-team  → Payroll App + Docs Portal
    ├── sales-team    → CRM System + Docs Portal
    └── employee      → Docs Portal only (all staff have this)
```

---

## 6. Central Portal — Intelligent Routing

### The Routing Logic

```
Employee visits http://localhost:3000
              │
              ▼
        Logged in?
         │       │
        NO      YES
         │       │
         ▼       ▼
      Show    Decode JWT
      Login   Get roles
      Button      │
                  ▼
         Check ROLE_ROUTES
         (priority order):
                  │
         ┌────────┴────────────────────────────┐
         │                                     │
    it-admin?                            hr-manager?
    → Admin Dashboard                    → HR Portal
         │                                     │
    finance-team?                        sales-team?
    → Payroll App                        → CRM System
         │                                     │
    employee?                            no match?
    → Docs Portal                        → Portal home
                                           (show tiles)
```

### What the Portal Shows After Login

```
For alice (hr-manager):          For dave (it-admin):
┌─────────────────────┐          ┌─────────────────────┐
│ 👤 Alice Kumar      │          │ 👤 Dave Patel        │
│ hr-manager          │          │ it-admin             │
│                     │          │                      │
│ Your apps (2 of 5): │          │ Your apps (5 of 5):  │
│                     │          │                      │
│ ✅ HR Portal        │          │ ✅ HR Portal          │
│ ✅ Docs Portal      │          │ ✅ Payroll App        │
│                     │          │ ✅ CRM System         │
│ 🚫 3 apps hidden   │          │ ✅ Docs Portal        │
│    (not your role)  │          │ ✅ Admin Dashboard    │
└─────────────────────┘          └─────────────────────┘

→ Auto-redirected to HR Portal   → Auto-redirected to Admin Dashboard
```

---

## 7. Session Management — Login & Logout

### Two Layers of Sessions

```
┌──────────────────────────────────────────────────────────────┐
│  LAYER 1 — Keycloak SSO Session (Server-side, in PostgreSQL) │
│                                                              │
│  Created when:  User logs in via Keycloak                   │
│  Lives in:      Keycloak's database                         │
│  Duration:      10 hours (configurable)                     │
│  Covers:        ALL apps — it's the master session          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
           ↓  backs each individual app's session
┌──────────────────────────────────────────────────────────────┐
│  LAYER 2 — App Session (Per-app, in memory/cookie)           │
│                                                              │
│  Created when:  App receives token after OIDC callback      │
│  Lives in:      Browser cookie (per app, per port)          │
│  Duration:      Until browser closes or explicit logout     │
│  Covers:        Only THIS specific app                      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Logout Scenarios

```
SCENARIO A — "Logout this app" (Local Logout)
──────────────────────────────────────────────

  Alice in HR Portal clicks "Logout this app"
              │
              ▼
  HR Portal destroys its own session cookie
              │
              ▼
  Alice is logged OUT of HR Portal
  Alice is STILL logged IN to:
    → Docs Portal ✅ (cookie still valid)
    → Keycloak SSO session ✅ (still alive)
              │
              ▼
  Alice visits HR Portal again
  → Redirected to Keycloak
  → Keycloak sees active SSO session
  → AUTO-LOGIN, no password prompt ⚡
  → Back in HR Portal in <1 second


SCENARIO B — "Logout all apps" (SSO Logout)
────────────────────────────────────────────

  Alice clicks "Logout all apps"
              │
              ▼
  App calls Keycloak logout endpoint
              │
              ▼
  Keycloak DESTROYS the SSO session
              │
              ▼
  Back-channel logout signal sent to all apps
              │
   ┌──────────┼──────────┬──────────┐
   ▼          ▼          ▼          ▼
HR Portal  Docs Portal  CRM      Payroll
session    session      session  session
DESTROYED  DESTROYED    DESTROYED DESTROYED
              │
              ▼
  Alice visits ANY app → must login again with password
```

---

## 8. Security Model

### Defence in Depth

```
THREAT 1 — Someone steals the Authorization Code
  Mitigation: Code is ONE-TIME use only.
              Used once → immediately invalidated.
              Expires in 60 seconds if unused.
              State parameter prevents CSRF attacks.

THREAT 2 — Someone steals the Access Token
  Mitigation: Tokens expire in 15 minutes (configurable).
              Apps validate token SIGNATURE — cannot be forged.
              Keycloak signs with RS256 private key (2048-bit RSA).
              Apps verify with PUBLIC key only — private key never leaves Keycloak.

THREAT 3 — Brute force login attempts
  Mitigation: Keycloak brute force protection enabled.
              After 5 failed attempts → account temporarily locked.
              Configurable: lockout duration, attempt threshold.

THREAT 4 — User leaves company — access not revoked
  Mitigation: Disable in Keycloak → all active tokens rejected.
              Existing tokens expire within 15 minutes maximum.
              New login attempts fail immediately.

THREAT 5 — App database breach leaks passwords
  Mitigation: Apps NEVER store passwords.
              Apps never even SEE passwords.
              Only Keycloak handles credentials.
              Apps only receive/store short-lived JWT tokens.

THREAT 6 — Replay attack (reuse old token)
  Mitigation: Each token has exp (expiry) claim.
              Nonce in ID token prevents replay.
              Refresh tokens are rotated on each use.
```

### Token Security Flow

```
Keycloak generates:
  Private Key (RS256)  ←  NEVER leaves Keycloak
  Public Key           ←  Published at /.well-known/jwks.json

Token signing:
  Keycloak signs JWT with PRIVATE key
  → Apps can verify with PUBLIC key
  → If ANY bit of the token is modified → signature invalid → rejected

This means:
  ✅ App does NOT need to call Keycloak to validate every request
  ✅ Works at massive scale — no auth bottleneck
  ✅ Apps cannot be tricked by forged tokens
```

---

## 9. Dynamic User Management

### User Lifecycle in an Enterprise

```
DAY 1 — New employee joins
──────────────────────────
  HR creates user in Keycloak (or Azure AD syncs automatically)
              │
  Assign role: sales-team
              │
  Employee logs in → gets access to CRM + Docs Portal
              │
  Time: ~5 minutes total


MID-TENURE — Employee promoted / role changes
──────────────────────────────────────────────
  IT updates role in Keycloak:
  sales-team → finance-team
              │
  Next login (within 15 min after token expiry):
  CRM System  → ❌ access revoked
  Payroll App → ✅ access granted
              │
  No app code changes. No restarts.
  Role change propagates automatically via JWT.


LAST DAY — Employee offboarded
───────────────────────────────
  IT disables account in Keycloak (one click)
              │
  ┌───────────┴────────────────────────────────┐
  │ Active tokens expire within 15 minutes     │
  │ New login attempts: immediately rejected   │
  │ All apps: access denied                    │
  └────────────────────────────────────────────┘
  Time: 30 seconds. Zero risk of orphaned access.
```

### 3 Ways to Add/Manage Users

```
METHOD 1 — Admin UI (Day-to-day IT operations)
  http://localhost:8080 → Users → Create new user
  Best for: individual user changes, role assignments
  Who does it: IT helpdesk, HR admin

METHOD 2 — REST API (Automation & bulk operations)
  POST /admin/realms/demo/users
  Best for: bulk onboarding, HR system integration, scripts
  Who does it: DevOps, HR system integrations

  Example — Create user via API:
  ┌──────────────────────────────────────────────────────┐
  │  # Get admin token                                   │
  │  TOKEN=$(curl -s POST /realms/master/token           │
  │    -d "username=admin&password=admin123")            │
  │                                                      │
  │  # Create user                                       │
  │  curl -X POST /admin/realms/demo/users               │
  │    -d '{"username":"john","email":"john@co.com"}'    │
  │                                                      │
  │  # Assign role                                       │
  │  curl -X POST /admin/realms/demo/users/{id}/roles    │
  │    -d '[{"name":"hr-manager"}]'                      │
  └──────────────────────────────────────────────────────┘

METHOD 3 — Realm JSON (Infrastructure as Code)
  Edit keycloak/realms/demo-realm.json
  docker-compose down -v && docker-compose up -d
  Best for: environment setup, staging/dev resets
  Who does it: DevOps engineers
```

---

## 10. Azure AD + Keycloak Integration

### Why Use Both?

```
Most companies already pay for Microsoft 365.
All employees are already in Azure AD.
IT team manages Azure AD daily.

The Problem with Azure AD alone:
  → Every new internal app must be registered in Azure AD (IT bottleneck)
  → Limited custom role mapping per app
  → Developer teams depend on IT for every change
  → Vendor lock-in — all identity data in Microsoft

The Solution — Azure AD + Keycloak (Identity Brokering):
  → Azure AD = MASTER USER DIRECTORY (IT owns this)
  → Keycloak = APP ACCESS LAYER (Dev teams own this)
  → Best of both worlds
```

### Architecture with Azure AD

```
┌─────────────────────────────────────────────────────────────┐
│                     AZURE ACTIVE DIRECTORY                  │
│                   (Microsoft-managed cloud)                 │
│                                                             │
│  All 500 company employees live here                        │
│  IT manages: hire, fire, MFA, password policy, compliance   │
│  Synced with: HR system (Workday / SAP)                     │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ Employee clicks "Login with Company Account"
                            │ OIDC / SAML Federation (one-time IT setup)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        KEYCLOAK                             │
│                  (Self-hosted / company-managed)            │
│                                                             │
│  Receives: "Alice authenticated via Azure AD"               │
│  Looks up: Alice's app-specific roles in Keycloak           │
│  Issues:   JWT token with Azure identity + Keycloak roles   │
│                                                             │
│  Dev teams control:                                         │
│    → Which apps exist                                       │
│    → What roles each app needs                              │
│    → Role assignments per user                              │
│    → Custom claims in tokens                                │
└──────────┬──────────┬──────────┬──────────┬────────────────┘
           │          │          │          │
           ▼          ▼          ▼          ▼
       HR Portal  Payroll    CRM       Admin Dashboard
```

### Azure AD Login Flow

```
BROWSER              PORTAL          KEYCLOAK         AZURE AD
   │                    │                │                │
   │  Visit portal       │                │                │
   │───────────────────►│                │                │
   │                    │                │                │
   │  302 → Keycloak    │                │                │
   │◄───────────────────│                │                │
   │                    │                │                │
   │  GET Keycloak       │                │                │
   │  login page        │                │                │
   │───────────────────────────────────►│                │
   │                    │                │                │
   │  Keycloak shows:   │                │                │
   │  [Login with       │                │                │
   │   Company Account] │                │                │
   │◄───────────────────────────────────│                │
   │                    │                │                │
   │  Click "Company    │                │                │
   │  Account"          │                │                │
   │───────────────────────────────────►│                │
   │                    │                │                │
   │  302 → Azure AD    │                │                │
   │◄───────────────────────────────────│                │
   │                    │                │                │
   │  Microsoft login   │                │                │
   │  (MFA if required) │                │                │
   │──────────────────────────────────────────────────► │
   │                    │                │                │
   │  Token from        │                │                │
   │  Azure AD          │                │                │
   │◄──────────────────────────────────────────────────── │
   │                    │                │                │
   │  Back to Keycloak  │                │                │
   │───────────────────────────────────►│                │
   │                    │                │                │
   │                    │  Keycloak enriches token with   │
   │                    │  app roles + issues JWT         │
   │                    │◄───────────────│                │
   │                    │                │                │
   │  Routed to app     │                │                │
   │◄───────────────────│                │                │
```

### How to Configure Azure AD in Keycloak

```
STEP 1 — Register Keycloak in Azure AD (One-time IT setup)
  Azure Portal → App Registrations → New Registration
  Name: Company Keycloak SSO
  Redirect URI: https://sso.company.com/realms/demo/broker/oidc/endpoint
  → Copy: Application (client) ID
  → Copy: Directory (tenant) ID
  → Create client secret → Copy value

STEP 2 — Add Azure AD as Identity Provider in Keycloak
  Keycloak Admin → Identity Providers → Add → OpenID Connect v1.0
  Display Name:      "Login with Microsoft"
  Discovery URL:     https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid-configuration
  Client ID:         {APPLICATION_ID from Step 1}
  Client Secret:     {SECRET from Step 1}
  → Save

STEP 3 — Map Azure AD groups to Keycloak roles (optional)
  Identity Provider → Mappers → Add
  Type:   Hardcoded Role
  Role:   employee
  → All Azure AD users automatically get employee role in Keycloak

STEP 4 — Test
  Visit portal → "Login with Microsoft" → use company email →
  Keycloak receives Azure AD identity → adds Keycloak roles →
  JWT issued → routed to correct app ✅
```

### Realm JSON snippet to add Azure AD:

```json
"identityProviders": [
  {
    "alias": "oidc",
    "displayName": "Login with Microsoft",
    "providerId": "oidc",
    "enabled": true,
    "trustEmail": true,
    "config": {
      "authorizationUrl": "https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize",
      "tokenUrl":         "https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
      "clientId":         "YOUR_AZURE_APP_CLIENT_ID",
      "clientSecret":     "YOUR_AZURE_CLIENT_SECRET",
      "defaultScope":     "openid profile email",
      "syncMode":         "IMPORT"
    }
  }
]
```

---

## 11. What We Built — Current Setup

### Running Services

```
Service           Port    Container Name        Purpose
────────────────────────────────────────────────────────────────
Portal            3000    sso-portal            Central login & routing
HR Portal         3001    sso-hr-portal         HR team app
Payroll App       3002    sso-payroll-app       Finance team app
CRM System        3003    sso-crm-system        Sales team app
Docs Portal       3004    sso-docs-portal       All employees
Admin Dashboard   3005    sso-admin-dashboard   IT admin only
Keycloak          8080    sso-keycloak          Identity provider
PostgreSQL        5432    sso-postgres          Keycloak data store
```

### Users and Access

```
Username   Password   Roles                  Can Access
────────────────────────────────────────────────────────────────
alice      pass123    hr-manager, employee   HR Portal, Docs
bob        pass123    finance-team, employee Payroll App, Docs
carol      pass123    sales-team, employee   CRM System, Docs
dave       pass123    it-admin, employee     ALL 5 apps
eve        pass123    employee               Docs Portal only
manoj      pass123    it-admin, employee     ALL 5 apps
```

### Project File Structure

```
sso-local/
├── docker-compose.yml          ← All 8 services defined here
├── .env                        ← Secrets (DB password, admin creds)
├── docs/
│   ├── SSO-ARCHITECTURE.md     ← This document
│   └── AZURE-AD-SETUP.md       ← Azure AD integration guide
├── keycloak/
│   └── realms/
│       └── demo-realm.json     ← Users, roles, clients defined here
├── apps/
│   ├── portal/                 ← Central login portal (port 3000)
│   │   ├── server.js
│   │   ├── package.json
│   │   └── Dockerfile
│   └── app-template/           ← Shared template for all 5 apps
│       ├── server.js           ← Single codebase, 5 deployments
│       ├── package.json
│       └── Dockerfile
└── nginx/
    └── nginx.conf              ← Reverse proxy config
```

---

## 12. Next Steps — Production Roadmap

### Phase 1 — Harden for Production (Week 1–2)

```
□ Replace HTTP with HTTPS (SSL/TLS certificates — Let's Encrypt or company cert)
  Why: All tokens transmitted over network must be encrypted

□ Set KC_HOSTNAME to real domain (sso.company.com)
  Why: Browser and server URLs must match in production

□ Switch from start-dev to start (production mode)
  Why: Dev mode disables security features

□ Move secrets to environment vault (HashiCorp Vault, AWS Secrets Manager)
  Why: .env files should never be committed or exposed

□ Set up Keycloak clustering (2+ nodes)
  Why: Single node = single point of failure
```

### Phase 2 — Connect Real Identity Source (Week 2–3)

```
□ Integrate Azure AD (if company uses Microsoft 365)
  → Follow Section 10 of this document
  → Employees use existing Microsoft credentials
  → IT manages users in ONE place they already own

□ OR connect to existing LDAP/Active Directory
  → Keycloak Admin → User Federation → LDAP
  → Sync company directory automatically

□ Enable MFA (Multi-Factor Authentication)
  → Keycloak Admin → Authentication → OTP Policy
  → Enforce for admin-dashboard and payroll-app at minimum
```

### Phase 3 — Observability & Compliance (Week 3–4)

```
□ Enable Keycloak audit logging to SIEM (Splunk, Elastic, Datadog)
  → Every login, logout, failed attempt, role change — centrally logged

□ Set up login alerts
  → Alert if same user logs in from 2 countries within 1 hour
  → Alert on excessive failed login attempts

□ Role review automation
  → Monthly report: who has access to what
  → Flag users with roles not used in 90 days
```

### Phase 4 — Scale & Enterprise Features (Month 2+)

```
□ Replace local session store with Redis
  → Currently: sessions in memory (lost on restart)
  → Production: sessions in Redis cluster (survive restarts)

□ Set up automated user provisioning from HR system
  → SCIM protocol: Workday/SAP creates employee → Keycloak auto-provisions
  → Employee leaves → HR system offboards → Keycloak auto-disables

□ Add fine-grained permissions (beyond roles)
  → "bob can see payroll reports but NOT edit salary"
  → Use Keycloak's Authorization Services (UMA 2.0)

□ Build admin portal for role self-service
  → Team leads can assign roles to their team members
  → IT approves — reduces helpdesk tickets
```

### Architecture Evolution

```
TODAY (Local Dev):
  Browser → Portal → Keycloak → PostgreSQL
                  → 5 Apps

PRODUCTION (3 months):
  Browser → CDN/WAF → Load Balancer
                    → Portal (3 instances)
                    → Keycloak Cluster (3 nodes) → PostgreSQL HA
                    → 5 Apps (auto-scaled)
                    → Azure AD (identity federation)
                    → SIEM (audit logs)
                    → Vault (secrets management)
```

---

---

## Related Documents

| Document | What It Covers |
|---|---|
| [OIDC-EXPLAINED.md](OIDC-EXPLAINED.md) | Full deep-dive: how OIDC login flow works step by step, JWT tokens, verification |
| [AZURE-AD-SETUP.md](AZURE-AD-SETUP.md) | How to connect Azure Active Directory to Keycloak |

---

*Document maintained by Platform/DevOps team.*
*Review cycle: Quarterly or on major architecture change.*
*Questions: Raise in #platform-engineering Slack channel.*
