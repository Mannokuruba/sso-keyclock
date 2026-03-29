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
    A[👤 Insurance Employee] -->|One Login| B[🏢 Company Portal]
    B -->|Who are you?| C[🔐 Azure AD\nMicrosoft Identity]
    C -->|Verified Identity| D[⚙️ Keycloak\nAccess Engine]
    D -->|Role-based routing| E[📋 Underwriting System]
    D -->|Role-based routing| F[🏥 Claims Portal]
    D -->|Role-based routing| G[💰 Finance Suite]
    D -->|Role-based routing| H[👥 HR System]
    D -->|Role-based routing| I[📊 Compliance Dashboard]
    D -->|Role-based routing| J[🛡️ Policy Admin]
    D -->|Role-based routing| K[📞 Customer Service]

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
    subgraph INTERNET["🌐 Internet / Company Network"]
        EMP[👤 Employee Browser]
    end

    subgraph ENTRY["Entry Layer"]
        PORTAL[🏢 Company Portal\nportal.insurance.com\nPort 3000]
        WAF[🛡️ WAF / Load Balancer\nCloudflare / Azure Front Door]
    end

    subgraph IDENTITY["Identity Layer"]
        AAD[☁️ Azure Active Directory\nMicrosoft Cloud\nAll 2000 employees]
        KC[⚙️ Keycloak Cluster\nsso.insurance.com\nPort 8080]
        PG[(🗄️ PostgreSQL\nKeycloak Data Store\nUsers · Roles · Sessions · Audit)]
    end

    subgraph APPS["Application Layer — Insurance Systems"]
        UW[📋 Underwriting\nPort 3001]
        CL[🏥 Claims\nPort 3002]
        FIN[💰 Finance\nPort 3003]
        HR[👥 HR System\nPort 3004]
        COMP[📊 Compliance\nPort 3005]
        POL[🛡️ Policy Admin\nPort 3006]
        CS[📞 Customer Service\nPort 3007]
        ADMIN[⚙️ IT Admin\nPort 3008]
    end

    subgraph AUDIT["Observability"]
        SIEM[📡 SIEM\nSplunk / Elastic]
        ALERT[🔔 Alerting\nPagerDuty]
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

### Authorization Code Flow (What happens when employee logs in)

```mermaid
sequenceDiagram
    actor E as 👤 Employee
    participant B as 🌐 Browser
    participant P as 🏢 Portal App
    participant KC as ⚙️ Keycloak
    participant AAD as ☁️ Azure AD
    participant APP as 📋 Insurance App

    Note over E,APP: ── STEP 1: Employee visits portal ──
    E->>B: Open portal.insurance.com
    B->>P: GET /
    P->>P: No session found
    P-->>B: 302 Redirect → /login

    Note over E,APP: ── STEP 2: App generates security tokens ──
    B->>P: GET /login
    P->>P: Generate state=a3f9x2 (CSRF token)
    P->>P: Generate nonce=k8p1m7 (replay prevention)
    P->>P: Save both to server session
    P-->>B: 302 Redirect → Keycloak
    Note right of P: URL includes:<br/>client_id=portal<br/>state=a3f9x2<br/>nonce=k8p1m7<br/>scope=openid profile email<br/>response_type=code

    Note over E,APP: ── STEP 3: Keycloak shows login page ──
    B->>KC: GET /realms/insurance/protocol/openid-connect/auth
    KC-->>B: Login page with "Login with Microsoft" button

    Note over E,APP: ── STEP 4: Employee chooses Microsoft login ──
    E->>B: Click "Login with Microsoft"
    B->>KC: User chose Azure AD provider
    KC-->>B: 302 Redirect → Azure AD

    Note over E,APP: ── STEP 5: Azure AD authenticates ──
    B->>AAD: GET /oauth2/v2.0/authorize
    AAD-->>B: Microsoft login page + MFA prompt
    E->>B: Enter company email + password + MFA code
    B->>AAD: POST credentials
    AAD->>AAD: ✅ Valid employee?
    AAD->>AAD: ✅ Password correct?
    AAD->>AAD: ✅ MFA passed?
    AAD->>AAD: ✅ Account not disabled?
    AAD-->>B: 302 → Keycloak callback + Azure code

    Note over E,APP: ── STEP 6: Keycloak receives Azure identity ──
    B->>KC: GET /broker/azure-ad/endpoint?code=AZURE_CODE
    KC->>AAD: POST Exchange Azure code for tokens
    AAD-->>KC: Azure ID token (name, email, groups)
    KC->>KC: Create/update shadow user
    KC->>KC: Map Azure groups → Keycloak roles
    KC->>KC: Issue ONE-TIME Authorization Code
    KC-->>B: 302 → Portal /callback?code=AUTH_CODE&state=a3f9x2

    Note over E,APP: ── STEP 7: Portal validates and exchanges code ──
    B->>P: GET /callback?code=AUTH_CODE&state=a3f9x2
    P->>P: ✅ Validate state matches session (CSRF check)
    P->>KC: POST /token (server-to-server, hidden from browser)
    Note right of P: code=AUTH_CODE<br/>client_id=portal<br/>redirect_uri=...
    KC->>KC: ✅ Code valid and not expired?
    KC-->>P: access_token + id_token + refresh_token

    Note over E,APP: ── STEP 8: Portal decodes roles and routes ──
    P->>P: Decode JWT → get roles
    P->>P: underwriter → Underwriting System
    P-->>B: 302 → Underwriting System (auto-redirect)

    Note over E,APP: ── STEP 9: App validates token on every request ──
    B->>APP: GET /dashboard (with JWT in session/cookie)
    APP->>APP: Verify JWT signature (no Keycloak call)
    APP->>APP: Check exp, iss, aud claims
    APP->>APP: Check roles: has underwriter? ✅
    APP-->>B: 200 Dashboard content
```

