# Azure AD + Keycloak Integration Guide
### Enterprise Identity Brokering Setup
**Version:** 1.0 | **Audience:** IT Admin + DevOps Engineer

---

## Why This Setup

```
┌─────────────────────────────────────────────────────────┐
│  SITUATION IN MOST COMPANIES                            │
│                                                         │
│  ✅ Already paying for Microsoft 365                    │
│  ✅ All 500 employees already in Azure AD               │
│  ✅ IT team manages Azure AD every day                  │
│  ✅ MFA already enforced in Azure AD                    │
│                                                         │
│  WHY NOT USE AZURE AD ALONE?                            │
│                                                         │
│  ❌ Every internal app registration requires IT         │
│  ❌ Dev teams can't control app-level roles freely      │
│  ❌ Custom token claims require Azure AD Premium ($$)   │
│  ❌ Vendor lock-in — moving away is expensive           │
│                                                         │
│  THE HYBRID ANSWER:                                     │
│  Azure AD = WHO the user is    (IT owns)                │
│  Keycloak  = WHAT they can do  (Dev team owns)          │
└─────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

```
                  ┌──────────────────────────────┐
                  │       MICROSOFT AZURE AD     │
                  │                              │
                  │  manoj@company.com ─────┐    │
                  │  alice@company.com      │    │
                  │  bob@company.com        │    │
                  │  ...500 employees       │    │
                  │                         │    │
                  │  MFA ✅                 │    │
                  │  Password Policy ✅     │    │
                  │  Conditional Access ✅  │    │
                  └─────────────────────────┼────┘
                                            │
                               OIDC Federation
                               (one-time setup)
                                            │
                  ┌─────────────────────────▼────┐
                  │           KEYCLOAK           │
                  │                              │
                  │  Receives Azure AD identity  │
                  │  Maps to app-specific roles  │
                  │  Issues JWT for your apps    │
                  │                              │
                  │  manoj → it-admin            │
                  │  alice → hr-manager          │
                  │  bob   → finance-team        │
                  └──────────────┬───────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
   HR Portal              Payroll App             Admin Dashboard
   (alice only)           (bob only)              (manoj, dave)
```

---

## Step-by-Step Setup

### STEP 1 — Register Keycloak in Azure AD

```
Who does this: IT Admin (Azure AD access required)
Time: 15 minutes
```

```
1. Login to Azure Portal
   → https://portal.azure.com

2. Search: "App Registrations" → New Registration

