# Decision Guide — Choosing the Right Migration Strategy

## Quick decision tree

```
Are your users high-frequency? (log in weekly or more)
  └─ YES → Lazy Migration alone is fine
  └─ NO  ↓

Can you export bcrypt hashes from Keycloak?
  (Did you switch Keycloak to bcrypt before cutover?)
  └─ YES → Bulk Hash Migration for active users
           + Proactive Email for inactive users
  └─ NO  ↓

How many users do you have?
  └─ < 5,000  → Proactive Email Migration (Strategy 3) ✅ Recommended
  └─ > 5,000  → Background Migration Service (Strategy 4)

Do you need a zero-disruption guarantee regardless of cost?
  └─ YES → Permanent Fallback (Strategy 5) — but read the risks
```

---

## InsureConnect recommendation

**Combination: Hash Migration + Proactive Email + Lazy fallback**

This covers every user in every scenario with no forced resets.

---

## Full migration timeline for InsureConnect

### Month 1 — Prepare

| Week | Action | Owner |
|---|---|---|
| 1 | Change Keycloak password policy to bcrypt | DevOps |
| 1 | Set up Auth0 Custom Database connection | Dev |
| 1 | Deploy Login script (lazy fallback) | Dev |
| 2 | Run `seed-keycloak-users.js` to populate test users | Dev |
| 2 | Test lazy migration end-to-end in staging | QA |
| 3 | Set up Auth0 Management API access | Dev |
| 3 | Draft email copy, get legal/compliance approval | Product |
| 4 | Test email delivery, verify links work | QA |

### Month 2 — Migrate active users (bcrypt hash import)

| Week | Action | Users affected |
|---|---|---|
| 1 | Export bcrypt hashes from Keycloak Postgres | — |
| 1 | Run bulk hash import to Auth0 | Active users (~60%) |
| 1 | Verify imported users can log in via Auth0 | Active users |
| 2 | Send Wave 1 email to remaining users | Inactive users |
| 4 | Send Wave 2 email to non-responders | ~35% remaining |

### Month 3 — Close out

| Week | Action | Users affected |
|---|---|---|
| 1 | Send Wave 3 final reminder | ~15% remaining |
| 2 | Internal announcement: Keycloak going offline in 14 days | All staff |
| 3 | Disable ROPC on Keycloak insurance-portal client | — |
| 3 | Monitor Auth0 logs for failed login attempts | — |
| 4 | Any remaining users get on-demand reset at next login | ~3–5% |
| 4 | Decommission Keycloak (stop Docker container) | — |
| 4 | Archive Keycloak Postgres data for compliance | — |

### Month 4 — Confirm

| Action | Verification |
|---|---|
| Auth0 is sole IDP | No Keycloak-dependent auth paths remain |
| All users accessible | 100% of users have Auth0 accounts |
| Security posture improved | ROPC disabled, single attack surface |
| Compliance documented | Migration audit log retained |

---

## Rollback plan

If Auth0 has issues during migration, rolling back is straightforward:

```
Day 1–30  →  Keycloak still fully operational, just re-enable it
Day 30–60 →  Some users in Auth0, some in Keycloak. Auth0 login script
              still calls Keycloak as fallback. No data lost.
Day 60–90 →  Most users in Auth0. Rolling back means re-importing
              the original Keycloak users export.
Day 90+   →  Keycloak decommissioned. Rollback would require
              restoring from Postgres backup.
```

**Always keep Keycloak Postgres backups until Month 4 is confirmed complete.**

---

## What "done" looks like

```
Auth0 Dashboard → Users → Filter by app_metadata.migration_status

pending      0   ✅
email_sent   0   ✅
complete    97   ✅  (97 users fully migrated)
failed       0   ✅

3 users had undeliverable emails → manually reset via support ✅

Keycloak container: stopped and archived
Postgres volume: backed up to cold storage
ROPC endpoint: disabled (verified)
```

---

## Summary comparison

| Strategy | Best for | User disruption | Complexity | Keycloak lifetime |
|---|---|---|---|---|
| Lazy Migration | Frequent-login apps | None | Low | Until last user logs in |
| Bulk Hash Migration | Active users with bcrypt | None | Medium | 30 days |
| Proactive Email | Infrequent-login apps (**InsureConnect**) | 1 click | Low | 90 days |
| Background Service | 5,000+ users | None | High | 90 days |
| Permanent Fallback | Risk-averse, no cutover deadline | None | Low | Forever |

---

## Compliance considerations for insurance

| Requirement | How migration addresses it |
|---|---|
| NAIC Model Law | Users retain continuous access to policies throughout migration |
| SOC 2 Access Control | Auth0 becomes the single authoritative IDP with full audit logs |
| Data Residency | Auth0 tenant region matches Keycloak's data region |
| Password Security | bcrypt hashes re-imported, no plaintext ever transmitted |
| Audit Trail | `app_metadata.migration_status` timestamps every user's migration |