---

## 4. Azure AD + Keycloak Federation

### How Identity Flows from Microsoft to Your Apps

```mermaid
flowchart LR
    subgraph MS["☁️ Microsoft Azure"]
        AAD[Azure Active Directory]
        AAD --> U1[john@insurance.com\nDept: Underwriting]
        AAD --> U2[sarah@insurance.com\nDept: Claims]
        AAD --> U3[mike@insurance.com\nDept: Finance]
        AAD --> U4[admin@insurance.com\nDept: IT]
        AAD --> GRP[Azure AD Groups\nUnderwriting-Team\nClaims-Adjusters\nFinance-Team\nIT-Admins]
    end

    subgraph KC["⚙️ Keycloak — Access Layer"]
        IDP[Identity Provider\nAzure AD Broker]
        MAP[Role Mapper\nAzure Group → Keycloak Role]
        ROLES[Keycloak Roles\nunderwriter\nclaims-adjuster\nfinance-analyst\nit-admin\ncompliance-officer\npolicy-admin\ncustomer-service\nemployee]
        TOKEN[JWT Token Issuer\nSigned RS256]
    end

    subgraph APPS["🏢 Insurance Apps"]
        A1[Underwriting System\nRequires: underwriter]
        A2[Claims Portal\nRequires: claims-adjuster]
        A3[Finance Suite\nRequires: finance-analyst]
        A4[IT Admin\nRequires: it-admin]
    end

    AAD -->|OIDC Federation| IDP
    GRP -->|Group Claim| MAP
    MAP -->|Maps to| ROLES
    ROLES -->|Embedded in| TOKEN
    TOKEN -->|Validates| A1 & A2 & A3 & A4

    style AAD fill:#0078d4,color:#fff
    style KC fill:#e74c3c,color:#fff
    style TOKEN fill:#27ae60,color:#fff
```

### What Keycloak Receives from Azure AD vs What It Issues

