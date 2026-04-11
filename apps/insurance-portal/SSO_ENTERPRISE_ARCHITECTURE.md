# InsureConnect — Enterprise SSO Architecture

## 1. Enterprise SSO — Full System Overview

```mermaid
flowchart TD
    subgraph CUSTOMERS ["👥 40,000 Monthly Active Users"]
        CU1[Browser - SPA]
        CU2[Mobile App]
        CU3[Third Party App]
    end

    subgraph EDGE ["🌐 Edge Layer — Azure"]
        TM[Azure Traffic Manager\nActive / Standby DNS Failover]
        FD[Azure Front Door\nWAF + CDN + SSL Termination]
        DDOS[Azure DDoS Protection\nCredential Stuffing Shield]
    end

    subgraph IDENTITY ["🔐 Identity Layer — Auth0 Enterprise"]
        subgraph PRIMARY ["🟢 Active — JP Region"]
            A0P[Auth0 Tenant Primary\n99.99% SLA]
            UL1[Universal Login\nCustom Branded Page]
            MFA1[MFA Engine\nOTP + Biometric]
        end
        subgraph STANDBY ["🟡 Standby — US Region"]
            A0S[Auth0 Tenant Standby\nWarm Failover]
            UL2[Universal Login\nMirrored Config]
            MFA2[MFA Engine\nMirrored Policy]
        end
    end

    subgraph SSO_SERVICES ["⚙️ SSO Services Layer — Azure App Service"]
        MGMT[SSO Management API\nUser Provisioning + Role Mgmt]
        JWKS[JWKS Validator\nShared Token Validation]
        HEALTH[Health Check Service\nLiveness + Readiness Probes]
    end

    subgraph STORAGE ["🗄️ Data Layer"]
        KV[Azure Key Vault\nSecrets + Signing Keys]
        REDIS[Azure Redis Cache\nJWKS Public Key Cache]
        DNS[Azure DNS\nlogin.yourcompany.com]
    end

    subgraph OBSERVABILITY ["📊 Observability Layer"]
        EH[Azure Event Hub\nLog Ingestion]
        LA[Azure Log Analytics\nSIEM + Audit Trail]
        MON[Azure Monitor\nAlerts + Dashboards]
    end

    subgraph CONSUMERS ["🏢 Consuming Applications"]
        INS[Insurance Portal\nOther Team]
        API[Insurance Backend APIs\nOther Team]
        ADM[Admin Portal\nOther Team]
    end

    CU1 & CU2 & CU3 --> TM
    TM -- Active --> FD
    TM -- Failover --> A0S
    FD --> DDOS
    DDOS --> A0P
    A0P --> UL1 --> MFA1
    A0P <--> MGMT
    MGMT --> KV
    MGMT --> REDIS
    A0P --> EH --> LA --> MON
    JWKS --> REDIS
    A0P --> DNS
    MFA1 --> JWKS
    JWKS --> INS & API & ADM

    style CUSTOMERS fill:#eff6ff,stroke:#1a56db
    style EDGE fill:#fef3c7,stroke:#ca8a04
    style IDENTITY fill:#f0fdf4,stroke:#16a34a
    style SSO_SERVICES fill:#ede9fe,stroke:#7c3aed
    style STORAGE fill:#fff7ed,stroke:#ea580c
    style OBSERVABILITY fill:#fdf2f8,stroke:#db2777
    style CONSUMERS fill:#f8fafc,stroke:#64748b
    style PRIMARY fill:#dcfce7,stroke:#16a34a
    style STANDBY fill:#fefce8,stroke:#ca8a04
```

## 2. Active / Standby — High Availability Design

