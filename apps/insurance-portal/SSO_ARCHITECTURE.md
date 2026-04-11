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

## 12. What Is Auth0 and What Does It Do

```mermaid
flowchart TD
    subgraph WHAT ["What Auth0 Is"]
        W1[Auth0 is an Identity as a Service\nIDaaS platform]
        W2[It is a cloud-hosted service that\nhandles everything about login\nso your team does not have to build it]
        W3[Used by 18000 plus companies\nworldwide including banks\ninsurance firms and hospitals]
        W1 --> W2 --> W3
    end

    subgraph DOES ["What Auth0 Does for InsureConnect"]
        D1[Hosts the Login Page\nYour app never handles passwords]
        D2[Verifies Email and Password\nSecurely using bcrypt hashing]
        D3[Challenges MFA\nOTP via Google Authenticator]
        D4[Issues JWT Tokens\nSigned with RS256 private key]
        D5[Manages User Accounts\n40K customer identities stored]
        D6[Enforces MFA Policy\nAlways-on per NAIC compliance]
        D7[Detects Attacks\nBrute force and impossible travel]
        D8[Streams Audit Logs\nEvery login event recorded]
    end

    subgraph WITHOUT ["Without Auth0 — What Your Team Must Build"]
        NB1[Secure login page UI]
        NB2[Password hashing and storage]
        NB3[MFA OTP generation and validation]
        NB4[JWT token signing and rotation]
        NB5[Brute force protection]
        NB6[Session management]
        NB7[Forgot password flow]
        NB8[Anomaly detection engine]
        NB9[Compliance audit logging]
        NB10[Security patching forever]
        COST[Estimated 12 to 18 months\nof engineering work\nplus ongoing maintenance]
        NB1 & NB2 & NB3 & NB4 & NB5 --> COST
        NB6 & NB7 & NB8 & NB9 & NB10 --> COST
    end

    subgraph WITH ["With Auth0 — What Your Team Does Instead"]
        WB1[Configure settings\nin Auth0 dashboard]
        WB2[Write 3 Auth0 Actions\nin JavaScript]
        WB3[Build SSO Management API\nfor user provisioning]
        WB4[Ship features for\ninsurance customers]
        TIME[Ready in 4 to 6 weeks\nnot 18 months]
        WB1 & WB2 & WB3 --> WB4 --> TIME
    end

    WHAT --> DOES
    WITHOUT --> WITH

    style WHAT fill:#eff6ff,stroke:#1a56db
    style DOES fill:#dcfce7,stroke:#16a34a
    style WITHOUT fill:#fee2e2,stroke:#dc2626
    style WITH fill:#dcfce7,stroke:#16a34a
    style COST fill:#dc2626,color:#fff
    style TIME fill:#16a34a,color:#fff
```

## 13. Why Auth0 Over Other Options

```mermaid
flowchart LR
    subgraph OPTIONS ["Identity Provider Options Evaluated"]
        OP1[Build In-House\nCustom Auth System]
        OP2[AWS Cognito\nAmazon Identity]
        OP3[Keycloak\nOpen Source]
        OP4[Auth0 Professional\nSelected]
        OP5[Microsoft Entra ID\nAzure AD B2C]
    end

    subgraph EVAL ["Evaluation Against Requirements"]
        subgraph REQ ["Requirements"]
            R1[40K MAU B2C]
            R2[MFA Always-On]
            R3[Custom Login Branding]
            R4[RBAC Roles]
            R5[Audit Logging]
            R6[Quick Deployment]
            R7[Vendor Neutral\nNo lock-in to one cloud]
        end
    end

    subgraph RESULT ["Evaluation Result"]
        RES1[Build In-House\n❌ 12 to 18 months build time\n❌ Security risk\n❌ Ongoing maintenance]
        RES2[AWS Cognito\n⚠️ Limited MFA options\n⚠️ Locked to AWS\n⚠️ Weak custom branding]
        RES3[Keycloak\n⚠️ Free but needs team\nto host and operate\n⚠️ High ops overhead]
        RES4[Auth0 Professional\n✅ All requirements met\n✅ 6 week deployment\n✅ Cloud agnostic\n✅ $240/mo for 40K MAU]
        RES5[Microsoft Entra B2C\n⚠️ Complex pricing\n⚠️ Azure lock-in\n⚠️ Harder custom flows]
    end

    OP1 --> RES1
    OP2 --> RES2
    OP3 --> RES3
    OP4 --> RES4
    OP5 --> RES5

    style RES4 fill:#16a34a,color:#fff
    style RES1 fill:#dc2626,color:#fff
    style RES2 fill:#ca8a04,color:#fff
    style RES3 fill:#ca8a04,color:#fff
    style RES5 fill:#ca8a04,color:#fff
```