```mermaid
flowchart TD
    subgraph IN["📥 FROM Azure AD (raw identity)"]
        A["sub: azure-object-id-xyz
        email: john@insurance.com
        name: John Smith
        groups: Underwriting-Team, All-Employees
        department: Underwriting
        jobTitle: Senior Underwriter"]
    end

    subgraph PROC["⚙️ Keycloak Processing"]
        B[Shadow user created\nor updated]
        C[Group mapper runs:\nUnderwriting-Team → underwriter\nAll-Employees → employee]
        D[Realm roles assigned:\nunderwriter + employee]
    end

    subgraph OUT["📤 TO Your Apps (enriched JWT)"]
        E["sub: keycloak-uuid-stable
        email: john@insurance.com
        name: John Smith
        realm_access:
          roles: underwriter, employee
        insurance_dept: Underwriting
        exp: 15 minutes from now
        iss: https://sso.insurance.com/realms/insurance"]
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
        UW_DEPT[📋 Underwriting\nAssess risk, approve policies]
        CL_DEPT[🏥 Claims\nProcess & settle claims]
        FIN_DEPT[💰 Finance & Actuarial\nPricing, reserves, reporting]
        HR_DEPT[👥 Human Resources\nPeople, payroll, hiring]
        COMP_DEPT[📊 Compliance & Legal\nRegulatory, audits, GDPR]
        POL_DEPT[🛡️ Policy Administration\nPolicy lifecycle mgmt]
        CS_DEPT[📞 Customer Service\nAgent & customer support]
        IT_DEPT[⚙️ IT & DevOps\nSystems, security, infra]
    end

    subgraph SYS["💻 Insurance Applications"]
        UW_APP[Underwriting System\nRisk scoring, quote approval]
        CL_APP[Claims Portal\nFNOL, adjuster workflow]
        FIN_APP[Finance Suite\nLedger, actuarial models]
        HR_APP[HR System\nPeople management]
        COMP_APP[Compliance Dashboard\nAudit trails, reports]
        POL_APP[Policy Admin System\nPolicy CRUD, endorsements]
        CS_APP[Customer Service Portal\nTickets, policy lookup]
        ADMIN_APP[IT Admin Dashboard\nAll systems monitoring]
        DOCS[Document Portal\nAll staff — read only]
    end

    UW_DEPT -->|underwriter role| UW_APP
    CL_DEPT -->|claims-adjuster role| CL_APP
    FIN_DEPT -->|finance-analyst role| FIN_APP
    HR_DEPT -->|hr-manager role| HR_APP
    COMP_DEPT -->|compliance-officer role| COMP_APP
    POL_DEPT -->|policy-admin role| POL_APP
    CS_DEPT -->|customer-service role| CS_APP
    IT_DEPT -->|it-admin role| ADMIN_APP
    ALL[All Employees\nemployee role] -->|read access| DOCS

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
    REQ[👤 Employee makes request\nto insurance app] --> SESSION{Session\ncookie exists?}

    SESSION -->|No| LOGIN[Redirect to\nKeycloak Login]
    SESSION -->|Yes| JWT[Read JWT from session]

    LOGIN --> KC[Keycloak Login Page]
    KC --> AAD[Azure AD\nAuthentication + MFA]
    AAD --> ISSUED[JWT Issued\nwith roles embedded]
    ISSUED --> JWT

    JWT --> VERIFY{Verify JWT\nSignature\nRS256 + public key}
    VERIFY -->|Invalid signature| DENY1[❌ 401 Unauthorized\nTampered token]
    VERIFY -->|Valid| EXPIRY{Token\nexpired?}

    EXPIRY -->|Expired| REFRESH{Refresh token\nstill valid?}
    REFRESH -->|Yes| NEWTOKEN[Silent token refresh\nNo re-login needed]
    REFRESH -->|No| LOGIN
    NEWTOKEN --> ROLES
    EXPIRY -->|Not expired| ROLES

    ROLES[Extract roles from JWT\nrealm_access.roles] --> CHECK{Has required\nrole for this app?}

    CHECK -->|it-admin| FULL[✅ Full access\nAll systems]
    CHECK -->|underwriter| UW_OK[✅ Underwriting System\n+ Docs Portal]
    CHECK -->|claims-adjuster| CL_OK[✅ Claims Portal\n+ Docs Portal]
    CHECK -->|finance-analyst| FIN_OK[✅ Finance Suite\n+ Docs Portal]
    CHECK -->|compliance-officer| CO_OK[✅ Compliance Dashboard\nRead-only other systems]
    CHECK -->|No matching role| DENIED[🚫 403 Access Denied\nShow allowed apps]

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
    IT[⚙️ it-admin\nSuperuser — all systems] --> UW[📋 underwriter]
    IT --> CL[🏥 claims-adjuster]
    IT --> FIN[💰 finance-analyst]
    IT --> HR[👥 hr-manager]
    IT --> COMP[📊 compliance-officer]
    IT --> POL[🛡️ policy-admin]
    IT --> CS[📞 customer-service]

    UW --> EMP[employee\nDocs Portal only]
    CL --> EMP
    FIN --> EMP
    HR --> EMP
    COMP --> EMP
    POL --> EMP
    CS --> EMP

    COMP -.->|read-only audit| UW_APP[Underwriting System\naudit view only]
    COMP -.->|read-only audit| CL_APP[Claims Portal\naudit view only]
    COMP -.->|read-only audit| FIN_APP[Finance Suite\naudit view only]

    style IT fill:#e74c3c,color:#fff
    style EMP fill:#95a5a6,color:#fff
    style COMP fill:#c0392b,color:#fff
```

