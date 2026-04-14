# Strategy 2 — Bulk Hash Migration

## What it is

Export password hashes from Keycloak's database and import them directly into
Auth0. Users log in as normal — Auth0 verifies the imported hash against the
entered password. No login script. No Keycloak dependency. Zero user disruption.

This is the cleanest migration if the hash format is compatible.

---

## The hashing compatibility problem

| IDP | Default hash algorithm | Auth0 supports it? |
|---|---|---|
| Keycloak (default) | PBKDF2-SHA256 | ❌ No |
| Keycloak (configurable) | bcrypt | ✅ Yes |
| Auth0 | bcrypt | ✅ Native |

**Keycloak defaults to PBKDF2. Auth0 does not support PBKDF2 imports.**

Auth0 bulk import supports:
- `bcrypt`
- `md5`, `sha1`, `sha256`, `sha512` (with salt)
- `ldap` (SHA)
- `argon2`

---

## How to enable bcrypt in Keycloak before migration

Change the password hashing policy in Keycloak Admin before users start logging in:

```
Keycloak Admin Console
  → Realm: insurance
  → Authentication → Password Policy
  → Add Policy: Hashing Algorithm = bcrypt
  → Hashing Iterations = 10
  → Save
```

Once saved, **existing hashes are NOT retroactively changed**. Keycloak
re-hashes each user's password the next time they log in. This means:

- Active users who log into Keycloak before cutover → get bcrypt hashes ✅
- Inactive users who never log in → still have PBKDF2 hashes ❌

This is why hash migration works well for active users, but needs a fallback
strategy (proactive email) for inactive ones.

---

## How to export hashes from Keycloak

Hashes are stored in Keycloak's Postgres database, **not** exposed via the Admin REST API.

```sql
-- Run against the keycloak postgres container
SELECT
  u.username,
  u.email,
  c.secret_data,    -- contains {"value":"$2b$10$...","salt":"..."}
  c.credential_data -- contains {"hashIterations":10,"algorithm":"bcrypt"}
FROM user_entity u
JOIN credential c ON c.user_id = u.id
WHERE c.type = 'password'
  AND u.realm_id = (SELECT id FROM realm WHERE name = 'insurance');
```

Parse `secret_data` JSON → extract the `value` field → that is the bcrypt hash.

---

## Auth0 bulk import format with hash

```json
[
  {
    "email": "alex.johnson1@insureconnect-demo.com",
    "email_verified": true,
    "name": "Alex Johnson",
    "custom_password_hash": {
      "algorithm": "bcrypt",
      "hash": {
        "value": "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy"
      }
    },
    "app_metadata": {
      "roles": ["customer"],
      "migrated_from": "keycloak"
    }
  }
]
```

---

## Import via Auth0 Management API

```
POST https://{domain}/api/v2/jobs/users-imports
Content-Type: multipart/form-data

connection_id = <your Auth0 DB connection ID>
users         = <the JSON file above>
```

Auth0 processes this as a background job. Poll `GET /api/v2/jobs/{id}` for status.
Limit: 500,000 users per file. Recommended batch size: 500 users.

---

## Migration flow

```
Step 1:  Change Keycloak hashing policy to bcrypt
         ↓
Step 2:  Wait 2–4 weeks (active users re-hash on login)
         ↓
Step 3:  Query Keycloak DB → export users with bcrypt hashes
         ↓
Step 4:  Import to Auth0 via Management API bulk import
         ↓
Step 5:  Active users (bcrypt): migrated, no disruption ✅
         Inactive users (PBKDF2 still): handle via proactive email ⚠
         ↓
Step 6:  Decommission Keycloak
```

---

## Strengths

- Zero disruption for all users who had bcrypt hashes
- No Keycloak dependency after import
- No Login script required
- One-time operation — done in hours

---

## Weaknesses

- Requires direct DB access to Keycloak's Postgres (not via REST API)
- Only works for users whose hashes were re-hashed to bcrypt
- Inactive users with old PBKDF2 hashes cannot be migrated this way
- Must coordinate DB export with a Keycloak maintenance window

---

## Combining with lazy migration

Use hash migration for the bcrypt users, and lazy migration as a fallback for
the remaining PBKDF2 users:

```
Auth0 Custom DB Login script checks:
  → if user already in Auth0 (hash migrated) → Auth0 handles it natively
  → if user NOT in Auth0 yet (PBKDF2, never logged in) → call Keycloak ROPC
```

This covers 100% of users with no forced resets.