## 14. Why Each Azure Service — Purpose and Justification

```mermaid
flowchart TD
    subgraph TM_WHY ["Azure Traffic Manager — $6/mo"]
        TM1[What it does\nRoutes DNS traffic with health checks]
        TM2[Why we need it\nIf Auth0 is unreachable in one region\nit auto-routes to the next healthy endpoint\nin under 30 seconds]
        TM3[Without it\nCustomers get connection errors\nuntil someone manually changes DNS\nwhich can take hours]
        TM1 --> TM2 --> TM3
    end

    subgraph FD_WHY ["Azure Front Door Standard — $35/mo"]
        FD1[What it does\nGlobal CDN with built-in WAF\nSSL termination and DDoS at edge]
        FD2[Why we need it\nProtects login endpoint from\nOWASP attacks SQL injection XSS\nbefore requests reach Auth0]
        FD3[Why not Azure DDoS Standard\nFront Door WAF covers this\nDDoS Standard costs $95/mo extra\nfor protection already included here]
        FD1 --> FD2 --> FD3
    end

    subgraph KV_WHY ["Azure Key Vault — $5/mo"]
        KV1[What it does\nSecure encrypted storage\nfor secrets and certificates]
        KV2[Why we need it\nAuth0 Client ID Client Secret\nand signing keys must never\nbe stored in code or env files]
        KV3[Risk without it\nIf secrets are in code\none git leak exposes\nall 40K customer accounts]
        KV1 --> KV2 --> KV3
    end

    subgraph REDIS_WHY ["Azure Redis Cache C0 — $16/mo"]
        RE1[What it does\nIn-memory key-value cache]
        RE2[Why we need it\nCaches Auth0 JWKS public keys\nso every API token validation\ndoes not call Auth0 directly]
        RE3[Without it\nEvery API request hits Auth0\nAt 40K MAU this causes\nrate limiting and latency spikes]
        RE1 --> RE2 --> RE3
    end

    subgraph APP_WHY ["Azure App Service B1 — $14/mo"]
        AP1[What it does\nHosts the SSO Management API\nNode.js service we build]
        AP2[Why we need it\nOther teams need to create users\nassign roles and reset MFA\nwithout direct Auth0 access]
        AP3[Why B1 not Standard\nSSO Management API is internal\nlow traffic under 1000 calls per day\nB1 handles this comfortably]
        AP1 --> AP2 --> AP3
    end

    subgraph LA_WHY ["Azure Log Analytics — $0-5/mo"]
        LA1[What it does\nCollects and queries\nAuth0 tenant logs]
        LA2[Why we need it\nNAIC insurance compliance requires\n90 day audit trail of all logins\nMFA events and role changes]
        LA3[Why almost free\nFirst 5GB per day is free\nAuth0 logs for 40K MAU\nare well under this limit]
        LA1 --> LA2 --> LA3
    end

    subgraph DNS_WHY ["Azure DNS — $1/mo"]
        DN1[What it does\nManages login.company.com\ncustom domain routing]
        DN2[Why we need it\nCustomers must see your brand\nnot auth0.com in the login URL\nBuilds trust for insurance customers]
        DN3[Future benefit\nIf we ever switch from Auth0\ncustomers never notice\nthe domain stays the same]
        DN1 --> DN2 --> DN3
    end

    style TM_WHY fill:#fef3c7,stroke:#ca8a04
    style FD_WHY fill:#fee2e2,stroke:#dc2626
    style KV_WHY fill:#fff7ed,stroke:#ea580c
    style REDIS_WHY fill:#ede9fe,stroke:#7c3aed
    style APP_WHY fill:#dbeafe,stroke:#1a56db
    style LA_WHY fill:#fdf2f8,stroke:#db2777
    style DNS_WHY fill:#dcfce7,stroke:#16a34a
```

## 15. Why This Architecture Was Selected