---

## 7. Department Access Matrix

```mermaid
graph LR
    subgraph ROLES["👤 Employee Roles"]
        R1[underwriter]
        R2[claims-adjuster]
        R3[finance-analyst]
        R4[hr-manager]
        R5[compliance-officer]
        R6[policy-admin]
        R7[customer-service]
        R8[it-admin]
        R9[employee]
    end

    subgraph APPS["💻 Applications"]
        A1[Underwriting\nSystem]
        A2[Claims\nPortal]
        A3[Finance\nSuite]
        A4[HR\nSystem]
        A5[Compliance\nDashboard]
        A6[Policy Admin\nSystem]
        A7[Customer\nService Portal]
        A8[IT Admin\nDashboard]
        A9[Docs\nPortal]
    end

    R1 -->|✅ Full| A1
    R1 -->|✅ Read| A9
    R2 -->|✅ Full| A2
    R2 -->|✅ Read| A9
    R3 -->|✅ Full| A3
    R3 -->|✅ Read| A9
    R4 -->|✅ Full| A4
    R4 -->|✅ Read| A9
    R5 -->|✅ Full| A5
    R5 -->|🔍 Audit| A1
    R5 -->|🔍 Audit| A2
    R5 -->|🔍 Audit| A3
    R5 -->|✅ Read| A9
    R6 -->|✅ Full| A6
    R6 -->|✅ Read| A9
    R7 -->|✅ Full| A7
    R7 -->|✅ Read| A9
    R8 -->|✅ All| A1
    R8 -->|✅ All| A2
    R8 -->|✅ All| A3
    R8 -->|✅ All| A4
    R8 -->|✅ All| A5
    R8 -->|✅ All| A6
    R8 -->|✅ All| A7
    R8 -->|✅ All| A8
    R8 -->|✅ All| A9
    R9 -->|✅ Read| A9

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
    Note right of E: Employee sees: URL only<br/>Never sees tokens

    APP->>APP: Read JWT from server session
    Note right of APP: App sees:<br/>access_token (JWT)<br/>id_token (JWT)<br/>Never sees password

    APP->>APP: Verify signature locally
    Note right of APP: Uses Keycloak public key<br/>cached from /certs endpoint<br/>NO call to Keycloak needed

    APP->>APP: Decode payload
    Note right of APP: realm_access.roles<br/>sub, email, name<br/>exp, iss, aud

    alt Token still valid
        APP-->>E: ✅ Serve content based on roles
    else Token expired (15 min)
        APP->>KC: POST /token (refresh_token grant)
        KC->>DB: Validate refresh token
        DB-->>KC: Valid, session active
        KC-->>APP: New access_token + rotated refresh_token
        APP-->>E: ✅ Serve content (silent refresh, user unaware)
    else Refresh token expired (10 hours)
        APP-->>E: 302 → Login page (session fully expired)
    end

    Note over KC,DB: Keycloak writes to DB:<br/>Every login event<br/>Every token issued<br/>Every logout<br/>Every failed attempt
```

### JWT Token Structure — Decoded

