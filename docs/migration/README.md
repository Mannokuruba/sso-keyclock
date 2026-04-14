# User Migration Guide — Keycloak → Auth0

> Context: InsureConnect insurance portal migrating 100+ users from Keycloak to Auth0
> without forcing password resets.

---

## The Core Problem

Passwords are one-way hashed. You cannot export them in plaintext.
Moving users between identity providers without disruption requires a strategy.

The wrong approach — bulk export + force reset — looks like this from a user's perspective:

```
User opens app to file an urgent claim at 11pm
  → "Your account has been migrated. Please reset your password."
  → User is frustrated. Calls support. Files complaint.
```

Insurance users log in infrequently (renewals, claims, policy changes).
The migration window cannot assume they will log in during it.

---

## Strategy Overview

| Strategy | User disruption | Technical effort | Recommended for |
|---|---|---|---|
| [Lazy Migration](./01-lazy-migration.md) | None (for active users) | Low | High-frequency apps only |
| [Bulk Hash Migration](./02-bulk-hash-migration.md) | None | Medium | When bcrypt hashes are available |
| [Proactive Email Migration](./03-proactive-email-migration.md) | Minimal (one click) | Low | Insurance / infrequent login apps |
| [Background Migration Service](./04-background-migration-service.md) | None | High | Large enterprise, full automation |
| [Permanent Fallback](./05-permanent-fallback.md) | None ever | Low | Never shut down old IDP |

---

## Recommended Approach for InsureConnect

Use a **combination** in phases:

```
Phase 1 (Week 1–4)   →  Switch Keycloak to bcrypt hashing
Phase 2 (Month 1–2)  →  Bulk hash import for active users (zero disruption)
Phase 3 (Month 2)    →  Proactive "security upgrade" email for inactive users
Phase 4 (Month 3)    →  Forced reset for last ~5% dormant accounts
Phase 5 (Day 90)     →  Decommission Keycloak
```

Full timeline: [Decision Guide →](./06-decision-guide.md)

---

## Files in this directory

| File | What it covers |
|---|---|
| [01-lazy-migration.md](./01-lazy-migration.md) | On-demand migration at login time |
| [02-bulk-hash-migration.md](./02-bulk-hash-migration.md) | Exporting and importing password hashes |
| [03-proactive-email-migration.md](./03-proactive-email-migration.md) | Controlled email-driven migration |
| [04-background-migration-service.md](./04-background-migration-service.md) | Automated background migration job |
| [05-permanent-fallback.md](./05-permanent-fallback.md) | Keeping old IDP as permanent fallback |
| [06-decision-guide.md](./06-decision-guide.md) | How to choose + full migration timeline |