```mermaid
flowchart TD
    USER([40K MAU\nCustomers]) --> DNS_ENTRY[login.yourcompany.com\nAzure DNS]
    DNS_ENTRY --> TM

    subgraph TM_BOX ["Azure Traffic Manager — Priority Routing"]
        TM[DNS Health Check\nEvery 30 seconds]
        TM --> HC{Health\nCheck OK?}
    end

    HC -- Primary Healthy --> ACTIVE
    HC -- Primary Down --> FAILOVER

    subgraph ACTIVE ["🟢 ACTIVE — JP Region"]
        direction TB
        FD_P[Azure Front Door Primary\nWAF + SSL]
        A0_P[Auth0 Enterprise\nJP Region Tenant]
        FD_P --> A0_P
    end

    subgraph FAILOVER ["🟡 STANDBY — US Region"]
        direction TB
        FD_S[Azure Front Door Standby\nWAF + SSL]
        A0_S[Auth0 Enterprise\nUS Region Tenant]
        FD_S --> A0_S
    end

    subgraph SHARED ["🔵 Shared Services — Always On"]
        KV2[Azure Key Vault\nGeo-Redundant]
        REDIS2[Azure Redis Cache\nGeo-Replication]
        LA2[Azure Log Analytics\nCentralised SIEM]
    end

    ACTIVE --> SHARED
    FAILOVER --> SHARED

    subgraph SLA ["📋 SLA Targets"]
        S1[Auth0 Enterprise\n99.99% uptime]
        S2[Traffic Manager\nRTO under 30 seconds]
        S3[Front Door\nGlobal CDN failover]
        S4[Key Vault\n99.99% SLA]
    end

    style ACTIVE fill:#dcfce7,stroke:#16a34a,color:#000
    style FAILOVER fill:#fefce8,stroke:#ca8a04,color:#000
    style SHARED fill:#eff6ff,stroke:#1a56db,color:#000
    style TM_BOX fill:#fff7ed,stroke:#ea580c,color:#000
    style SLA fill:#f5f3ff,stroke:#7c3aed,color:#000
```

## 3. Azure SSO Services Stack

```mermaid
flowchart LR
    subgraph PERIMETER ["🛡️ Perimeter"]
        DDOS2[Azure DDoS\nProtection Standard]
        FD2[Azure Front Door\nOWASP WAF Rules]
        TM2[Azure Traffic\nManager]
    end

    subgraph IDENTITY2 ["🔐 Identity"]
        AUTH[Auth0 Enterprise\nB2C Tenant]
        CUSTOM[Custom Domain\nlogin.company.com]
        ACTIONS[Auth0 Actions\nPost-Login + Pre-Reg]
    end

    subgraph SERVICES ["⚙️ SSO Services"]
        APPSVC[Azure App Service\nSSO Management API]
        REDIS3[Azure Redis Cache\nJWKS + Session Cache]
        REG[Azure Container\nRegistry]
    end

    subgraph SECRETS ["🔑 Secrets"]
        KV3[Azure Key Vault\nClient Secrets]
        CERT[Managed Certificates\nTLS 1.3]
    end

    subgraph OBS ["📊 Observability"]
        EH2[Azure Event Hub\nLog Streaming]
        LA3[Log Analytics\nWorkspace]
        MON2[Azure Monitor\nAlert Rules]
        DASH[Azure Dashboard\nSSO Health View]
    end

    subgraph DNS2 ["🌐 DNS"]
        ADNS[Azure DNS Zone\nlogin.company.com]
        AZONE[Azure Private DNS\nInternal services]
    end

    PERIMETER --> IDENTITY2
    IDENTITY2 --> SERVICES
    SERVICES --> SECRETS
    IDENTITY2 --> OBS
    PERIMETER --> DNS2

    style PERIMETER fill:#fee2e2,stroke:#dc2626
    style IDENTITY2 fill:#dcfce7,stroke:#16a34a
    style SERVICES fill:#ede9fe,stroke:#7c3aed
    style SECRETS fill:#fff7ed,stroke:#ea580c
    style OBS fill:#fdf2f8,stroke:#db2777
    style DNS2 fill:#dbeafe,stroke:#1a56db
```

## 4. Auth0 Actions Pipeline