```mermaid
graph TD
    JWT[JWT Token\neyJhbGci...eyJzdWIi...SflK] --> H[Header\nAlgorithm: RS256\nType: JWT]
    JWT --> P[Payload\nAll the claims]
    JWT --> S[Signature\nRS256 signed by\nKeycloak private key]

    P --> SUB[sub: keycloak-uuid\nStable user identifier]
    P --> EMAIL[email: john@insurance.com]
    P --> NAME[name: John Smith]
    P --> ROLES[realm_access.roles:\nunderwriter\nemployee]
    P --> ISS[iss: https://sso.insurance.com/realms/insurance\nWho issued it]
    P --> AUD[aud: underwriting-system\nWho it's for]
    P --> EXP[exp: Unix timestamp\nExpires in 15 minutes]
    P --> DEPT[insurance_dept: Underwriting\nCustom claim added by Keycloak]

    S --> VERIFY[App verifies with\nKeycloak PUBLIC key\nfrom /realms/insurance/certs]
    VERIFY --> RESULT{Match?}
    RESULT -->|Yes ✅| TRUST[Trust the token\nGrant access]
    RESULT -->|No ❌| REJECT[Reject — tampered\n401 Unauthorized]

    style JWT fill:#2c3e50,color:#fff
    style TRUST fill:#27ae60,color:#fff
    style REJECT fill:#e74c3c,color:#fff
```

---

## 9. User Lifecycle — Hire to Retire

```mermaid
flowchart TD
    subgraph HIRE["🆕 Day 1 — New Hire"]
        H1[HR creates employee\nin Workday / SAP] --> H2[Azure AD auto-provisions\naccount via SCIM]
        H2 --> H3[Assigned to Azure AD group:\nUnderwriting-Team]
        H3 --> H4[Employee gets welcome email\nwith first-login instructions]
        H4 --> H5[Employee logs in → Keycloak\ncreates shadow account]
        H5 --> H6[Azure group mapper fires:\nUnderwriting-Team → underwriter]
        H6 --> H7[✅ Access granted to:\nUnderwriting System + Docs]
    end

    subgraph CHANGE["🔄 Mid-Tenure — Role Change"]
        C1[Employee promoted:\nSenior Underwriter → Team Lead] --> C2[IT updates Azure AD group:\nadd Claims-Managers group]
        C2 --> C3[Next Keycloak login:\nNew group claim received]
        C3 --> C4[Mapper fires:\nClaims-Managers → claims-adjuster added]
        C4 --> C5[✅ Now has access to:\nUnderwriting + Claims + Docs]
    end

    subgraph TEMP["⏸️ Temporary — Leave / Suspension"]
        T1[Employee on medical leave] --> T2[IT disables account in Azure AD]
        T2 --> T3[Current active tokens expire\nwithin 15 minutes]
        T3 --> T4[All refresh attempts fail:\n401 from Keycloak]
        T4 --> T5[All 8 apps: access denied immediately]
        T5 --> T6[Account re-enabled when\nemployee returns]
    end

    subgraph LEAVE["🚪 Last Day — Offboarding"]
        L1[HR initiates offboarding\nin Workday] --> L2[SCIM deletes Azure AD account\nautomatically]
        L2 --> L3[Keycloak detects federation failure\nSession invalidated]
        L3 --> L4[All tokens revoked\nwithin 15 minutes max]
        L4 --> L5[IT audit log shows:\nexact last access timestamp\nfor every system]
        L5 --> L6[✅ Zero orphaned access\nZero manual cleanup needed]
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
        WAF[WAF / DDoS Protection\nCloudflare / Azure Front Door]
        TLS[TLS 1.3\nAll traffic encrypted]
        IP[IP Allowlisting\nfor admin endpoints]
    end

    subgraph L2["Layer 2 — Identity - Azure AD"]
        MFA[MFA Enforcement\nMicrosoft Authenticator]
        CA[Conditional Access\nBlock unknown countries]
        RISK[Risk-based Auth\nAnomaly detection\nMicrosoft Defender]
        PWD[Password Policy\n12+ chars, breach detection]
    end

    subgraph L3["Layer 3 — Access - Keycloak"]
        BRUTE[Brute Force Protection\n5 fails → lockout]
        TOKEN_EXP[Token Expiry\n15 min access\n10 hr refresh]
        ROTATE[Refresh Token Rotation\nReuse detection]
        SIGN[RS256 Signing\n2048-bit RSA keys\n90-day rotation]
    end

    subgraph L4["Layer 4 — Application"]
        ROLE[Role Check\nevery request]
        SCOPE[Scope Validation\naud claim check]
        CLAIM[Custom Claims\ndept + clearance level]
    end

    subgraph L5["Layer 5 — Audit"]
        LOG[Centralised Audit Log\nEvery login/logout/fail]
        ALERT[Real-time Alerts\nSuspicious patterns]
        REPORT[Compliance Reports\nWho accessed what + when]
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
    subgraph THREATS["⚠️ Threats"]
        T1[Stolen password]
        T2[Stolen auth code]
        T3[Stolen access token]
        T4[Stolen refresh token]
        T5[CSRF attack]
        T6[Replay attack]
        T7[Ex-employee access]
        T8[Forged token]
    end

    subgraph MITIGATIONS["🛡️ Mitigations"]
        M1[MFA in Azure AD\nPassword alone not enough]
        M2[Code is one-time\n60 sec expiry\nstate param CSRF check]
        M3[15 min expiry\nRoles re-validated on refresh]
        M4[Rotation on use\nReuse = full session revoke]
        M5[state parameter\nper-request random value]
        M6[nonce in ID token\nexp claim checked]
        M7[Disable Azure AD account\nAll tokens expire ≤15 min]
        M8[RS256 signature\nPrivate key never leaves Keycloak]
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
    Note over U,KC: Access token is about to expire (14 min mark)

    APP->>APP: Check token expiry on each request
    APP->>APP: exp - now < 60 seconds → trigger refresh

    APP->>KC: POST /token\ngrant_type=refresh_token\nrefresh_token=long_lived_value
    KC->>KC: Validate refresh token
    KC->>KC: SSO session still active?
    KC-->>APP: New access_token (15 min)\nNew refresh_token (rotated!)
    APP->>APP: Update session silently

    Note over U,KC: User never sees a login page
    Note over U,KC: Zero interruption to work
    U->>APP: Continues working ✅
```

