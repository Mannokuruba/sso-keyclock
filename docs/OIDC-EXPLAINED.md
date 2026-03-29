# OpenID Connect (OIDC) — How It Works
### Deep Dive for Engineers & Stakeholders
**Version:** 1.0 | **Audience:** All Technical Levels

---

## Table of Contents
1. [What Is OIDC](#1-what-is-oidc)
2. [The 3 Actors](#2-the-3-actors)
3. [The Full Login Flow](#3-the-full-login-flow)
4. [The 3 Tokens Explained](#4-the-3-tokens-explained)
5. [How Token Verification Works](#5-how-token-verification-works-no-database-call)
6. [OIDC vs The Old Way](#6-oidc-vs-the-old-way)
7. [Where This Lives in Our Code](#7-where-this-lives-in-our-code)

---

## 1. What Is OIDC

OIDC = **OpenID Connect**. It is a login protocol built on top of OAuth 2.0.

Think of it in one line:

```
OAuth 2.0  says → "can this app access your data?"
OIDC       says → "who are you?"

OIDC = OAuth 2.0 + identity layer (who the user is)
```

It is the same protocol used by:
- **Google** — "Login with Google"
- **Microsoft** — "Login with Microsoft"
- **Apple** — "Sign in with Apple"
- **Keycloak / Okta / Auth0** — enterprise SSO

If you have ever clicked "Login with Google" on any website —
that is OIDC in action.

---

## 2. The 3 Actors

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐
│    USER     │     │   YOUR APP      │     │   KEYCLOAK       │
│  (Browser)  │     │  (Client)       │     │  (Identity       │
│             │     │  HR Portal,     │     │   Provider / IdP)│
│  Manoj      │     │  Portal, etc.   │     │                  │
└─────────────┘     └─────────────────┘     └──────────────────┘

User     = the person trying to login
App      = trusts Keycloak, never handles passwords itself
Keycloak = the one authority that knows who everyone is

KEY RULE:
  The app NEVER sees the user's password.
  The app NEVER stores passwords.
  Only Keycloak handles credentials.
```

---

## 3. The Full Login Flow

### The OpenID Connect Authorization Code Flow

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — User visits app. App sees no session.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  MANOJ                 PORTAL APP
    │                       │
    │   GET /dashboard       │
    │──────────────────────►│
    │                       │
    │                       │  No session cookie found.
    │                       │  "I don't know who this is."
    │                       │  Must redirect to Keycloak.
    │                       │


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — App generates a security fingerprint and
         redirects browser to Keycloak.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  App generates TWO random values:
    state = "a3f9x2"   ← anti-forgery token (CSRF protection)
    nonce = "k8p1m7"   ← replay attack prevention

  App saves both in the user's SESSION (server-side).

  App sends browser to Keycloak with this URL:

  http://keycloak:8080/realms/demo/protocol/openid-connect/auth
    ?response_type=code      ← "give me an auth code"
    &client_id=portal        ← "I am the portal app"
    &redirect_uri=localhost:3000/callback  ← "send user back here"
    &scope=openid profile email            ← "I want identity info"
    &state=a3f9x2            ← "remember this fingerprint"
    &nonce=k8p1m7            ← "embed this in the token"

  MANOJ                 PORTAL APP              KEYCLOAK
    │                       │                      │
    │  302 Redirect          │                      │
    │  → Keycloak login URL  │                      │
    │◄──────────────────────│                      │
    │                       │                      │
    │  GET /auth?client_id=portal&state=a3f9x2...  │
    │─────────────────────────────────────────────►│


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Keycloak shows its own login page.
         Password NEVER goes to the app.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  MANOJ                                        KEYCLOAK
    │                                              │
    │  ┌────────────────────────────┐              │
    │  │  Company SSO Login         │              │
    │  │                            │              │
    │  │  Username: [manoj        ] │              │
    │  │  Password: [••••••••••••] │              │
    │  │                            │              │
    │  │  [ Login ]                 │              │
    │  └────────────────────────────┘              │
    │                                              │
    │  POST username + password                    │
    │─────────────────────────────────────────────►│
    │                                              │
    │                  Keycloak checks:            │
    │                  ✅ User exists?             │
    │                  ✅ Password correct?        │
    │                  ✅ Account enabled?         │
    │                  ✅ Not locked out?          │


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Keycloak issues a short-lived
         AUTHORIZATION CODE and redirects back.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  This code is NOT a token.
  It is a one-time voucher — valid for 60 seconds, usable once.

  MANOJ                                        KEYCLOAK
    │                                              │
    │  302 → localhost:3000/callback               │
    │       ?code=AUTH_CODE_XYZ                    │ ← one-time code
    │       &state=a3f9x2                          │ ← same state sent earlier
    │◄─────────────────────────────────────────────│
    │                                              │
    │  Browser follows redirect to the app        │
    │  GET /callback?code=AUTH_CODE_XYZ&state=a3f9x2
    │──────────────────────────────────────────►   │
         to the Portal App


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — App validates state. Prevents CSRF attack.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  App receives: state=a3f9x2
  App checks session: saved state was a3f9x2
  ✅ They match → legitimate callback, not forged.

  If they DON'T match:
  ❌ Someone injected a fake callback → REJECTED immediately.

  Why this matters:
    Without state check, an attacker could trick a logged-in
    user into binding their account to the attacker's code.
    State parameter prevents this entirely.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — App exchanges code for TOKENS.
         This happens SERVER-TO-SERVER.
         Browser never sees this exchange.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                  PORTAL APP              KEYCLOAK
                      │                      │
                      │  POST /token         │
                      │  code=AUTH_CODE_XYZ  │
                      │  client_id=portal    │
                      │  redirect_uri=...    │
                      │─────────────────────►│
                      │                      │
                      │  Keycloak verifies:  │
                      │  ✅ Code valid?      │
                      │  ✅ Not expired?     │
                      │  ✅ client_id match? │
                      │  ✅ redirect_uri?    │
                      │                      │
                      │  Returns 3 tokens:   │
                      │◄─────────────────────│
                      │  {                   │
                      │   access_token,      │ ← who + what roles
                      │   id_token,          │ ← identity only
                      │   refresh_token      │ ← stay logged in
                      │  }                   │

  WHY server-to-server?
    The authorization code travels via browser (visible in URL).
    The TOKEN exchange happens directly app→Keycloak.
    Tokens NEVER appear in the browser URL or history.
    Even if someone copies the callback URL → code is already used.


━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 7 — App stores session. User is logged in.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  App decodes access_token → gets user info + roles
  App saves to session:
    {
      name:  "Manoj Kumar",
      email: "manoj@company.com",
      roles: ["it-admin", "employee"]
    }

  App checks roles → routes to correct app
  User lands on their dashboard ✅
```

---

## 4. The 3 Tokens Explained

### Token 1 — ID Token

```
Purpose:  WHO is the user? (identity)
Used by:  The app — to know who just logged in
Sent to:  The app only — never to APIs

Decoded payload:
{
  "sub":             "0b141e97-3482-4e2a-87bf-d05ad03a7959",
                      ↑ permanent unique ID for this user
  "name":            "Manoj Kumar",
  "email":           "manoj@company.com",
  "given_name":      "Manoj",
  "family_name":     "Kumar",
  "preferred_username": "manoj",
  "nonce":           "k8p1m7",   ← must match what app sent in Step 2
  "iss":             "http://localhost:8080/realms/demo",
                      ↑ who issued this token (Keycloak)
  "aud":             "portal",   ← who this token is for
  "iat":             1711233667, ← issued at (Unix timestamp)
  "exp":             1711234567  ← expires at (15 min later)
}
```

### Token 2 — Access Token

```
Purpose:  WHAT can the user do? (authorisation)
Used by:  Every app and API to check permissions
Sent to:  Any service that needs to verify access

Decoded payload:
{
  "sub":    "0b141e97-3482-4e2a-87bf-d05ad03a7959",
  "name":   "Manoj Kumar",
  "email":  "manoj@company.com",

  "realm_access": {
    "roles": ["it-admin", "employee"]    ← THE KEY PART
  },                                       permissions are here

  "resource_access": {
    "portal": { "roles": ["uma_protection"] }
  },

  "iss":   "http://localhost:8080/realms/demo",
  "aud":   ["portal", "hr-portal", "admin-dashboard"],
  "exp":   1711234567    ← expires in 15 minutes

  NOTE: App checks roles WITHOUT calling Keycloak.
        It just reads this decoded payload.
        Fast. Scalable. Offline-capable.
}
```

### Token 3 — Refresh Token

```
Purpose:  Get new access token when it expires — without re-login
Used by:  The app, silently in background
Duration: Matches Keycloak SSO session (10 hours by default)

The Problem it solves:
  Access token expires in 15 minutes.
  User is still actively working.
  Should we make them login every 15 minutes? NO.

The Solution:
  App silently sends refresh_token to Keycloak
  Keycloak returns a new access_token
  User never sees anything — seamless

  App ──POST /token──────────────────► Keycloak
       grant_type=refresh_token
       refresh_token=long_lived_value

  App ◄──new access_token + new refresh_token── Keycloak

Security note:
  Refresh tokens are ROTATED on every use.
  Old refresh token immediately invalidated.
  If stolen and used → original holder's next use fails
  → Keycloak detects token reuse → invalidates entire session.
```

---

## 5. How Token Verification Works (No Database Call)

```
This is one of the most important concepts in OIDC.

KEYCLOAK has a KEY PAIR (like a lock and key):
┌──────────────────────────────────────────────────────────┐
│                                                          │
│  PRIVATE KEY  → Keycloak signs every token it issues    │
│                 NEVER leaves Keycloak. Ever.             │
│                                                          │
│  PUBLIC KEY   → Published openly at:                    │
│                 /realms/demo/protocol/openid-connect/certs│
│                 Anyone can download and use it.          │
│                                                          │
└──────────────────────────────────────────────────────────┘

HOW SIGNING WORKS:
  1. Keycloak creates the token payload (JSON)
  2. Runs it through RS256 algorithm with PRIVATE key
  3. Produces a SIGNATURE — a unique fingerprint
  4. Attaches signature to token

  Token = Header.Payload.Signature
          eyJh.eyJz.SflK  ← base64 encoded


HOW VERIFICATION WORKS (in each app):
  1. App downloads Keycloak public key once (cached)
  2. App splits token → gets Header, Payload, Signature
  3. App runs Payload through RS256 with PUBLIC key
  4. If result matches Signature → token is authentic ✅
  5. If ANY byte was changed → signature mismatch → rejected ❌

  App also checks:
  ✅ exp  → not expired
  ✅ iss  → came from OUR Keycloak
  ✅ aud  → token is meant for THIS app
  ✅ nonce → matches what was sent (prevents replay)


WHY THIS IS POWERFUL:
  ✅ No network call to Keycloak on every request
  ✅ Works at any scale — pure math, microseconds per check
  ✅ Works even if Keycloak is temporarily down
  ✅ Token cannot be forged — only Keycloak has private key
  ✅ Token cannot be modified — any change breaks signature


ANALOGY:
  Think of a government-issued passport.
  Government (Keycloak) stamps it with an official seal (private key).
  Any border officer (your app) can verify the seal (public key).
  Officer doesn't call the government for every passport check.
  If someone forges the stamp → detected immediately.
```

---

## 6. OIDC vs The Old Way

```
OLD WAY — Session-based authentication:
─────────────────────────────────────────

  User login → server creates session record in database
               { session_id: "abc", user: "manoj", expires: ... }

  Every request:
    Browser sends cookie (session_id=abc)
    Server queries database: "is session abc still valid?"
    Database returns user info
    Server processes request

  PROBLEMS:
  ✗ Every page load = 1 database query
  ✗ 10,000 concurrent users = 10,000 DB queries/second
  ✗ Scale to 1M users → database becomes bottleneck
  ✗ Deploy 5 apps → each needs its own session DB
  ✗ Logout from one app → other apps still have sessions
  ✗ App servers must share session DB (complex infrastructure)


NEW WAY — OIDC with JWT tokens:
──────────────────────────────────

  User login → Keycloak issues signed JWT (no DB record created)

  Every request:
    Browser sends JWT in header or cookie
    App verifies JWT signature (pure math — no network call)
    App reads user info + roles directly from token
    App processes request

  ADVANTAGES:
  ✓ Zero database queries on every request
  ✓ 10,000 concurrent users = 10,000 math operations (microseconds)
  ✓ Scale to 10M users → no bottleneck
  ✓ 5 apps → all verify same token independently
  ✓ Token expires automatically → no manual cleanup
  ✓ Stateless → any app server can handle any request
  ✓ Works across domains and services (microservices)


PERFORMANCE COMPARISON:
  Session DB query:    ~5-50ms   per request (network + DB)
  JWT verification:    ~0.01ms   per request (local math)

  At 100,000 requests/second:
  Old way: needs massive DB cluster, connection pooling, caching
  JWT way: each app server handles independently, no coordination
```

---

## 7. Where This Lives in Our Code

### The OIDC Discovery Document

```
Before any login, the app discovers all Keycloak endpoints automatically:

GET http://keycloak:8080/realms/demo/.well-known/openid-configuration

Returns:
{
  "issuer":                "http://localhost:8080/realms/demo",
  "authorization_endpoint":"http://localhost:8080/.../auth",
  "token_endpoint":        "http://keycloak:8080/.../token",
  "userinfo_endpoint":     "http://keycloak:8080/.../userinfo",
  "jwks_uri":              "http://keycloak:8080/.../certs",
  "end_session_endpoint":  "http://localhost:8080/.../logout"
}

The app never hardcodes these URLs.
If Keycloak changes them → app auto-discovers at startup.
This is the OIDC Discovery standard.
```

### Code Reference — Each Step in Our Portal

```
Step in flow          File                    What the code does
──────────────────────────────────────────────────────────────────────
OIDC Discovery        portal/server.js        Issuer.discover(url)
                      line: initOIDC()        auto-fetches all endpoints

Generate state+nonce  portal/server.js        generators.state()
                      /login route            generators.nonce()
                                              saved to req.session

Redirect to Keycloak  portal/server.js        oidcClient.authorizationUrl()
                      /login route            builds full redirect URL

Receive code          portal/server.js        /callback route
Validate state        portal/server.js        oidcClient.callback()
Exchange for tokens   portal/server.js        automatically done inside
                                              oidcClient.callback()

Decode roles          portal/server.js        realm_access.roles
                      /callback route         from access_token payload

Route by role         portal/server.js        ROLE_ROUTES array
                      /redirect route         getPrimaryApp(roles)

Check role in app     app-template/server.js  canAccess(userRoles, requiredRoles)
                      /dashboard route        returns true/false

Logout (app only)     portal/server.js        req.session.destroy()
                      /logout-local

Logout (SSO)          portal/server.js        redirect to end_session_endpoint
                      /logout-sso             destroys Keycloak session
```

### The Endpoint Patching (Internal vs External)

```
One non-obvious thing in our setup — why we patch endpoints:

Keycloak is configured with KC_HOSTNAME=localhost
→ All URLs in discovery doc say: http://localhost:8080/...

Problem:
  Browser needs: http://localhost:8080/auth  → works (port mapped)
  Node.js needs: http://keycloak:8080/token  → works (Docker network)
  Node.js using: http://localhost:8080/token → FAILS (localhost = container itself)

Our fix in initOIDC():
  authorization_endpoint → keep localhost (browser uses this)
  token_endpoint         → replace localhost with keycloak (Node uses this)
  userinfo_endpoint      → replace localhost with keycloak
  jwks_uri               → replace localhost with keycloak

This is a local dev pattern.
In production: Keycloak has a real domain (sso.company.com)
accessible from both browser and internal services.
No patching needed.
```

---

## Summary — OIDC in 6 Points

```
1. User visits app → app redirects to Keycloak (with state + nonce)
2. User logs in at KEYCLOAK — app never sees the password
3. Keycloak sends one-time AUTH CODE back to app via browser
4. App validates state (CSRF check) → exchanges code for tokens
   (this exchange is server-to-server, browser never sees tokens)
5. App decodes JWT → reads user identity + roles → starts session
6. On every subsequent request → app verifies JWT signature locally
   (no Keycloak call needed — pure cryptographic verification)

The password travels: User → Keycloak only.
The code travels:     Keycloak → Browser → App (one-time, 60 seconds).
The tokens travel:    Keycloak → App directly (never via browser).
The session lives:    In the app (backed by Keycloak's SSO session).
```

---

*This document is part of the SSO Architecture series.*
*Related docs: SSO-ARCHITECTURE.md | AZURE-AD-SETUP.md*