```mermaid
flowchart TD
    subgraph TRIGGER1 ["Trigger: Pre-User-Registration"]
        PR1([New signup attempt]) --> PR2{Email domain\nblocked?}
        PR2 -- Yes --> PR3[api.access.deny\nRegistration blocked]
        PR2 -- No  --> PR4{Disposable\nemail?}
        PR4 -- Yes --> PR3
        PR4 -- No  --> PR5[Allow registration\nto proceed]
    end

    subgraph TRIGGER2 ["Trigger: Post-User-Registration"]
        POR1([User registered]) --> POR2[Auth0 Management API\ncalled via Action]
        POR2 --> POR3[Auto-assign\ncustomer role]
        POR3 --> POR4[Log to\nAudit stream]
        POR4 --> POR5[Notify downstream\nsystems optional]
    end

    subgraph TRIGGER3 ["Trigger: Post-Login — Token Issued"]
        PL1([User authenticated]) --> PL2[Read authentication\nmethods from event]
        PL2 --> PL3[Inject AMR claim\nnamespace/amr]
        PL3 --> PL4[Read assigned\nroles from event]
        PL4 --> PL5[Inject roles claim\nnamespace/roles]
        PL5 --> PL6[Set token expiry\n1 hour ID token]
        PL6 --> PL7([Token issued\nto application])
    end

    PR5 --> TRIGGER2
    TRIGGER2 --> PL1

    style PR3 fill:#dc2626,color:#fff
    style PL7 fill:#16a34a,color:#fff
    style TRIGGER1 fill:#fff7ed,stroke:#ea580c
    style TRIGGER2 fill:#eff6ff,stroke:#1a56db
    style TRIGGER3 fill:#f0fdf4,stroke:#16a34a
```

## 5. SSO Management API — Service Architecture

```mermaid
flowchart TD
    subgraph CALLERS ["📡 API Consumers — Internal Teams Only"]
        C1[Insurance Portal Team]
        C2[Admin Portal Team]
        C3[HR System\nUser Provisioning]
        C4[Fraud Team\nUser Blocking]
    end

    subgraph GATEWAY ["🔒 API Gateway Layer"]
        AG[Azure API Management\nRate Limiting + Auth]
        ML[Mutual TLS\nService-to-Service]
    end

    subgraph MGMT_API ["⚙️ SSO Management API — Azure App Service"]
        subgraph ROUTES ["REST Endpoints"]
            R1["POST /users\nCreate SSO user"]
            R2["PATCH /users/:id/deactivate\nBlock user instantly"]
            R3["PUT /users/:id/roles\nAssign customer/agent/admin"]
            R4["DELETE /users/:id/mfa\nReset lost MFA device"]
            R5["GET /users/:id\nFetch profile + roles"]
            R6["GET /health\nLiveness probe"]
        end
        subgraph MIDDLEWARE ["Middleware Chain"]
            MW1[Internal Token\nValidation]
            MW2[Rate Limiter\n100 req/min per service]
            MW3[Audit Logger\nAll writes logged]
        end
    end

    subgraph AUTH0_MGMT ["🔐 Auth0 Management API"]
        AM1[User Management\nCRUD operations]
        AM2[Role Assignment\nRBAC control]
        AM3[MFA Management\nEnrollment reset]
    end

    CALLERS --> AG
    AG --> ML
    ML --> MW1 --> MW2 --> MW3
    MW3 --> ROUTES
    ROUTES --> AUTH0_MGMT

    style CALLERS fill:#f8fafc,stroke:#64748b
    style GATEWAY fill:#fee2e2,stroke:#dc2626
    style MGMT_API fill:#ede9fe,stroke:#7c3aed
    style AUTH0_MGMT fill:#dcfce7,stroke:#16a34a
```

## 6. JWKS Token Validation Flow