3. Fill in:
   Name:          "Company Keycloak SSO"
   Supported types: "Accounts in this org only"
   Redirect URI:  Web → https://sso.company.com/realms/demo/broker/oidc/endpoint
                  (local: http://localhost:8080/realms/demo/broker/oidc/endpoint)

4. Click Register → you'll land on the app overview page

5. COPY and save these (you'll need them in Step 2):
   ┌──────────────────────────────────────────────────────┐
   │ Application (client) ID:  xxxxxxxx-xxxx-xxxx-xxxx   │
   │ Directory (tenant) ID:    yyyyyyyy-yyyy-yyyy-yyyy   │
   └──────────────────────────────────────────────────────┘

6. Left menu → Certificates & Secrets → New client secret
   Description: keycloak-sso
   Expires:     24 months
   → Add
   COPY the Value immediately (shown only once):
   ┌──────────────────────────────────────────────────────┐
   │ Client Secret: zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz  │
   └──────────────────────────────────────────────────────┘

7. Left menu → API permissions → Add permission
   → Microsoft Graph → Delegated → openid, email, profile
   → Grant admin consent ✅
```

---

### STEP 2 — Add Azure AD as Identity Provider in Keycloak

```
Who does this: DevOps / Platform Engineer
Time: 10 minutes
```

```
Option A — Via Keycloak Admin UI:

1. Open http://localhost:8080 → login as admin
2. Select realm: demo
3. Left menu → Identity Providers → Add provider → OpenID Connect v1.0

4. Fill in:
   Alias:           azure-ad
   Display Name:    Login with Microsoft
   Discovery URL:   https://login.microsoftonline.com/{TENANT_ID}/v2.0/.well-known/openid-configuration
   (replace {TENANT_ID} with your Directory ID from Step 1)

5. Click: Import from URL → Keycloak auto-fills all endpoints

6. Fill in:
   Client ID:       {APPLICATION_ID from Step 1}
   Client Secret:   {CLIENT_SECRET from Step 1}
   Default Scopes:  openid profile email

7. Sync Mode:       IMPORT  (Azure AD is source of truth)
   Trust Email:     ON      (Azure AD already verifies emails)
   Store tokens:    OFF     (we don't need Azure tokens after login)

8. → Save
```

```
Option B — Via realm JSON (Infrastructure as Code):

Add to demo-realm.json:

"identityProviders": [
  {
    "alias": "azure-ad",
    "displayName": "Login with Microsoft",
    "providerId": "oidc",
    "enabled": true,
    "trustEmail": true,
    "storeToken": false,
    "firstBrokerLoginFlowAlias": "first broker login",
    "config": {
      "authorizationUrl": "https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/authorize",
      "tokenUrl":         "https://login.microsoftonline.com/TENANT_ID/oauth2/v2.0/token",
      "jwksUrl":          "https://login.microsoftonline.com/TENANT_ID/discovery/v2.0/keys",
      "userInfoUrl":      "https://graph.microsoft.com/oidc/userinfo",
      "clientId":         "YOUR_AZURE_APP_CLIENT_ID",
      "clientSecret":     "YOUR_AZURE_CLIENT_SECRET",
      "defaultScope":     "openid profile email",
      "syncMode":         "IMPORT"
    }
  }
]
```

---

### STEP 3 — Map Azure AD Users to Keycloak Roles

```
When Azure AD user logs in for the FIRST TIME via Keycloak:
  → Keycloak creates a local user record (shadow account)
  → No password stored — authentication always goes to Azure AD
  → You then assign Keycloak roles to this shadow account
  → From 2nd login onwards: fully automatic
```

```
Option A — Manual assignment (IT admin does this for each user):

  Keycloak Admin → Users → search by email
  Find the Azure AD user (created automatically on first login)
  → Role Mapping → Assign role → Filter by realm roles
  → Pick: hr-manager / finance-team / etc.


Option B — Automatic role mapping via Identity Provider Mappers:

  Keycloak Admin → Identity Providers → azure-ad → Mappers → Add

  MAPPER 1 — Give everyone "employee" role automatically:
    Name:        All Azure AD users get employee role
    Sync Mode:   INHERIT
    Type:        Hardcoded Role
    Role:        employee

  MAPPER 2 — Map Azure AD group to Keycloak role (requires Azure AD groups):
    Name:        HR Department → hr-manager role
    Sync Mode:   FORCE
    Type:        Claim to Role
    Claim:       groups
    Claim Value: HR-Department-Group-ID-from-Azure-AD
    Role:        hr-manager
```

---

### STEP 4 — Test the Integration

```
1. Open http://localhost:3000

2. Click "Login with Company SSO"

3. Keycloak login page appears
   → You'll now see a button: "Login with Microsoft"
   (alongside the username/password form for local users)

4. Click "Login with Microsoft"
   → Redirected to Microsoft login page
   → Enter: manoj@company.com + your Azure password
   → Complete MFA if required

5. Microsoft redirects back to Keycloak
   → Keycloak creates local shadow account for manoj
   → Apply any automatic role mappers

6. First-time only: Keycloak may ask to confirm email
   → This is the "First Broker Login" flow
   → Can be disabled/customised in Authentication flows

7. Routed to your app based on role ✅
```

---

## What Happens Under the Hood

```
FIRST LOGIN (Azure AD user):
─────────────────────────────

User: manoj@company.com clicks "Login with Microsoft"
              │
              ▼
Keycloak → Azure AD:
  "Authenticate this user for client_id={keycloak-app-id}"
              │
              ▼
Azure AD login + MFA
              │
              ▼
Azure AD → Keycloak:
  {
    "sub":   "azure-user-object-id",
    "email": "manoj@company.com",
    "name":  "Manoj Kumar",
    "groups": ["IT-Admins", "All-Employees"]
  }
              │
              ▼
Keycloak:
  1. Creates local user: manoj@company.com
  2. Applies mappers: groups[IT-Admins] → it-admin role
  3. Issues JWT with Keycloak roles
              │
              ▼
App receives JWT:
  {
    "email": "manoj@company.com",
    "realm_access": {
      "roles": ["it-admin", "employee"]     ← Keycloak roles
    },
    "identity_provider": "azure-ad",        ← came via Azure AD
    "exp": 1711234567
  }


SUBSEQUENT LOGINS:
──────────────────
  Same flow, but Keycloak already has the user record.
  Roles already assigned.
  If MFA configured in Azure AD → enforced automatically.
```

---

## Security Considerations

```
1. AZURE AD HANDLES:
   ✅ Password policy (length, complexity, rotation)
   ✅ MFA enforcement
   ✅ Conditional access (block login from untrusted countries)
   ✅ Account lockout
   ✅ Compromised credential detection (Microsoft threat intelligence)

2. KEYCLOAK HANDLES:
   ✅ App-level role mapping
   ✅ Token issuance and signing for your apps
   ✅ Session management across your apps
   ✅ App-specific access control

3. YOUR APPS HANDLE:
   ✅ Role-based UI rendering
   ✅ API endpoint protection based on token claims

SEPARATION OF CONCERNS:
  Microsoft secures the IDENTITY
  Keycloak secures the ACCESS
  Your apps enforce the PERMISSIONS
```

---

## Troubleshooting

```
ISSUE: "Login with Microsoft" button not showing
  → Check Identity Provider is enabled in Keycloak
  → Check alias matches exactly: azure-ad
  → Clear browser cache and retry

ISSUE: Redirect URI mismatch error from Azure AD
  → Azure Portal → App Registration → Authentication
  → Add: http://localhost:8080/realms/demo/broker/oidc/endpoint
  → Must match EXACTLY (no trailing slash difference)

ISSUE: User logs in but has no roles
  → Check Identity Provider Mappers in Keycloak
  → Or manually assign roles in Keycloak Admin → Users

ISSUE: "AADSTS50011: The reply URL does not match"
  → Azure AD is rejecting the redirect URI
  → Go to Azure Portal → App Registrations → your app
  → Authentication → Add the exact redirect URI Keycloak is using

ISSUE: User profile picture / name not syncing
  → Add to Default Scopes: openid profile email User.Read
  → Add mapper: Attribute Importer for 'name' claim
```

---

*For questions on Azure AD configuration: contact IT Admin team.*
*For questions on Keycloak role mapping: contact Platform Engineering.*
