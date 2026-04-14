# Strategy 1 — Lazy Migration (Just-in-Time)

## What it is

Users are migrated one at a time, on demand, the first time they log in after the
cutover. Auth0 calls your old identity provider (Keycloak) in the background to
verify the password. If valid, Auth0 stores the user permanently. The user never
notices anything changed.

---

## How it works

```
┌─────────────────────────────────────────────────────────────┐
│                     USER LOGS IN                            │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
              Auth0 checks its own database
                           │
              ┌────────────┴────────────┐
         User found                User NOT found
         (already migrated)        (first login)
              │                         │
         ✅ Authenticate              Auth0 calls
         normally                    Login Script
                                          │
                              POST /token to Keycloak
                              (ROPC grant, email+password)
                                          │
                              ┌───────────┴───────────┐
                         Keycloak: ✅              Keycloak: ❌
                         credentials OK            wrong password
                              │                         │
                    Auth0 creates user            WrongUsernameOrPassword
                    stores password hash          error returned
                    assigns roles
                    migration_status: complete
                              │
                    ✅ User logged in
                    (seamlessly, no reset needed)
```

---

## What you need in Auth0

**Custom Database Connection** with two scripts:

- **Login script** — called on first login, verifies against Keycloak
- **Get User script** — called during password reset / user lookup

Both scripts make HTTP calls to Keycloak's Admin API and token endpoint.

The scripts live in: [`/scripts/auth0-custom-db-login.js`](../../scripts/auth0-custom-db-login.js)

---

## What you need in Keycloak

**Direct Access Grants (ROPC)** must be enabled on the `insurance-portal` client:

```
Keycloak Admin → Realms → insurance → Clients → insurance-portal
  → Settings → Authentication flow overrides
  → Direct Access Grants Enabled = ON
```

> Disable this immediately after the migration window closes.
> ROPC bypasses the browser login flow and is a security risk if left open.

---

## Strengths

- Zero code changes to your app
- Zero user disruption for anyone who logs in during the window
- Passwords migrate automatically — no hashing complexity
- Low setup effort

---

## Weaknesses

| Problem | Impact for InsureConnect |
|---|---|
| Only migrates users who log in | Insurance users log in once a year — most users never migrate |
| Keycloak must stay alive | You cannot decommission Keycloak until the last user migrates |
| ROPC is a security risk | Direct Access Grants weakens Keycloak's security during the window |
| No visibility | You cannot predict when (or if) a user will ever migrate |

---

## When to use

Use lazy migration **only** when:
- Your users log in frequently (daily / weekly)
- You have a short migration window (1–4 weeks)
- You can tolerate keeping Keycloak alive indefinitely as a fallback

**Do not rely on lazy migration alone for InsureConnect.**
Combine it with [Proactive Email Migration](./03-proactive-email-migration.md)
to cover users who never log in.

---

## Migration progress tracking

While lazy migration runs, track progress via Auth0 Management API:

```
Total users in Keycloak:        100
Users in Auth0 (migrated):       43   ← grows over time
Users still in Keycloak only:    57   ← needs proactive action
```

Query Auth0 for `app_metadata.migration_status = "complete"` to see migrated count.