```mermaid
sequenceDiagram
    participant APP  as Consuming App
    participant JWKS as JWKS Validator Package
    participant CACHE as Azure Redis Cache
    participant AUTH as Auth0 JWKS Endpoint

    Note over APP: User makes API request<br/>with Bearer token in header

    APP->>JWKS: validate(bearerToken)

    JWKS->>JWKS: Decode JWT header
    JWKS->>JWKS: Extract kid (Key ID)

    JWKS->>CACHE: GET jwks:kid

    alt Key in cache
        CACHE-->>JWKS: Return public key
        Note over CACHE,JWKS: Cache TTL: 6 hours
    else Key not cached
        JWKS->>AUTH: GET /.well-known/jwks.json
        AUTH-->>JWKS: Return JWKS key set
        JWKS->>CACHE: SET jwks:kid TTL 6h
    end

    JWKS->>JWKS: Verify RS256 signature
    JWKS->>JWKS: Validate expiry claim
    JWKS->>JWKS: Validate issuer claim
    JWKS->>JWKS: Validate audience claim

    alt Token valid
        JWKS-->>APP: decoded token payload
        Note over APP: Access granted
    else Token invalid
        JWKS-->>APP: 401 Unauthorized
        Note over APP: Request rejected
    end
```

## 7. Auth0 Log Streaming — Observability Pipeline

```mermaid
flowchart LR
    subgraph AUTH0_LOGS ["🔐 Auth0 Tenant — Event Sources"]
        L1[Successful Logins]
        L2[Failed Logins]
        L3[MFA Challenges]
        L4[MFA Failures]
        L5[User Registrations]
        L6[Role Changes]
        L7[Anomaly Detected]
        L8[Token Issued]
    end

    subgraph INGEST ["📥 Ingestion — Azure Event Hub"]
        EH3[Event Hub Namespace\nSSO Log Stream\nPartitions: 8]
    end

    subgraph PROCESS ["⚙️ Processing — Log Analytics"]
        LA4[Log Analytics\nWorkspace]
        subgraph QUERIES ["KQL Alert Queries"]
            Q1[Failed logins\nover 100 per minute]
            Q2[MFA failures\nover 50 per minute]
            Q3[Impossible travel\ndetected]
            Q4[New admin role\nassigned]
        end
    end

    subgraph ALERTS ["🚨 Alert Actions"]
        A_P[PagerDuty\nP1 Incident]
        A_T[Microsoft Teams\nSSO Ops Channel]
        A_E[Email\nSecurity Team]
    end

    subgraph DASH2 ["📊 Dashboards"]
        D1[SSO Health Dashboard\nReal-time MAU]
        D2[Security Dashboard\nThreat Overview]
        D3[Compliance Report\nNAIC Audit Trail]
    end

    AUTH0_LOGS --> EH3
    EH3 --> LA4
    LA4 --> QUERIES
    Q1 & Q2 & Q3 & Q4 --> ALERTS
    LA4 --> DASH2

    style AUTH0_LOGS fill:#f0fdf4,stroke:#16a34a
    style INGEST fill:#eff6ff,stroke:#1a56db
    style PROCESS fill:#ede9fe,stroke:#7c3aed
    style ALERTS fill:#fee2e2,stroke:#dc2626
    style DASH2 fill:#fdf2f8,stroke:#db2777
```

## 8. User Lifecycle — SSO Perspective

```mermaid
sequenceDiagram
    participant HR   as HR System
    participant MGMT as SSO Management API
    participant A0   as Auth0 Tenant
    participant USER as Customer User
    participant FRAUD as Fraud Team

    Note over HR,USER: --- New Customer Onboarding ---

    HR->>MGMT: POST /users
    Note over HR,MGMT: name, email, department
    MGMT->>A0: Create user via Management API
    A0-->>MGMT: user_id returned
    MGMT->>A0: Assign role: customer
    A0-->>MGMT: Role assigned
    MGMT-->>HR: User created successfully

    Note over USER: User receives welcome email
    USER->>A0: First login
    A0->>USER: MFA enrollment prompt
    USER->>A0: Scans QR code - Google Authenticator
    A0-->>USER: MFA enrolled - login complete

    Note over USER,FRAUD: --- MFA Device Lost ---

    USER->>MGMT: Request MFA reset via support
    MGMT->>A0: DELETE /users/id/mfa
    A0-->>MGMT: MFA cleared
    USER->>A0: Next login prompts re-enrollment

    Note over FRAUD,A0: --- Fraud Detected ---

    FRAUD->>MGMT: PATCH /users/id/deactivate
    MGMT->>A0: Block user instantly
    A0-->>MGMT: User blocked
    Note over A0: All active sessions revoked immediately
    A0-->>USER: Next request returns 401
```

