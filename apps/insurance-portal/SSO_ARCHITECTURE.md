# InsureConnect — Enterprise SSO Architecture
# 100% Resource Uptime · Minimum Cost · Auth0 B2C · 40K MAU · Azure

## 1. Full SSO System Overview

```mermaid
flowchart TD
    subgraph USERS ["👥 40,000 Monthly Active Users"]
        U1[Browser SPA]
        U2[Mobile App]
        U3[Third Party App]
    end

    subgraph EDGE ["🌐 Edge Layer"]
        TM[Azure Traffic Manager\n$6/mo — DNS Health Failover]
        FD[Azure Front Door Standard\n$35/mo — WAF + CDN + SSL]
    end

    subgraph IDENTITY ["🔐 Auth0 Professional — $240/mo"]
        UL[Universal Login\nCustom Branded Page]
        MFA[MFA Engine\nOTP Always On]
        ACT[Auth0 Actions\nPost-Login + Pre-Reg]
        HA[Built-in Multi-AZ HA\n99.9% SLA — No extra cost]
    end

    subgraph SSO_SVC ["⚙️ SSO Services — Azure"]
        MGMT[SSO Management API\nAzure App Service B1 — $14/mo]
        JWKS[JWKS Validator\nShared to all teams]
        REDIS[Azure Redis Cache C0\n$16/mo — JWKS Key Cache]
    end

    subgraph SECURE ["🔑 Secrets and DNS"]
        KV[Azure Key Vault\n$5/mo — Auth0 Secrets]
        DNS[Azure DNS\n$1/mo — login.company.com]
    end

    subgraph OBS ["📊 Observability"]
        LA[Azure Log Analytics\n$0-5/mo — First 5GB Free]
        MON[Azure Monitor\nAlerts + Dashboards]
    end

    subgraph APPS ["🏢 Consuming Teams"]
        APP1[Insurance Portal]
        APP2[Backend APIs]
        APP3[Admin Portal]
    end

    U1 & U2 & U3 --> TM
    TM --> FD --> IDENTITY
    IDENTITY --> SSO_SVC
    IDENTITY --> SECURE
    IDENTITY --> OBS
    SSO_SVC --> APPS
    MON --> APPS

    style USERS fill:#eff6ff,stroke:#1a56db
    style EDGE fill:#fef3c7,stroke:#ca8a04
    style IDENTITY fill:#dcfce7,stroke:#16a34a
    style SSO_SVC fill:#ede9fe,stroke:#7c3aed
    style SECURE fill:#fff7ed,stroke:#ea580c
    style OBS fill:#fdf2f8,stroke:#db2777
    style APPS fill:#f8fafc,stroke:#64748b
```

## 2. Active Standby — 100% Uptime Without Dual Tenant Cost

```mermaid
flowchart TD
    USER2([40K Customers]) --> DNS2[login.company.com\nAzure DNS]
    DNS2 --> TM2[Azure Traffic Manager\nHealth probe every 30s]

    TM2 -- Auth0 Healthy --> FD2[Azure Front Door\nWAF + SSL + CDN Edge]
    TM2 -- Auth0 Unreachable --> FB[Custom Maintenance Page\nHosted on Azure Static\nZero extra cost]

    FD2 --> A0[Auth0 Professional\nJP Region]

    subgraph A0 ["Auth0 Professional — Built-in HA"]
        AZ1[Availability Zone 1]
        AZ2[Availability Zone 2]
        AZ3[Availability Zone 3]
        GEO[Global Edge Nodes\n6 plus Regions]
    end

    A0 --> SHARED[Azure Key Vault\nRedis Cache\nLog Analytics]

    subgraph SLA2 ["SLA Targets"]
        SL1[Auth0 Professional\n99.9% — 8.7 hrs per year max]
        SL2[Azure Traffic Manager\nFailover in under 30 sec]
        SL3[Azure Front Door\nGlobal CDN instant]
        SL4[Azure Key Vault\n99.99% SLA]
    end

    subgraph WHY ["Why No Second Tenant"]
        W1[Auth0 already runs\nmulti-AZ internally]
        W2[Second tenant costs\n$1200 plus per month]
        W3[Syncing users between\ntenants is complex]
        W4[Auth0 handles\nfailover automatically]
    end

    style A0 fill:#dcfce7,stroke:#16a34a
    style SLA2 fill:#eff6ff,stroke:#1a56db
    style WHY fill:#fee2e2,stroke:#dc2626
    style FB fill:#fef3c7,stroke:#ca8a04
```

## 3. Azure Services — Keep Remove Downsize

