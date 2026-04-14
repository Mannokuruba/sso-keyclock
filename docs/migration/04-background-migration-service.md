# Strategy 4 — Background Migration Service

## What it is

A scheduled background job that automatically migrates users from Keycloak to
Auth0 without any user action and without waiting for them to log in. It runs
silently in the background over days or weeks until every user is migrated.

Unlike lazy migration (triggered by the user logging in), this is triggered
by your own infrastructure on a schedule you control.

---

## How it works

```
┌────────────────────────────────────────────────────────────┐
│  Background Job  (runs nightly, driven by a cron task)     │
└────────────────────────────────┬───────────────────────────┘
                                 ↓
          Fetch all unmigrated users from Keycloak Admin API
                                 ↓
                    For each unmigrated user:
                                 │
              ┌──────────────────┼──────────────────┐
              ↓                  ↓                  ↓
     Create shell          Assign roles        Generate magic link
     account in Auth0      from Keycloak       (optional)
              └──────────────────┼──────────────────┘
                                 ↓
                   Mark user: migration_status = "ready"
                                 ↓
                   Send verification email (optional)
                   OR silently wait for first login
                   (lazy migration as final fallback)
```

---

## Two modes

### Mode A — Silent pre-creation (no email)
Create shell accounts in Auth0 for all users from Keycloak.
No emails sent. When the user next logs in (even a year later),
Auth0 finds the shell account, the Login script verifies against
Keycloak, and migrates the password.

This is better than pure lazy migration because:
- Auth0 already knows about the user (profile, roles, metadata)
- Only the password verification still needs Keycloak
- You have full visibility of who is pre-created vs fully migrated

### Mode B — Pre-creation + email trigger
Same as Mode A, but also sends the proactive verification email
(see [Strategy 3](./03-proactive-email-migration.md)) in batches.

Batch sending avoids overwhelming your email service:
```
Day 1:  migrate + email users 1–25
Day 2:  migrate + email users 26–50
Day 3:  migrate + email users 51–75
Day 4:  migrate + email users 76–100
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Migration Service                         │
│                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │   Scheduler  │───▶│ Migration    │───▶│  State Store  │  │
│  │  (cron/job)  │    │ Worker       │    │  (DB / file)  │  │
│  └─────────────┘    └──────┬───────┘    └───────────────┘  │
│                            │                                │
│              ┌─────────────┼─────────────┐                 │
│              ↓             ↓             ↓                 │
│    Keycloak Admin    Auth0 Mgmt     Email Service           │
│    API (source)      API (dest)     (SendGrid etc.)         │
└─────────────────────────────────────────────────────────────┘
```

---

## State tracking per user

```
not_started   →  user exists in Keycloak, not yet touched
pre_created   →  shell account created in Auth0
email_sent    →  verification email sent (Mode B)
complete      →  user has set password in Auth0 (full migration)
failed        →  error during migration (retry queue)
```

---

## Retry and error handling

Users that fail to migrate go into a retry queue:

```
Max retries:   3
Retry delay:   exponential backoff (1min → 5min → 30min)
After 3 fails: alert sent to migration ops team
               user flagged as "manual_review"
```

Common failure reasons:
- Invalid / missing email in Keycloak
- Auth0 rate limit hit (Management API: 1000 req/min on most plans)
- Duplicate email already exists in Auth0 under a different connection

---

## Auth0 rate limit awareness

Auth0 Management API has rate limits. For 100 users this is not a concern.
For 10,000+ users, batch carefully:

| Auth0 Plan | Management API limit | Safe batch size |
|---|---|---|
| Free | 2 req/sec | 1 at a time |
| Developer | 10 req/sec | 5 at a time |
| Professional | 50 req/sec | 25 at a time |
| Enterprise | Custom | Negotiate |

For InsureConnect's 100 users: a single run completes in under 2 minutes
on any plan.

---

## Strengths

- Fully automated — no manual steps after setup
- No dependency on user behaviour
- Works for truly dormant users who never log in
- Full audit trail with timestamps per user
- Handles failures gracefully with retries

---

## Weaknesses

- Highest technical complexity of all strategies
- Requires infrastructure to run the job (scheduler, DB for state)
- Still needs lazy migration or proactive email for password migration
  (pre-creating shell accounts does not migrate the password itself)
- Over-engineering for 100 users — valuable at 10,000+ users

---

## When to use

| User count | Recommendation |
|---|---|
| < 500 | Proactive email (Strategy 3) is simpler and sufficient |
| 500–5,000 | Background service worth building |
| 5,000+ | Background service is essential |

For InsureConnect's current 100 users, the migration scripts in
`/scripts/migrate-to-auth0.js` combined with Strategy 3 emails
achieve the same result without the operational overhead.

---

## Related scripts

- Seeding 100 users: [`/scripts/seed-keycloak-users.js`](../../scripts/seed-keycloak-users.js)
- Exporting and importing: [`/scripts/migrate-to-auth0.js`](../../scripts/migrate-to-auth0.js)
- Auth0 login script: [`/scripts/auth0-custom-db-login.js`](../../scripts/auth0-custom-db-login.js)