## 9. Security Perimeter — Defence in Depth

```mermaid
flowchart TD
    INTERNET([Internet\n40K MAU Customers]) --> L1

    subgraph L1 ["Layer 1 — DDoS + DNS"]
        DL1[Azure DDoS Protection Standard]
        DL2[Azure Traffic Manager\nActive Standby DNS]
        DL3[Azure DNS\nlogin.company.com]
    end

    L1 --> L2

    subgraph L2 ["Layer 2 — Edge Security"]
        EL1[Azure Front Door\nGlobal CDN Points of Presence]
        EL2[WAF Policy\nOWASP 3.2 Rule Set]
        EL3[Rate Limiting\n200 requests per IP per minute]
        EL4[Geo-Blocking\nOptional country rules]
    end

    L2 --> L3

    subgraph L3 ["Layer 3 — Auth0 Identity Security"]
        IL1[Brute Force Protection\nBlock after 10 failures]
        IL2[Anomaly Detection\nImpossible travel + bot]
        IL3[Breached Password\nDetection enabled]
        IL4[MFA Always-On\nOTP every login]
        IL5[PKCE Flow\nNo client secret in browser]
    end

    L3 --> L4

    subgraph L4 ["Layer 4 — Token Security"]
        TL1[RS256 Signed JWT\nAsymmetric keys only]
        TL2[Memory-only storage\nNo localStorage]
        TL3[Refresh token rotation\nAuto-revoke on reuse]
        TL4[1 hour expiry\nShort-lived tokens]
        TL5[Audience validation\nStrict issuer check]
    end

    L4 --> L5

    subgraph L5 ["Layer 5 — Application Security"]
        AL1[ProtectedRoute RBAC\nRole check per route]
        AL2[X-Frame-Options DENY\nClickjacking blocked]
        AL3[CSP Headers\nNo iframe embedding]
        AL4[HTTPS Only\nTLS 1.3 enforced]
    end

    style L1 fill:#fef3c7,stroke:#ca8a04
    style L2 fill:#fee2e2,stroke:#dc2626
    style L3 fill:#ede9fe,stroke:#7c3aed
    style L4 fill:#dbeafe,stroke:#1a56db
    style L5 fill:#dcfce7,stroke:#16a34a
    style INTERNET fill:#f1f5f9,stroke:#64748b
```

## 10. SSO Team Responsibility Matrix

```mermaid
flowchart LR
    subgraph OWN ["✅ SSO Team Owns"]
        O1[Auth0 Tenant Config]
        O2[Auth0 Actions - 3 actions]
        O3[Custom Login Domain\nlogin.company.com]
        O4[Azure Front Door + WAF]
        O5[Azure Traffic Manager\nActive Standby]
        O6[Azure Key Vault\nAll SSO Secrets]
        O7[SSO Management API\nUser + Role Provisioning]
        O8[JWKS Validator Package\nShared to all teams]
        O9[Log Streaming Pipeline\nAuth0 to Azure Monitor]
        O10[Terraform IaC\nAll SSO infrastructure]
        O11[Auth0 MFA Policy\nOTP enforcement]
        O12[RBAC Role Definitions\ncustomer, agent, admin]
    end

    subgraph PROVIDE ["📦 SSO Team Provides to Others"]
        P1[JWKS Validator npm package]
        P2[SSO Management API endpoints]
        P3[Role assignment process]
        P4[Auth0 tenant documentation]
        P5[Token claim schema]
    end

    subgraph NOTOWN ["❌ SSO Team Does NOT Own"]
        N1[Insurance Portal App]
        N2[Insurance Backend APIs]
        N3[Admin Portal UI]
        N4[Business Logic]
        N5[Database - User Data]
        N6[Application Hosting]
    end

    OWN --> PROVIDE
    PROVIDE --> NOTOWN

    style OWN fill:#dcfce7,stroke:#16a34a
    style PROVIDE fill:#dbeafe,stroke:#1a56db
    style NOTOWN fill:#fee2e2,stroke:#dc2626
```