```mermaid
flowchart LR
    subgraph KEEP2 ["✅ KEEP — Essential Only"]
        K1[Azure Traffic Manager\n$6/mo\nDNS failover for uptime]
        K2[Azure Front Door Standard\n$35/mo\nWAF + CDN + SSL]
        K3[Azure Key Vault Standard\n$5/mo\nSecrets — cannot skip]
        K4[Azure Log Analytics\n$0-5/mo\nFirst 5GB free daily]
        K5[Azure Redis Cache C0\n$16/mo\nJWKS key cache]
        K6[Azure App Service B1\n$14/mo\nSSO Management API]
        K7[Azure DNS\n$1/mo\nCustom login domain]
    end

    subgraph REMOVE2 ["❌ REMOVE — Not Worth Cost"]
        R1[Azure DDoS Standard\n$95/mo\nAuth0 protects this natively]
        R2[Second Auth0 Tenant\n$1200 plus per month\nAuth0 is already multi-AZ]
        R3[Azure Container Registry\n$5/mo\nDocker Hub free is enough]
        R4[Azure Event Hub\n$10/mo\nLog Analytics streams direct]
        R5[Azure App Service Standard\n$50/mo\nB1 handles internal API load]
        R6[Azure Redis Premium\n$55/mo\nC0 is enough for JWKS cache]
    end

    KEEP2 --> TOTAL_K[Azure SSO Total\n$77/mo]
    REMOVE2 --> TOTAL_R[Monthly Savings\n$1415 plus per month]

    style KEEP2 fill:#dcfce7,stroke:#16a34a
    style REMOVE2 fill:#fee2e2,stroke:#dc2626
    style TOTAL_K fill:#16a34a,color:#fff
    style TOTAL_R fill:#dc2626,color:#fff
```

## 4. Auth0 Actions Pipeline

```mermaid
flowchart TD
    subgraph PRE_REG ["Trigger 1 — Pre User Registration"]
        PR1([New signup attempt]) --> PR2{Email domain\nblocked?}
        PR2 -- Yes --> PR3[api.access.deny\nBlock registration]
        PR2 -- No  --> PR4{Disposable\nemail?}
        PR4 -- Yes --> PR3
        PR4 -- No  --> PR5[Allow registration]
    end

    subgraph POST_REG ["Trigger 2 — Post User Registration"]
        POR1([User created]) --> POR2[Call Auth0\nManagement API]
        POR2 --> POR3[Auto-assign\ncustomer role]
        POR3 --> POR4[Write to\naudit log]
    end

    subgraph POST_LOGIN ["Trigger 3 — Post Login Before Token Issued"]
        PL1([User authenticated]) --> PL2[Read auth methods\nfrom event object]
        PL2 --> PL3[Inject AMR claim\nnamespace/amr into token]
        PL3 --> PL4[Read assigned roles]
        PL4 --> PL5[Inject roles claim\nnamespace/roles into token]
        PL5 --> PL6([Token issued\nto application])
    end

    PR5 --> POR1
    POR4 --> PL1

    style PR3 fill:#dc2626,color:#fff
    style PL6 fill:#16a34a,color:#fff
    style PRE_REG fill:#fff7ed,stroke:#ea580c
    style POST_REG fill:#eff6ff,stroke:#1a56db
    style POST_LOGIN fill:#dcfce7,stroke:#16a34a
```

## 5. SSO Management API — What You Build and Own

```mermaid
flowchart TD
    subgraph CALLERS2 ["Internal Consumers — mTLS Only"]
        C1[Insurance Portal Team]
        C2[Admin Portal Team]
        C3[HR System]
        C4[Fraud Team]
    end

    subgraph API ["SSO Management API — Azure App Service B1"]
        subgraph EP ["REST Endpoints"]
            E1[POST /users\nCreate SSO user]
            E2[PATCH /users/id/deactivate\nBlock user instantly]
            E3[PUT /users/id/roles\nAssign role]
            E4[DELETE /users/id/mfa\nReset lost MFA device]
            E5[GET /users/id\nFetch profile and roles]
            E6[GET /health\nLiveness probe]
        end
        subgraph MW ["Middleware"]
            M1[Internal Token\nValidation]
            M2[Rate Limiter\n100 req per min]
            M3[Audit Logger\nAll writes recorded]
        end
    end

    subgraph A0_MGMT ["Auth0 Management API"]
        AM1[User CRUD]
        AM2[Role Assignment]
        AM3[MFA Reset]
    end

    CALLERS2 --> M1 --> M2 --> M3 --> EP --> A0_MGMT

    style CALLERS2 fill:#f8fafc,stroke:#64748b
    style API fill:#ede9fe,stroke:#7c3aed
    style A0_MGMT fill:#dcfce7,stroke:#16a34a
```

