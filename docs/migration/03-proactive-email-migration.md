# Strategy 3 — Proactive Email Migration

## What it is

Instead of waiting for users to log in on their own (lazy migration), you
proactively contact them before the migration cutover and guide them through a
one-click account verification. The user sets their own password on their schedule,
before they ever need to file a claim or access their policy.

This is the **recommended primary strategy for insurance apps** where users log
in infrequently.

---

## Why "password reset" is the wrong framing

Calling it a password reset signals something went wrong. Users get confused
and concerned about security breaches.

The right framing:

```
❌  "Your account has been migrated. Please reset your password."

✅  "We've upgraded InsureConnect's security platform.
     Please verify your account to continue — takes 30 seconds."
```

Same technical action. Completely different user experience.
Insurance companies, banks, and healthcare providers do this routinely
as part of platform upgrades. Users understand and expect it.

---

## How it works

```
┌─────────────────────────────────────────────────────┐
│  Before migration cutover (you control the timing)  │
└─────────────────────────┬───────────────────────────┘
                          ↓
        Export all users from Keycloak (no passwords)
                          ↓
        Pre-create shell accounts in Auth0
        (email, name, roles — no password hash)
                          ↓
        Auth0 generates a "change password" ticket per user
        (a secure, time-limited one-click URL)
                          ↓
        Send branded InsureConnect email to each user:
        "Verify your account → [one-click link]"
                          ↓
              User clicks link at their convenience
                          ↓
              Auth0 presents "Set your new password" form
                          ↓
              User sets password → account fully migrated ✅
                          ↓
        migration_status updated to "complete" in app_metadata
```

---

## Email campaign strategy

### Wave 1 — Soft introduction (Month 2, Week 1)
Subject: `InsureConnect Security Upgrade — Verify Your Account`

```
Hi [First Name],

We've upgraded InsureConnect to a more secure authentication
platform to better protect your insurance account.

Please take 30 seconds to verify your account:

  [Verify My Account]

This link expires in 14 days. Your policies, claims, and
account history are fully intact — this is just a security update.

Questions? Call us: 1-800-XXX-XXXX
```

### Wave 2 — Reminder (2 weeks later, non-responders only)
Subject: `Reminder: Your InsureConnect Account Needs Verification`

```
Hi [First Name],

We noticed you haven't verified your InsureConnect account yet.
Your current access will continue for 30 more days, but we
recommend verifying now to avoid any interruption.

  [Verify My Account — Link expires in 30 days]
```

### Wave 3 — Urgency (1 week before cutover)
Subject: `Action Required: InsureConnect Account Verification (7 days left)`

```
Hi [First Name],

This is your final reminder. In 7 days, unverified accounts
will require password verification to access your policies and claims.

Please verify now to ensure uninterrupted access:

  [Verify My Account Now]

Your claims, policies, and account history will NOT be affected.
```

---

## Auth0 Change Password Ticket API

Auth0 provides a Management API endpoint to generate one-click password
change tickets per user:

```
POST https://{domain}/api/v2/tickets/password-change
{
  "user_id": "auth0|...",
  "result_url": "https://insureconnect.com/dashboard",
  "ttl_sec": 1209600,       ← 14 days
  "mark_email_as_verified": true,
  "includeEmailInRedirect": false
}
```

Returns a `ticket` URL. Embed this in the email. When the user clicks it,
Auth0 presents the new password form. Once set, the user is fully migrated.

---

## Tracking migration progress

Store migration status in `app_metadata`:

```json
{
  "migration_status": "pending",     ← shell account created, email not sent
  "migration_status": "email_sent",  ← Wave 1 email sent
  "migration_status": "complete",    ← user clicked link and set password
  "migration_wave": 1,
  "email_sent_at": "2026-05-01T10:00:00Z"
}
```

Dashboard query each week:
```
pending      → 100  (start)
email_sent   → 100  (after Wave 1)
complete     →  68  (after 2 weeks, ~68% click rate typical)
remaining    →  32  (get Wave 2)
```

---

## Expected click rates for insurance

Based on industry benchmarks for account verification emails:

| Wave | Timing | Expected completion |
|---|---|---|
| Wave 1 | Immediately | 55–65% |
| Wave 2 | +2 weeks | +15–20% |
| Wave 3 | +4 weeks | +5–8% |
| Remaining | Force reset | ~3–5% |

After 3 waves, typically **93–97% of users are migrated without a forced reset**.
The remaining 3–7% are truly dormant accounts (often abandoned).

---

## Strengths

- You control exactly when users get migrated — not dependent on their login behaviour
- No technical fallback to Keycloak required
- Professionally framed — strengthens user trust rather than eroding it
- Works regardless of password hash format (no hash compatibility issues)
- Full audit trail of who migrated and when

---

## Weaknesses

- Requires email deliverability to be reliable (check spam rates first)
- Users must take one action (not fully zero-disruption like hash migration)
- Needs Auth0 Management API access to generate tickets at scale
- Must handle bounced / invalid emails in the Keycloak export

---

## Handling non-responders at cutover

For users who never click through all three waves:

1. At cutover, disable Keycloak login (remove ROPC)
2. If a non-migrated user tries to log in, show:
   ```
   "Welcome back. To complete your account security upgrade,
    please set a new password. We've sent an email to [email]."
   ```
3. Trigger a fresh password reset ticket on-demand
4. This is the **only** moment users experience a "forced" reset —
   and it's 3–5% of users, not 100%
