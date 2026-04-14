# Strategy 5 — Permanent Fallback (Keep Both IDPs)

## What it is

Never fully decommission Keycloak. Auth0 always tries its own database first,
and falls back to Keycloak for any user it does not recognise. Both systems
run in parallel indefinitely.

---

## How it works

```
User logs in to Auth0
         ↓
Auth0 checks its own DB
         │
  ┌──────┴──────┐
Found          Not found
  │                │
✅ Authenticate    Auth0 Login Script
  normally        calls Keycloak ROPC
                       │
              ┌────────┴────────┐
         Keycloak: ✅       Keycloak: ❌
              │                   │
    Auth0 migrates user      Wrong credentials
    (now in Auth0 DB)        Error returned
    Keycloak still kept
```

Once a user is migrated by this fallback, Auth0 handles them directly
on all future logins. Keycloak is only called for users who have
never logged in through Auth0.

---

## Why teams choose this

- Absolute zero disruption — guaranteed
- No email campaigns, no coordination, no cutover date
- Users who log in once a year are fully supported
- Simple to reason about

---

## Why this is risky long term

### Dual maintenance burden
You now own two identity systems permanently:

```
Keycloak:  OS patches, JVM updates, Postgres DB backups,
           SSL certificates, realm configuration,
           security vulnerability monitoring

Auth0:     Plan costs, tenant management, rule updates,
           connection configuration
```

Both require attention. A vulnerability in Keycloak is now your problem
even though you "moved" to Auth0.

### Security surface doubles
Two login paths means two attack surfaces:
- Keycloak's ROPC endpoint stays open permanently
- Any Keycloak vulnerability is a vulnerability in your auth flow
- Credential stuffing attacks can target Keycloak directly

### ROPC is permanently enabled
Direct Access Grants on `insurance-portal` must stay on forever.
ROPC bypasses the browser-based OAuth flow and does not support:
- MFA challenges
- Bot detection
- Brute force protection at the Auth0 layer

For an insurance app with compliance requirements (NAIC, SOC 2),
permanent ROPC is difficult to justify in a security audit.

### Unpredictable Keycloak dependency
If Keycloak goes down, Auth0 cannot authenticate unmigrated users.
You have a hidden critical dependency that is easy to forget about
until it fails.

```
Keycloak server crashes at 3am
  → Unmigrated user tries to log in at 3am to check claim status
  → Login fails (Keycloak unreachable)
  → Support ticket: "I can't access my account"
  → On-call engineer wakes up to restart Keycloak
```

---

## When this is acceptable

| Situation | Acceptable? |
|---|---|
| Small internal tool, not customer-facing | Yes |
| Short-term bridge (under 6 months) | Yes |
| Customer-facing insurance portal | No |
| SOC 2 / NAIC compliant environment | No |
| Product with SLA commitments | No |

---

## The compromise position

If you want Keycloak as a fallback **temporarily** (not permanently):

1. Keep Keycloak alive for 90 days as a fallback only
2. Run proactive email migration during those 90 days
3. On day 90, disable ROPC on Keycloak
4. Any remaining unmigrated users get an on-demand reset at next login
5. Decommission Keycloak at day 120 once confirmed no fallback traffic

This gives you the safety of a fallback with a clear decommission date.

---

## Comparison with other strategies

| | Permanent Fallback | Proactive Email | Hash Migration |
|---|---|---|---|
| User disruption | None | Minimal (1 click) | None |
| Keycloak decommissioned | Never | Day 90 | Day 30 |
| ROPC required | Forever | 90 days only | Not required |
| Security posture | Weakened | Improved | Best |
| Operational cost | Highest | Low | Medium |