## 6. JWKS Token Validation Flow

```mermaid
sequenceDiagram
    participant APP as Consuming App
    participant PKG as JWKS Validator Package
    participant CACHE as Azure Redis C0
    participant AUTH as Auth0 JWKS Endpoint

    Note over APP: API request with Bearer token

    APP->>PKG: validate(bearerToken)
    PKG->>PKG: Decode JWT header
    PKG->>PKG: Extract key ID

    PKG->>CACHE: GET jwks cached key

    alt Key found in cache
        CACHE-->>PKG: Return public key
        Note over CACHE: TTL 6 hours
    else Key not cached
        PKG->>AUTH: GET /.well-known/jwks.json
        AUTH-->>PKG: Return public key set
        PKG->>CACHE: SET key TTL 6h
    end

    PKG->>PKG: Verify RS256 signature
    PKG->>PKG: Validate expiry
    PKG->>PKG: Validate issuer
    PKG->>PKG: Validate audience

    alt Token valid
        PKG-->>APP: Decoded token payload
    else Token invalid
        PKG-->>APP: 401 Unauthorized
    end
```

## 7. Log Streaming — Observability Pipeline

```mermaid
flowchart LR
    subgraph SRC ["Auth0 Event Sources"]
        L1[Logins]
        L2[Failed Logins]
        L3[MFA Events]
        L4[Role Changes]
        L5[Anomaly Detected]
    end

    subgraph STREAM ["Auth0 Log Stream\nBuilt-in — No Event Hub Needed"]
        LS[Direct stream\nto Log Analytics]
    end

    subgraph LA2 ["Azure Log Analytics — $0-5/mo"]
        WS[Log Analytics Workspace]
        subgraph KQL ["KQL Alert Rules"]
            Q1[Failed logins\nover 100 per min]
            Q2[MFA failures\nover 50 per min]
            Q3[Impossible travel\ndetected]
            Q4[Admin role\nassigned]
        end
    end

    subgraph NOTIFY ["Azure Monitor Alerts"]
        A1[Teams Channel\nSSO Ops]
        A2[Email\nSecurity Team]
        A3[PagerDuty\nP1 Incident]
    end

    SRC --> STREAM --> WS --> KQL --> NOTIFY

    style SRC fill:#dcfce7,stroke:#16a34a
    style STREAM fill:#eff6ff,stroke:#1a56db
    style LA2 fill:#ede9fe,stroke:#7c3aed
    style NOTIFY fill:#fee2e2,stroke:#dc2626
```

## 8. User Lifecycle — SSO Engineer View

```mermaid
sequenceDiagram
    participant HR   as HR System
    participant MGMT as SSO Management API
    participant A0   as Auth0 Tenant
    participant USER as Customer
    participant FRAUD as Fraud Team

    Note over HR,USER: New Customer Onboarding

    HR->>MGMT: POST /users
    MGMT->>A0: Create user
    A0-->>MGMT: user_id returned
    MGMT->>A0: Assign role customer
    A0-->>MGMT: Done
    MGMT-->>HR: User created

    Note over USER: First login
    USER->>A0: Sign in
    A0->>USER: MFA enrollment prompt
    USER->>A0: Scans QR code
    A0-->>USER: Enrolled and logged in

    Note over USER,FRAUD: MFA Device Lost

    USER->>MGMT: Support request
    MGMT->>A0: DELETE /users/id/mfa
    A0-->>MGMT: MFA cleared
    USER->>A0: Re-enrolls on next login

    Note over FRAUD,A0: Fraud Detected

    FRAUD->>MGMT: PATCH /users/id/deactivate
    MGMT->>A0: Block user
    A0-->>MGMT: Blocked
    Note over A0: All active sessions revoked immediately
```

## 9. Security — 5 Layer Defence in Depth

