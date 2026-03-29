# Insurance Company — SSO Architecture
### OAuth 2.0 + Keycloak + Azure AD | Department-Based Dynamic Permissions
**Version:** 1.0 | **Audience:** Architects, Engineering Leads, IT Security, Stakeholders

---

## Table of Contents
1. [Executive Overview](#1-executive-overview)
2. [Full System Architecture](#2-full-system-architecture)
3. [OAuth 2.0 + OIDC Complete Flow](#3-oauth-20--oidc-complete-flow)
4. [Azure AD + Keycloak Federation](#4-azure-ad--keycloak-federation)
5. [Insurance Departments & Applications](#5-insurance-departments--applications)
6. [Dynamic Role & Permission Model](#6-dynamic-role--permission-model)
7. [Department Access Matrix](#7-department-access-matrix)
8. [Token Flow — What Each Layer Sees](#8-token-flow--what-each-layer-sees)
9. [User Lifecycle — Hire to Retire](#9-user-lifecycle--hire-to-retire)
10. [Security Layers](#10-security-layers)
11. [Hidden Flows You Must Know](#11-hidden-flows-you-must-know)
12. [Production Checklist](#12-production-checklist)

---

## 1. Executive Overview

```mermaid
graph TD
    A["👤 Insurance Employee"] -->|One Login| B["🏢 Company Portal"]
    B -->|Who are you?| C["🔐 Azure AD - Microsoft Identity"]
    C -->|Verified Identity| D["⚙️ Keycloak - Access Engine"]
    D -->|Role-based routing| E["📋 Underwriting System"]
    D -->|Role-based routing| F["🏥 Claims Portal"]
    D -->|Role-based routing| G["💰 Finance Suite"]
    D -->|Role-based routing| H["👥 HR System"]
    D -->|Role-based routing| I["📊 Compliance Dashboard"]
    D -->|Role-based routing| J["🛡️ Policy Admin"]
    D -->|Role-based routing| K["📞 Customer Service"]

    style A fill:#4a90d9,color:#fff
    style B fill:#2c3e50,color:#fff
    style C fill:#0078d4,color:#fff
    style D fill:#e74c3c,color:#fff
    style E fill:#27ae60,color:#fff
    style F fill:#e67e22,color:#fff
    style G fill:#8e44ad,color:#fff
    style H fill:#16a085,color:#fff
    style I fill:#c0392b,color:#fff
    style J fill:#2980b9,color:#fff
    style K fill:#f39c12,color:#fff
```

**The Core Principle:**
> Azure AD answers **"Is this a real company employee?"**
> Keycloak answers **"Which insurance systems can they access?"**
> Apps answer **"What can they do inside this system?"**

---

## 2. Full System Architecture

```mermaid
graph TB
    subgraph INTERNET["Internet / Company Network"]
        EMP["👤 Employee Browser"]
    end

    subgraph ENTRY["Entry Layer"]
        WAF["🛡️ WAF / Load Balancer - Cloudflare / Azure Front Door"]
        PORTAL["🏢 Company Portal - portal.insurance.com"]
    end

    subgraph IDENTITY["Identity Layer"]
        AAD["☁️ Azure Active Directory - Microsoft Cloud - All 2000 employees"]
        KC["⚙️ Keycloak Cluster - sso.insurance.com"]
        PG[("🗄️ PostgreSQL - Users, Roles, Sessions, Audit")]
    end

    subgraph APPS["Application Layer — Insurance Systems"]
        UW["📋 Underwriting - Port 3001"]
        CL["🏥 Claims - Port 3002"]
        FIN["💰 Finance - Port 3003"]
        HR["👥 HR System - Port 3004"]
        COMP["📊 Compliance - Port 3005"]
        POL["🛡️ Policy Admin - Port 3006"]
        CS["📞 Customer Service - Port 3007"]
        ADMIN["⚙️ IT Admin - Port 3008"]
    end

    subgraph AUDIT["Observability"]
        SIEM["📡 SIEM - Splunk / Elastic"]
        ALERT["🔔 Alerting - PagerDuty"]
    end

    EMP --> WAF
    WAF --> PORTAL
    PORTAL -->|OIDC Auth Request| KC
    KC -->|Identity Brokering| AAD
    AAD -->|Verified Identity| KC
    KC -->|JWT Token| PORTAL
    PORTAL --> UW & CL & FIN & HR & COMP & POL & CS & ADMIN
    KC --> PG
    KC -->|Audit Events| SIEM
    SIEM --> ALERT

    style AAD fill:#0078d4,color:#fff
    style KC fill:#e74c3c,color:#fff
    style PG fill:#336791,color:#fff
    style PORTAL fill:#2c3e50,color:#fff
    style SIEM fill:#005571,color:#fff
```

---

## 3. OAuth 2.0 + OIDC Complete Flow

### Authorization Code Flow — What happens when employee logs in

```mermaid
sequenceDiagram
    actor E as 👤 Employee
    participant B as 🌐 Browser
    participant P as 🏢 Portal App
    participant KC as ⚙️ Keycloak
    participant AAD as ☁️ Azure AD
    participant APP as 📋 Insurance App

    Note over E,APP: STEP 1 - Employee visits portal
    E->>B: Open portal.insurance.com
    B->>P: GET /
    P->>P: No session found
    P-->>B: 302 Redirect to /login

    Note over E,APP: STEP 2 - App generates security tokens
    B->>P: GET /login
    P->>P: Generate state=a3f9x2 (CSRF token)
    P->>P: Generate nonce=k8p1m7 (replay prevention)
    P->>P: Save both to server session
    P-->>B: 302 Redirect to Keycloak
    Note right of P: URL includes client_id, state, nonce, scope, response_type

    Note over E,APP: STEP 3 - Keycloak shows login page
    B->>KC: GET /realms/insurance/protocol/openid-connect/auth
    KC-->>B: Login page with Login with Microsoft button

    Note over E,APP: STEP 4 - Employee chooses Microsoft login
    E->>B: Click Login with Microsoft
    B->>KC: User chose Azure AD provider
    KC-->>B: 302 Redirect to Azure AD

    Note over E,APP: STEP 5 - Azure AD authenticates
    B->>AAD: GET /oauth2/v2.0/authorize
    AAD-->>B: Microsoft login page + MFA prompt
    E->>B: Enter company email + password + MFA code
    B->>AAD: POST credentials
    AAD->>AAD: Valid employee check
    AAD->>AAD: Password verified
    AAD->>AAD: MFA passed
    AAD-->>B: 302 to Keycloak callback with Azure code

    Note over E,APP: STEP 6 - Keycloak receives Azure identity
    B->>KC: GET /broker/azure-ad/endpoint?code=AZURE_CODE
    KC->>AAD: POST Exchange Azure code for tokens
    AAD-->>KC: Azure ID token with name, email, groups
    KC->>KC: Create or update shadow user
    KC->>KC: Map Azure groups to Keycloak roles
    KC->>KC: Issue ONE-TIME Authorization Code
    KC-->>B: 302 to Portal /callback?code=AUTH_CODE&state=a3f9x2

    Note over E,APP: STEP 7 - Portal validates and exchanges code
    B->>P: GET /callback?code=AUTH_CODE&state=a3f9x2
    P->>P: Validate state matches session (CSRF check)
    P->>KC: POST /token (server-to-server, hidden from browser)
    KC->>KC: Code valid and not expired check
    KC-->>P: access_token + id_token + refresh_token

    Note over E,APP: STEP 8 - Portal decodes roles and routes
    P->>P: Decode JWT and get roles
    P->>P: underwriter role maps to Underwriting System
    P-->>B: 302 to Underwriting System

    Note over E,APP: STEP 9 - App validates token on every request
    B->>APP: GET /dashboard with JWT in session cookie
    APP->>APP: Verify JWT signature - no Keycloak call needed
    APP->>APP: Check exp, iss, aud claims
    APP->>APP: Check roles - has underwriter
    APP-->>B: 200 Dashboard content
```

---

## 4. Azure AD + Keycloak Federation

### How Identity Flows from Microsoft to Your Apps

```mermaid
flowchart LR
    subgraph MS["☁️ Microsoft Azure"]
        AAD["Azure Active Directory"]
        AAD --> U1["john@insurance.com<br/>Dept: Underwriting"]
        AAD --> U2["sarah@insurance.com<br/>Dept: Claims"]
        AAD --> U3["mike@insurance.com<br/>Dept: Finance"]
        AAD --> U4["admin@insurance.com<br/>Dept: IT"]
        AAD --> GRP["Azure AD Groups<br/>Underwriting-Team<br/>Claims-Adjusters<br/>Finance-Team<br/>IT-Admins"]
    end

    subgraph KC["⚙️ Keycloak — Access Layer"]
        IDP["Identity Provider<br/>Azure AD Broker"]
        MAP["Role Mapper<br/>Azure Group to Keycloak Role"]
        ROLES["Keycloak Roles<br/>underwriter<br/>claims-adjuster<br/>finance-analyst<br/>it-admin<br/>compliance-officer<br/>employee"]
        TOKEN["JWT Token Issuer<br/>Signed RS256"]
    end

    subgraph APPS["🏢 Insurance Apps"]
        A1["Underwriting System<br/>Requires: underwriter"]
        A2["Claims Portal<br/>Requires: claims-adjuster"]
        A3["Finance Suite<br/>Requires: finance-analyst"]
        A4["IT Admin<br/>Requires: it-admin"]
    end

    AAD -->|OIDC Federation| IDP
    GRP -->|Group Claim| MAP
    MAP -->|Maps to| ROLES
    ROLES -->|Embedded in| TOKEN
    TOKEN -->|Validates| A1 & A2 & A3 & A4

    style AAD fill:#0078d4,color:#fff
    style TOKEN fill:#27ae60,color:#fff
```

### What Keycloak Receives from Azure AD vs What It Issues

```mermaid
flowchart TD
    subgraph IN["📥 FROM Azure AD - raw identity"]
        A["sub: azure-object-id-xyz<br/>email: john@insurance.com<br/>name: John Smith<br/>groups: Underwriting-Team, All-Employees<br/>department: Underwriting<br/>jobTitle: Senior Underwriter"]
    end

    subgraph PROC["⚙️ Keycloak Processing"]
        B["Shadow user created or updated"]
        C["Group mapper runs:<br/>Underwriting-Team to underwriter<br/>All-Employees to employee"]
        D["Realm roles assigned:<br/>underwriter + employee"]
    end

    subgraph OUT["📤 TO Your Apps - enriched JWT"]
        E["sub: keycloak-uuid-stable<br/>email: john@insurance.com<br/>name: John Smith<br/>realm_access.roles: underwriter, employee<br/>insurance_dept: Underwriting<br/>exp: 15 minutes from now<br/>iss: sso.insurance.com/realms/insurance"]
    end

    IN --> PROC
    PROC --> OUT

    style IN fill:#0078d4,color:#fff
    style PROC fill:#e74c3c,color:#fff
    style OUT fill:#27ae60,color:#fff
```

---

## 5. Insurance Departments & Applications

```mermaid
graph TD
    subgraph DEPT["🏢 Insurance Company Departments"]
        UW_DEPT["📋 Underwriting<br/>Assess risk, approve policies"]
        CL_DEPT["🏥 Claims<br/>Process and settle claims"]
        FIN_DEPT["💰 Finance and Actuarial<br/>Pricing, reserves, reporting"]
        HR_DEPT["👥 Human Resources<br/>People, payroll, hiring"]
        COMP_DEPT["📊 Compliance and Legal<br/>Regulatory, audits, GDPR"]
        POL_DEPT["🛡️ Policy Administration<br/>Policy lifecycle management"]
        CS_DEPT["📞 Customer Service<br/>Agent and customer support"]
        IT_DEPT["⚙️ IT and DevOps<br/>Systems, security, infra"]
    end

    subgraph SYS["💻 Insurance Applications"]
        UW_APP["Underwriting System<br/>Risk scoring, quote approval"]
        CL_APP["Claims Portal<br/>FNOL, adjuster workflow"]
        FIN_APP["Finance Suite<br/>Ledger, actuarial models"]
        HR_APP["HR System<br/>People management"]
        COMP_APP["Compliance Dashboard<br/>Audit trails, reports"]
        POL_APP["Policy Admin System<br/>Policy CRUD, endorsements"]
        CS_APP["Customer Service Portal<br/>Tickets, policy lookup"]
        ADMIN_APP["IT Admin Dashboard<br/>All systems monitoring"]
        DOCS["Document Portal<br/>All staff — read only"]
    end

    UW_DEPT -->|underwriter role| UW_APP
    CL_DEPT -->|claims-adjuster role| CL_APP
    FIN_DEPT -->|finance-analyst role| FIN_APP
    HR_DEPT -->|hr-manager role| HR_APP
    COMP_DEPT -->|compliance-officer role| COMP_APP
    POL_DEPT -->|policy-admin role| POL_APP
    CS_DEPT -->|customer-service role| CS_APP
    IT_DEPT -->|it-admin role| ADMIN_APP
    ALL["All Employees<br/>employee role"] -->|read access| DOCS

    style UW_DEPT fill:#27ae60,color:#fff
    style CL_DEPT fill:#e67e22,color:#fff
    style FIN_DEPT fill:#8e44ad,color:#fff
    style HR_DEPT fill:#16a085,color:#fff
    style COMP_DEPT fill:#c0392b,color:#fff
    style POL_DEPT fill:#2980b9,color:#fff
    style CS_DEPT fill:#f39c12,color:#fff
    style IT_DEPT fill:#7f8c8d,color:#fff
```

---

## 6. Dynamic Role & Permission Model

### How Permissions Are Checked on Every Request

```mermaid
flowchart TD
    REQ["👤 Employee makes request to insurance app"] --> SESSION{"Session<br/>cookie exists?"}

    SESSION -->|No| LOGIN["Redirect to Keycloak Login"]
    SESSION -->|Yes| JWT["Read JWT from session"]

    LOGIN --> KC["Keycloak Login Page"]
    KC --> AAD["Azure AD Authentication + MFA"]
    AAD --> ISSUED["JWT Issued with roles embedded"]
    ISSUED --> JWT

    JWT --> VERIFY{"Verify JWT<br/>Signature<br/>RS256 + public key"}
    VERIFY -->|Invalid signature| DENY1["❌ 401 Unauthorized - Tampered token"]
    VERIFY -->|Valid| EXPIRY{"Token<br/>expired?"}

    EXPIRY -->|Expired| REFRESH{"Refresh token<br/>still valid?"}
    REFRESH -->|Yes| NEWTOKEN["Silent token refresh - No re-login"]
    REFRESH -->|No| LOGIN
    NEWTOKEN --> ROLES
    EXPIRY -->|Not expired| ROLES

    ROLES["Extract roles from JWT<br/>realm_access.roles"] --> CHECK{"Has required<br/>role for this app?"}

    CHECK -->|it-admin| FULL["✅ Full access - All systems"]
    CHECK -->|underwriter| UW_OK["✅ Underwriting System + Docs"]
    CHECK -->|claims-adjuster| CL_OK["✅ Claims Portal + Docs"]
    CHECK -->|finance-analyst| FIN_OK["✅ Finance Suite + Docs"]
    CHECK -->|compliance-officer| CO_OK["✅ Compliance Dashboard + Audit views"]
    CHECK -->|No matching role| DENIED["🚫 403 Access Denied - Show allowed apps"]

    style DENY1 fill:#e74c3c,color:#fff
    style DENIED fill:#e74c3c,color:#fff
    style FULL fill:#27ae60,color:#fff
    style UW_OK fill:#27ae60,color:#fff
    style CL_OK fill:#27ae60,color:#fff
    style FIN_OK fill:#27ae60,color:#fff
    style CO_OK fill:#27ae60,color:#fff
```

### Role Hierarchy for Insurance

```mermaid
graph TD
    IT["⚙️ it-admin<br/>Superuser — all systems"] --> UW["📋 underwriter"]
    IT --> CL["🏥 claims-adjuster"]
    IT --> FIN["💰 finance-analyst"]
    IT --> HR["👥 hr-manager"]
    IT --> COMP["📊 compliance-officer"]
    IT --> POL["🛡️ policy-admin"]
    IT --> CS["📞 customer-service"]

    UW --> EMP["employee<br/>Docs Portal only"]
    CL --> EMP
    FIN --> EMP
    HR --> EMP
    COMP --> EMP
    POL --> EMP
    CS --> EMP

    COMP -.->|read-only audit| UW_APP["Underwriting System<br/>audit view only"]
    COMP -.->|read-only audit| CL_APP["Claims Portal<br/>audit view only"]
    COMP -.->|read-only audit| FIN_APP["Finance Suite<br/>audit view only"]

    style IT fill:#e74c3c,color:#fff
    style EMP fill:#95a5a6,color:#fff
    style COMP fill:#c0392b,color:#fff
```

---

## 7. Department Access Matrix

```mermaid
graph LR
    subgraph ROLES["👤 Employee Roles"]
        R1["underwriter"]
        R2["claims-adjuster"]
        R3["finance-analyst"]
        R4["hr-manager"]
        R5["compliance-officer"]
        R6["policy-admin"]
        R7["customer-service"]
        R8["it-admin"]
        R9["employee"]
    end

    subgraph APPS["💻 Applications"]
        A1["Underwriting System"]
        A2["Claims Portal"]
        A3["Finance Suite"]
        A4["HR System"]
        A5["Compliance Dashboard"]
        A6["Policy Admin System"]
        A7["Customer Service Portal"]
        A8["IT Admin Dashboard"]
        A9["Docs Portal"]
    end

    R1 -->|Full| A1
    R1 -->|Read| A9
    R2 -->|Full| A2
    R2 -->|Read| A9
    R3 -->|Full| A3
    R3 -->|Read| A9
    R4 -->|Full| A4
    R4 -->|Read| A9
    R5 -->|Full| A5
    R5 -->|Audit only| A1
    R5 -->|Audit only| A2
    R5 -->|Audit only| A3
    R5 -->|Read| A9
    R6 -->|Full| A6
    R6 -->|Read| A9
    R7 -->|Full| A7
    R7 -->|Read| A9
    R8 -->|All| A1
    R8 -->|All| A2
    R8 -->|All| A3
    R8 -->|All| A4
    R8 -->|All| A5
    R8 -->|All| A6
    R8 -->|All| A7
    R8 -->|All| A8
    R8 -->|All| A9
    R9 -->|Read| A9

    style R8 fill:#e74c3c,color:#fff
    style R5 fill:#c0392b,color:#fff
```

---

## 8. Token Flow — What Each Layer Sees

```mermaid
sequenceDiagram
    participant E as 👤 Employee
    participant APP as 🏢 Insurance App
    participant KC as ⚙️ Keycloak
    participant DB as 🗄️ PostgreSQL

    Note over E,DB: What travels where — and what each party sees

    E->>APP: Browser request with session cookie
    Note right of E: Employee sees URL only - never sees tokens

    APP->>APP: Read JWT from server session
    Note right of APP: App sees access_token and id_token - never sees password

    APP->>APP: Verify signature locally
    Note right of APP: Uses Keycloak public key cached from certs endpoint - no Keycloak call

    APP->>APP: Decode payload
    Note right of APP: realm_access.roles, sub, email, name, exp, iss, aud

    alt Token still valid
        APP-->>E: Serve content based on roles
    else Token expired after 15 min
        APP->>KC: POST /token with refresh_token grant
        KC->>DB: Validate refresh token
        DB-->>KC: Valid, session active
        KC-->>APP: New access_token plus rotated refresh_token
        APP-->>E: Serve content - silent refresh, user unaware
    else Refresh token expired after 10 hours
        APP-->>E: 302 to Login page - session fully expired
    end

    Note over KC,DB: Keycloak writes every login, token issued, logout, and failed attempt to DB
```

### JWT Token Structure — Decoded

```mermaid
graph TD
    JWT["JWT Token<br/>eyJhbGci...eyJzdWIi...SflK"] --> H["Header<br/>Algorithm: RS256<br/>Type: JWT"]
    JWT --> P["Payload<br/>All the claims"]
    JWT --> S["Signature<br/>RS256 signed by Keycloak private key"]

    P --> SUB["sub: keycloak-uuid<br/>Stable user identifier"]
    P --> EMAIL["email: john at insurance.com"]
    P --> NAME["name: John Smith"]
    P --> ROLES["realm_access.roles:<br/>underwriter, employee"]
    P --> ISS["iss: sso.insurance.com/realms/insurance<br/>Who issued it"]
    P --> AUD["aud: underwriting-system<br/>Who it is for"]
    P --> EXP["exp: Unix timestamp<br/>Expires in 15 minutes"]
    P --> DEPT["insurance_dept: Underwriting<br/>Custom claim added by Keycloak"]

    S --> VERIFY["App verifies with Keycloak PUBLIC key<br/>from /realms/insurance/certs"]
    VERIFY --> RESULT{"Signature<br/>Match?"}
    RESULT -->|Yes| TRUST["✅ Trust the token - Grant access"]
    RESULT -->|No| REJECT["❌ Reject — tampered - 401 Unauthorized"]

    style JWT fill:#2c3e50,color:#fff
    style TRUST fill:#27ae60,color:#fff
    style REJECT fill:#e74c3c,color:#fff
```

---

## 9. User Lifecycle — Hire to Retire

```mermaid
flowchart TD
    subgraph HIRE["Day 1 — New Hire"]
        H1["HR creates employee in Workday / SAP"] --> H2["Azure AD auto-provisions account via SCIM"]
        H2 --> H3["Assigned to Azure AD group: Underwriting-Team"]
        H3 --> H4["Employee gets welcome email with first-login link"]
        H4 --> H5["Employee logs in - Keycloak creates shadow account"]
        H5 --> H6["Azure group mapper fires:<br/>Underwriting-Team maps to underwriter role"]
        H6 --> H7["✅ Access granted to Underwriting System and Docs"]
    end

    subgraph CHANGE["Mid-Tenure — Role Change"]
        C1["Employee promoted: Senior Underwriter to Team Lead"] --> C2["IT updates Azure AD group - adds Claims-Managers"]
        C2 --> C3["Next Keycloak login: new group claim received"]
        C3 --> C4["Mapper fires: Claims-Managers maps to claims-adjuster"]
        C4 --> C5["✅ Now has access to Underwriting + Claims + Docs"]
    end

    subgraph TEMP["Temporary — Leave / Suspension"]
        T1["Employee on medical leave"] --> T2["IT disables account in Azure AD"]
        T2 --> T3["Current active tokens expire within 15 minutes"]
        T3 --> T4["All refresh attempts fail: 401 from Keycloak"]
        T4 --> T5["❌ All 8 apps: access denied immediately"]
        T5 --> T6["Account re-enabled when employee returns"]
    end

    subgraph LEAVE["Last Day — Offboarding"]
        L1["HR initiates offboarding in Workday"] --> L2["SCIM deletes Azure AD account automatically"]
        L2 --> L3["Keycloak detects federation failure - session invalidated"]
        L3 --> L4["All tokens revoked within 15 minutes max"]
        L4 --> L5["IT audit log shows exact last access for every system"]
        L5 --> L6["✅ Zero orphaned access - Zero manual cleanup needed"]
    end

    HIRE --> CHANGE --> TEMP --> LEAVE

    style H7 fill:#27ae60,color:#fff
    style C5 fill:#27ae60,color:#fff
    style T5 fill:#e74c3c,color:#fff
    style L6 fill:#27ae60,color:#fff
```

---

## 10. Security Layers

```mermaid
graph TD
    subgraph L1["Layer 1 — Network"]
        WAF["WAF and DDoS Protection<br/>Cloudflare / Azure Front Door"]
        TLS["TLS 1.3<br/>All traffic encrypted"]
        IP["IP Allowlisting<br/>for admin endpoints"]
    end

    subgraph L2["Layer 2 — Identity via Azure AD"]
        MFA["MFA Enforcement<br/>Microsoft Authenticator"]
        CA["Conditional Access<br/>Block unknown countries"]
        RISK["Risk-based Auth<br/>Anomaly detection - Microsoft Defender"]
        PWD["Password Policy<br/>12+ chars, breach detection"]
    end

    subgraph L3["Layer 3 — Access via Keycloak"]
        BRUTE["Brute Force Protection<br/>5 fails locks account"]
        TOKEN_EXP["Token Expiry<br/>15 min access / 10 hr refresh"]
        ROTATE["Refresh Token Rotation<br/>Reuse detection"]
        SIGN["RS256 Signing<br/>2048-bit RSA keys, 90-day rotation"]
    end

    subgraph L4["Layer 4 — Application"]
        ROLE["Role Check on every request"]
        SCOPE["Scope Validation - aud claim check"]
        CLAIM["Custom Claims<br/>dept and clearance level"]
    end

    subgraph L5["Layer 5 — Audit"]
        LOG["Centralised Audit Log<br/>Every login, logout, fail"]
        ALERT["Real-time Alerts<br/>Suspicious patterns"]
        REPORT["Compliance Reports<br/>Who accessed what and when"]
    end

    L1 --> L2 --> L3 --> L4 --> L5

    style L1 fill:#2c3e50,color:#fff
    style L2 fill:#0078d4,color:#fff
    style L3 fill:#e74c3c,color:#fff
    style L4 fill:#27ae60,color:#fff
    style L5 fill:#8e44ad,color:#fff
```

### Threat Model

```mermaid
flowchart LR
    subgraph THREATS["Threats"]
        T1["Stolen password"]
        T2["Stolen auth code"]
        T3["Stolen access token"]
        T4["Stolen refresh token"]
        T5["CSRF attack"]
        T6["Replay attack"]
        T7["Ex-employee access"]
        T8["Forged token"]
    end

    subgraph MITIGATIONS["Mitigations"]
        M1["MFA in Azure AD<br/>Password alone not enough"]
        M2["Code is one-time use<br/>60 sec expiry + state CSRF check"]
        M3["15 min expiry<br/>Roles re-validated on refresh"]
        M4["Rotation on use<br/>Reuse triggers full session revoke"]
        M5["state parameter<br/>per-request random value"]
        M6["nonce in ID token<br/>exp claim checked every request"]
        M7["Disable Azure AD account<br/>All tokens expire within 15 min"]
        M8["RS256 signature<br/>Private key never leaves Keycloak"]
    end

    T1 --> M1
    T2 --> M2
    T3 --> M3
    T4 --> M4
    T5 --> M5
    T6 --> M6
    T7 --> M7
    T8 --> M8

    style THREATS fill:#e74c3c,color:#fff
    style MITIGATIONS fill:#27ae60,color:#fff
```

---

## 11. Hidden Flows You Must Know

### Flow 1 — Silent Token Refresh (Invisible to User)

```mermaid
sequenceDiagram
    actor U as 👤 User working
    participant APP as 🏢 App
    participant KC as ⚙️ Keycloak

    Note over U,KC: User is actively using the app
    Note over U,KC: Access token is about to expire at 14 min mark

    APP->>APP: Check token expiry on each request
    APP->>APP: exp minus now is under 60 seconds - trigger refresh

    APP->>KC: POST /token with grant_type=refresh_token
    KC->>KC: Validate refresh token
    KC->>KC: SSO session still active check
    KC-->>APP: New access_token (15 min) + new rotated refresh_token
    APP->>APP: Update session silently

    Note over U,KC: User never sees a login page
    Note over U,KC: Zero interruption to work
    U->>APP: Continues working
```

### Flow 2 — Concurrent Sessions (Same User, Multiple Devices)

```mermaid
flowchart TD
    USER["👤 Manoj Kumar"] --> DEV1["💻 Laptop - Login 9:00 AM - Session A"]
    USER --> DEV2["📱 Mobile - Login 10:00 AM - Session B"]
    USER --> DEV3["🖥️ Desktop - Login 11:00 AM - Session C"]

    DEV1 -->|Token A| APPS1["Underwriting System - Session A active"]
    DEV2 -->|Token B| APPS2["Claims Portal - Session B active"]
    DEV3 -->|Token C| APPS3["Finance Suite - Session C active"]

    subgraph KEYCLOAK["Keycloak — Session Management"]
        S1["Session A - laptop - active"]
        S2["Session B - mobile - active"]
        S3["Session C - desktop - active"]
    end

    DEV1 -.-> S1
    DEV2 -.-> S2
    DEV3 -.-> S3

    ADMIN["IT Admin suspects breach"] -->|Revoke ALL sessions| KC_KILL["Keycloak kills all 3 sessions"]
    KC_KILL --> DENIED["❌ All 3 devices locked out within 15 min"]

    style DENIED fill:#e74c3c,color:#fff
    style KC_KILL fill:#e74c3c,color:#fff
```

### Flow 3 — Compliance Officer Cross-System Audit Access

```mermaid
flowchart TD
    CO["📊 Compliance Officer<br/>role: compliance-officer"] --> LOGIN["Login via SSO"]
    LOGIN --> KC["Keycloak issues JWT<br/>roles: compliance-officer, employee"]

    KC --> COMP_APP["✅ Compliance Dashboard - Full access"]
    KC --> UW_APP["🔍 Underwriting System - Read-only AUDIT view"]
    KC --> CL_APP["🔍 Claims Portal - Read-only AUDIT view"]
    KC --> FIN_APP["🔍 Finance Suite - Read-only AUDIT view"]
    KC --> DOCS["✅ Docs Portal - Full read access"]

    KC -->|No write access| POL["❌ Policy Admin - Denied"]
    KC -->|No write access| HR["❌ HR System - Denied"]
    KC -->|No access| ADMIN["❌ IT Admin - Denied"]

    COMP_APP --> AUDIT_LOG["View all audit logs across all systems"]
    AUDIT_LOG --> REPORT["Generate compliance report<br/>Who accessed what and when"]
    REPORT --> REGULATOR["Submit to FCA / PRA - Regulatory reporting"]

    style CO fill:#c0392b,color:#fff
    style REPORT fill:#27ae60,color:#fff
```

### Flow 4 — Broker / External Partner Access

```mermaid
flowchart TD
    EXT["🤝 External Broker - Not a company employee"] --> PORTAL["Partner Portal - portal.insurance.com/partner"]

    PORTAL --> KC["Keycloak - Partner Realm"]
    KC --> CHOICE{"Identity Type"}

    CHOICE -->|Has company account| AAD["Azure AD - Federated login"]
    CHOICE -->|External broker| DIRECT["Keycloak local account<br/>Managed by Partner team"]
    CHOICE -->|Insurer partner| SAML["SAML Federation<br/>Partner own IdP"]

    AAD --> BROKER_ROLE["Role: broker-read"]
    DIRECT --> BROKER_ROLE
    SAML --> BROKER_ROLE

    BROKER_ROLE --> LIMITED["✅ Limited Policy Lookup<br/>Own clients only<br/>No employee data<br/>No claims detail<br/>No financial data"]

    BROKER_ROLE -->|Audit trail| AUDIT["All external access logged separately<br/>Regulatory requirement"]

    style EXT fill:#f39c12,color:#fff
    style LIMITED fill:#27ae60,color:#fff
    style AUDIT fill:#8e44ad,color:#fff
```

### Flow 5 — Emergency Break-Glass Access

```mermaid
flowchart TD
    INCIDENT["🚨 Production Incident - 3:00 AM System Down"] --> ONCALL["On-call Engineer - Dave Patel"]

    ONCALL --> BGLASS["Break-Glass Account<br/>emergency-admin stored in sealed vault"]

    BGLASS --> KC["Keycloak - Emergency realm login"]
    KC --> MFA_HARD["Hardware MFA required - YubiKey only"]
    MFA_HARD --> TIMED["Time-limited token<br/>4 hours maximum - Auto-expires"]

    TIMED --> FULL["Full system access - All apps and databases"]
    FULL --> ALERT["🔔 IMMEDIATE ALERT<br/>CISO and Security team notified<br/>All actions recorded"]

    ALERT --> AUDITLOG["Every keystroke logged<br/>Session recorded<br/>Forensic trail"]
    AUDITLOG --> REVIEW["Post-incident review<br/>Mandatory within 24 hours"]

    style INCIDENT fill:#e74c3c,color:#fff
    style ALERT fill:#e74c3c,color:#fff
    style TIMED fill:#f39c12,color:#fff
    style AUDITLOG fill:#8e44ad,color:#fff
```

---

## 12. Production Checklist

```mermaid
graph TD
    subgraph P1["Phase 1 — Security Hardening"]
        S1["✅ HTTPS everywhere - TLS 1.3 only"]
        S2["✅ Keycloak production mode - not start-dev"]
        S3["✅ Secrets in Vault - not .env files"]
        S4["✅ DB encrypted at rest - Azure Managed Disks"]
        S5["✅ Token expiry tuned - 15 min access / 10 hr refresh"]
    end

    subgraph P2["Phase 2 — Reliability"]
        R1["✅ Keycloak cluster - 3 nodes minimum"]
        R2["✅ PostgreSQL HA - read replicas and failover"]
        R3["✅ Redis for sessions - not in-memory"]
        R4["✅ Health checks on all containers"]
        R5["✅ Backup strategy - realm export daily"]
    end

    subgraph P3["Phase 3 — Compliance"]
        C1["✅ Audit logging to SIEM - Splunk or Elastic"]
        C2["✅ Access reviews - quarterly automated"]
        C3["✅ MFA enforced for all roles"]
        C4["✅ Data residency - EU only if required"]
        C5["✅ GDPR - user data export and delete API"]
    end

    subgraph P4["Phase 4 — Automation"]
        A1["✅ SCIM provisioning - HR to Azure AD to Keycloak"]
        A2["✅ Role assignment API - auto-assign on department join"]
        A3["✅ Orphan account scan - weekly automated job"]
        A4["✅ Certificate rotation - RS256 keys every 90 days"]
        A5["✅ Penetration testing - annual OAuth flow audit"]
    end

    P1 --> P2 --> P3 --> P4

    style P1 fill:#e74c3c,color:#fff
    style P2 fill:#e67e22,color:#fff
    style P3 fill:#8e44ad,color:#fff
    style P4 fill:#27ae60,color:#fff
```

---

## Quick Reference — Insurance SSO at a Glance

```mermaid
graph LR
    subgraph WHO["WHO are you?"]
        AAD["Azure AD<br/>Microsoft-managed<br/>Password and MFA"]
    end

    subgraph WHAT["WHAT can you do?"]
        KC["Keycloak<br/>Your team manages<br/>Roles and Routing"]
    end

    subgraph WHERE["WHERE do you go?"]
        APPS["Insurance Apps<br/>Role-gated<br/>JWT verified"]
    end

    subgraph TRACK["TRACK everything"]
        AUDIT["Audit Logs<br/>Every access<br/>Compliance ready"]
    end

    WHO -->|Verified identity| WHAT
    WHAT -->|Signed JWT token| WHERE
    WHERE -->|All events| TRACK

    style WHO fill:#0078d4,color:#fff
    style WHAT fill:#e74c3c,color:#fff
    style WHERE fill:#27ae60,color:#fff
    style TRACK fill:#8e44ad,color:#fff
```

---

*Document Series:*
*[SSO-ARCHITECTURE.md](SSO-ARCHITECTURE.md) | [OIDC-EXPLAINED.md](OIDC-EXPLAINED.md) | [AZURE-AD-SETUP.md](AZURE-AD-SETUP.md)*

*Regulatory references: FCA SYSC 13, PRA SS2/21, ISO 27001 A.9, SOC 2 CC6*