### Flow 2 — Concurrent Sessions (Same User, Multiple Devices)

```mermaid
flowchart TD
    USER[👤 Manoj Kumar] --> DEV1[💻 Laptop\nLogin 9:00 AM\nSession A]
    USER --> DEV2[📱 Mobile\nLogin 10:00 AM\nSession B]
    USER --> DEV3[🖥️ Desktop\nLogin 11:00 AM\nSession C]

    DEV1 -->|Token A| APPS1[Underwriting System\nSession A active]
    DEV2 -->|Token B| APPS2[Claims Portal\nSession B active]
    DEV3 -->|Token C| APPS3[Finance Suite\nSession C active]

    subgraph KEYCLOAK["Keycloak — Session Management"]
        S1[Session A\nlaptop\nactive]
        S2[Session B\nmobile\nactive]
        S3[Session C\ndesktop\nactive]
    end

    DEV1 -.-> S1
    DEV2 -.-> S2
    DEV3 -.-> S3

    ADMIN[IT Admin\nsuspects breach] -->|Revoke ALL sessions| KC_KILL[Keycloak:\nKill all 3 sessions]
    KC_KILL --> DENIED[All 3 devices\nlocked out ≤15 min]

    style DENIED fill:#e74c3c,color:#fff
    style KC_KILL fill:#e74c3c,color:#fff
```

### Flow 3 — Compliance Officer Cross-System Audit Access

```mermaid
flowchart TD
    CO[📊 Compliance Officer\nrole: compliance-officer] --> LOGIN[Login via SSO]
    LOGIN --> KC[Keycloak issues JWT\nroles: compliance-officer, employee]

    KC --> COMP_APP[✅ Compliance Dashboard\nFull access]
    KC --> UW_APP[🔍 Underwriting System\nRead-only AUDIT view]
    KC --> CL_APP[🔍 Claims Portal\nRead-only AUDIT view]
    KC --> FIN_APP[🔍 Finance Suite\nRead-only AUDIT view]
    KC --> DOCS[✅ Docs Portal\nFull read access]

    KC -->|❌ No write access| POL[Policy Admin\nDenied]
    KC -->|❌ No write access| HR[HR System\nDenied]
    KC -->|❌ No access| ADMIN[IT Admin\nDenied]

    COMP_APP --> AUDIT_LOG[View all audit logs\nacross all systems]
    AUDIT_LOG --> REPORT[Generate compliance report\nWho accessed what + when]
    REPORT --> REGULATOR[Submit to FCA / PRA\nRegulatory reporting]

    style CO fill:#c0392b,color:#fff
    style REPORT fill:#27ae60,color:#fff
```

### Flow 4 — Broker / External Partner Access