```mermaid
flowchart TD
    subgraph PROBLEM ["Business Problem"]
        BP1[40K insurance customers\nneed secure login]
        BP2[MFA required\nby NAIC compliance]
        BP3[100% uptime needed\ncustomer facing portal]
        BP4[Budget must be\njustified to stakeholders]
        BP5[Small SSO team\nfast delivery needed]
    end

    subgraph CONSTRAINTS ["Design Constraints"]
        C1[Cannot afford\n18 months build time]
        C2[Cannot risk\nsecurity breach]
        C3[Cannot have\nvendor lock-in]
        C4[Must scale from\n40K to 500K MAU]
        C5[Must work on\nany infrastructure]
    end

    subgraph DECISIONS ["Key Design Decisions Made"]
        DEC1[Use Auth0 Professional\nnot Enterprise\nSaves $960 to $2260 per month\nCovers 100K MAU headroom]
        DEC2[Single Auth0 tenant\nnot dual tenant standby\nAuth0 is already multi-AZ\nSaves $1200 plus per month]
        DEC3[Remove Azure DDoS Standard\nFront Door WAF covers it\nSaves $95 per month]
        DEC4[Downsize App Service\nto B1 Basic\nInternal API is low traffic\nSaves $36 per month]
        DEC5[Use Log Analytics free tier\nFirst 5GB per day free\nAuth0 logs fit in free tier\nSaves $20 per month]
        DEC6[Azure Traffic Manager\nfor DNS level failover\n$6 per month for uptime\nBest ROI service in the stack]
    end

    subgraph OUTCOME ["Result of These Decisions"]
        OUT1[Total cost $322 per month\nvs $2782 original design]
        OUT2[88 percent cost reduction\n$29520 saved per year]
        OUT3[Same 99.9% uptime SLA]
        OUT4[Same MFA enforcement]
        OUT5[Same 40K MAU capacity]
        OUT6[Scales to 100K MAU\nwith zero plan change]
        OUT1 & OUT2 & OUT3 & OUT4 & OUT5 & OUT6 --> WINNER[Best value\nEnterprise SSO\nfor Insurance]
    end

    PROBLEM --> CONSTRAINTS --> DECISIONS --> OUTCOME

    style PROBLEM fill:#fee2e2,stroke:#dc2626
    style CONSTRAINTS fill:#fef3c7,stroke:#ca8a04
    style DECISIONS fill:#dbeafe,stroke:#1a56db
    style OUTCOME fill:#dcfce7,stroke:#16a34a
    style WINNER fill:#16a34a,color:#fff
```

## 16. Auth0 vs Azure Services — Who Does What

```mermaid
flowchart LR
    subgraph AUTH0_DOES ["Auth0 Handles — Identity Layer"]
        A1[Password hashing\nand storage]
        A2[Login page UI\nand branding]
        A3[MFA challenge\nand validation]
        A4[Token signing\nwith RS256]
        A5[Brute force\nprotection]
        A6[Anomaly\ndetection]
        A7[User profile\nstorage]
        A8[Role and\npermission storage]
        A9[SAML and OIDC\nfederation]
        A10[Audit log\ngeneration]
    end

    subgraph AZURE_DOES ["Azure Handles — Infrastructure Layer"]
        AZ1[Route traffic\nTraffic Manager]
        AZ2[Block attacks\nat edge\nFront Door WAF]
        AZ3[Store secrets\nKey Vault]
        AZ4[Cache JWKS keys\nRedis Cache]
        AZ5[Host Management API\nApp Service]
        AZ6[Collect and query\naudit logs\nLog Analytics]
        AZ7[Send alerts\non anomalies\nAzure Monitor]
        AZ8[Manage custom\nlogin domain\nAzure DNS]
    end

    subgraph YOU_DO ["Your SSO Team Builds"]
        Y1[Auth0 Actions\n3 JavaScript functions]
        Y2[SSO Management API\nUser and role operations]
        Y3[JWKS Validator Package\nShared to all teams]
        Y4[Terraform IaC\nAll infrastructure as code]
        Y5[Monitoring dashboards\nand alert rules]
    end

    AUTH0_DOES -- Secured by --> AZURE_DOES
    AZURE_DOES -- Extended by --> YOU_DO

    style AUTH0_DOES fill:#dcfce7,stroke:#16a34a
    style AZURE_DOES fill:#dbeafe,stroke:#1a56db
    style YOU_DO fill:#ede9fe,stroke:#7c3aed
```