```mermaid
flowchart TD
    INET([Internet\n40K Customers]) --> L1

    subgraph L1 ["Layer 1 — DNS and Traffic"]
        N1[Azure Traffic Manager\nDNS health failover]
        N2[Azure DNS\nlogin.company.com]
    end

    L1 --> L2

    subgraph L2 ["Layer 2 — Edge Protection"]
        E1[Azure Front Door WAF\nOWASP 3.2 rule set]
        E2[Rate Limiting\n200 req per IP per min]
        E3[TLS 1.3 only\nHTTP to HTTPS redirect]
    end

    L2 --> L3

    subgraph L3 ["Layer 3 — Auth0 Identity"]
        I1[Brute Force Protection\nBlock after 10 failures]
        I2[Anomaly Detection\nImpossible travel and bot]
        I3[Breached Password Detection]
        I4[MFA Always On\nOTP every login]
        I5[PKCE Flow\nNo client secret exposed]
    end

    L3 --> L4

    subgraph L4 ["Layer 4 — Token Security"]
        T1[RS256 Signed JWT\nAsymmetric keys only]
        T2[Memory only storage\nNo localStorage]
        T3[Refresh token rotation\nAuto revoke on reuse]
        T4[1 hour ID token expiry]
    end

    L4 --> L5

    subgraph L5 ["Layer 5 — Application"]
        A1[ProtectedRoute RBAC\nRole check per route]
        A2[X-Frame-Options DENY\nClickjacking blocked]
        A3[CSP Headers\nNo iframe embedding]
    end

    style L1 fill:#fef3c7,stroke:#ca8a04
    style L2 fill:#fee2e2,stroke:#dc2626
    style L3 fill:#dcfce7,stroke:#16a34a
    style L4 fill:#dbeafe,stroke:#1a56db
    style L5 fill:#ede9fe,stroke:#7c3aed
```

## 10. Cost Comparison and Scaling

```mermaid
flowchart TD
    subgraph COMPARE ["Monthly Cost — Original vs Optimised"]
        subgraph OLD ["❌ Over-Engineered — $2782/mo"]
            O1[Auth0 Dual Tenants — $2500]
            O2[Azure DDoS Standard — $95]
            O3[Azure Redis Premium — $55]
            O4[Azure App Service Standard — $50]
            O5[Azure Event Hub — $10]
            O6[Other services — $72]
        end
        subgraph NEW ["✅ Optimised — $322/mo"]
            N1[Auth0 Professional — $240]
            N2[Azure Front Door Standard — $35]
            N3[Azure Traffic Manager — $6]
            N4[Azure Redis Cache C0 — $16]
            N5[Azure App Service B1 — $14]
            N6[Other services — $11]
        end
    end

    subgraph SAVING2 ["💰 Annual Saving — $29,520 per year\n88 percent cost reduction"]
        SAV[Same 40K MAU\nSame MFA\nSame 99.9% uptime\n88 percent cheaper]
    end

    subgraph SCALE3 ["📈 Cost as MAU Grows"]
        SC1[40K MAU now\n$322/mo\n$0.008 per user]
        SC2[100K MAU future\n$330/mo\nNo Auth0 price jump]
        SC3[200K MAU future\n$1100/mo\nUpgrade to Enterprise]
        SC4[500K MAU future\n$2200/mo\nVolume discount applies]
        SC1 --> SC2 --> SC3 --> SC4
    end

    COMPARE --> SAVING2
    SAVING2 --> SCALE3

    style OLD fill:#fee2e2,stroke:#dc2626
    style NEW fill:#dcfce7,stroke:#16a34a
    style SAVING2 fill:#1a56db,color:#fff
    style SAV fill:#1a56db,color:#fff
    style SC1 fill:#16a34a,color:#fff
    style SC2 fill:#1a56db,color:#fff
    style SC3 fill:#ca8a04,color:#fff
    style SC4 fill:#7c3aed,color:#fff
```

## 11. SSO Team Ownership

```mermaid
flowchart LR
    subgraph OWN2 ["✅ SSO Team Owns"]
        O1[Auth0 Tenant Configuration]
        O2[Auth0 Actions — 3 actions]
        O3[Custom Login Domain]
        O4[Azure Front Door + WAF]
        O5[Azure Traffic Manager]
        O6[Azure Key Vault — Secrets]
        O7[SSO Management API]
        O8[JWKS Validator Package]
        O9[Log Streaming Pipeline]
        O10[Terraform IaC]
        O11[MFA Policy Enforcement]
        O12[RBAC Role Definitions]
    end

    subgraph GIVE ["📦 SSO Team Provides"]
        P1[JWKS npm package]
        P2[Management API endpoints]
        P3[Role assignment docs]
        P4[Token claim schema]
    end

    subgraph NOTOWN ["❌ Other Teams Own"]
        N1[Insurance Portal App]
        N2[Backend APIs]
        N3[Admin Portal UI]
        N4[Business Logic]
        N5[Application Hosting]
    end

    OWN2 --> GIVE --> NOTOWN

    style OWN2 fill:#dcfce7,stroke:#16a34a
    style GIVE fill:#dbeafe,stroke:#1a56db
    style NOTOWN fill:#fee2e2,stroke:#dc2626
```