```mermaid
flowchart TD
    EXT[🤝 External Broker\nNot a company employee] --> PORTAL[Partner Portal\nportal.insurance.com/partner]

    PORTAL --> KC[Keycloak\nPartner Realm]
    KC --> CHOICE{Identity Type}

    CHOICE -->|Has company account| AAD[Azure AD\nFederated login]
    CHOICE -->|External broker| DIRECT[Keycloak local account\nManaged by Partner team]
    CHOICE -->|Insurer partner| SAML[SAML Federation\nPartner's own IdP]

    AAD --> BROKER_ROLE[Role: broker-read]
    DIRECT --> BROKER_ROLE
    SAML --> BROKER_ROLE

    BROKER_ROLE --> LIMITED[Limited Policy Lookup\nOwn clients only\nNo employee data\nNo claims detail\nNo financial data]

    BROKER_ROLE -->|Audit trail| AUDIT[All external access\nlogged separately\nRegulatory requirement]

    style EXT fill:#f39c12,color:#fff
    style LIMITED fill:#27ae60,color:#fff
    style AUDIT fill:#8e44ad,color:#fff
```

### Flow 5 — Emergency Break-Glass Access

```mermaid
flowchart TD
    INCIDENT[🚨 Production Incident\n3:00 AM — System Down] --> ONCALL[On-call Engineer\nDave Patel]

    ONCALL --> BGLASS[Break-Glass Account\nemergency@insurance.com\nStored in sealed vault]

    BGLASS --> KC[Keycloak\nEmergency realm login]
    KC --> MFA_HARD[Hardware MFA required\nYubiKey only]
    MFA_HARD --> TIMED[Time-limited token\n4 hours maximum\nAuto-expires]

    TIMED --> FULL[Full system access\nAll apps + databases]
    FULL --> ALERT[🔔 IMMEDIATE ALERT\nCISO + Security team notified\nAll actions recorded]

    ALERT --> AUDIT[Every keystroke logged\nSession recorded\nForensic trail]
    AUDIT --> REVIEW[Post-incident review\nMandatory within 24 hours]

    style INCIDENT fill:#e74c3c,color:#fff
    style ALERT fill:#e74c3c,color:#fff
    style TIMED fill:#f39c12,color:#fff
    style AUDIT fill:#8e44ad,color:#fff
```

---

## 12. Production Checklist

```mermaid
graph TD
    subgraph P1["Phase 1 — Security Hardening"]
        S1[✅ HTTPS everywhere\nTLS 1.3 only]
        S2[✅ Keycloak production mode\nnot start-dev]
        S3[✅ Secrets in Vault\nnot .env files]
        S4[✅ DB encrypted at rest\nAzure Managed Disks]
        S5[✅ Token expiry tuned\n15 min access / 10 hr refresh]
    end

    subgraph P2["Phase 2 — Reliability"]
        R1[✅ Keycloak cluster\n3 nodes minimum]
        R2[✅ PostgreSQL HA\nread replicas + failover]
        R3[✅ Redis for sessions\nnot in-memory]
        R4[✅ Health checks\nall containers]
        R5[✅ Backup strategy\nrealm export daily]
    end

    subgraph P3["Phase 3 — Compliance"]
        C1[✅ Audit logging\nto SIEM Splunk/Elastic]
        C2[✅ Access reviews\nquarterly automated]
        C3[✅ MFA enforced\nfor all roles]
        C4[✅ Data residency\nEU only if required]
        C5[✅ GDPR — user data\nexport/delete API]
    end

    subgraph P4["Phase 4 — Automation"]
        A1[✅ SCIM provisioning\nHR system → Azure AD → Keycloak]
        A2[✅ Role assignment API\nauto-assign on department join]
        A3[✅ Orphan account scan\nweekly automated job]
        A4[✅ Certificate rotation\nRS256 keys every 90 days]
        A5[✅ Penetration testing\nannual OAuth flow audit]
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
        AAD[Azure AD\nMicrosoft-managed\nPassword + MFA]
    end

    subgraph WHAT["WHAT can you do?"]
        KC[Keycloak\nYour team manages\nRoles + Routing]
    end

    subgraph WHERE["WHERE do you go?"]
        APPS[Insurance Apps\nRole-gated\nJWT verified]
    end

    subgraph TRACK["TRACK everything"]
        AUDIT[Audit Logs\nEvery access\nCompliance ready]
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
