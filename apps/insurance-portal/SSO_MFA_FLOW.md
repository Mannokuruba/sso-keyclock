# InsureConnect — SSO + MFA Diagrams

## 1. Complete SSO Login Flow

```mermaid
flowchart TD
    A([User visits\nhttps://localhost:3010]) --> B{Already\nauthenticated?}
    B -- Yes --> C([Redirect to /dashboard])
    B -- No  --> D[LandingPage shown\nPolicy card is blurred]
    D --> E{User clicks}
    E -- Sign In     --> F[loginWithRedirect\ncalled by Navbar]
    E -- Create Acct --> G[loginWithRedirect\nscreen_hint: signup]
    F --> H
    G --> H
    H[Auth0 React SDK\ngenerates PKCE pair\ncode_verifier + code_challenge SHA-256]
    H --> I[Browser redirects to\nAuth0 /authorize\nwith code_challenge + acr_values]
    I --> J[Auth0 Universal Login Page]
    J --> K[User enters Email + Password]
    K --> L{Credentials valid?}
    L -- No  --> M[Auth0 shows error\nBrute-force blocks\nafter 10 attempts]
    M --> K
    L -- Yes --> N[MFA Challenge\nTriggered by acr_values]
    N --> O[User opens\nGoogle Authenticator or Authy]
    O --> P[User enters 6-digit OTP]
    P --> Q{OTP valid?\nTime window: 30s}
    Q -- No  --> R[Invalid code\nAuth0 shows error]
    R --> P
    Q -- Yes --> S[Auth0 issues\nAuthorization Code]
    S --> T[Redirect to\nhttps://localhost:3010/callback\nwith code and state]
    T --> U[CallbackPage.jsx\nhandled by Auth0 SDK]
    U --> V[SDK sends\ncode + code_verifier\nto Auth0 /token]
    V --> W{Verifier matches\nchallenge?}
    W -- No  --> X[Token exchange fails\nPKCE mismatch]
    W -- Yes --> Y[Auth0 returns\nID Token + Access Token\n+ Refresh Token]
    Y --> Z[Tokens stored in\nMEMORY only\nnever localStorage]
    Z --> AA([Navigate to /dashboard\nor original returnTo path])

    style A fill:#1a56db,color:#fff
    style C fill:#16a34a,color:#fff
    style M fill:#dc2626,color:#fff
    style R fill:#dc2626,color:#fff
    style X fill:#dc2626,color:#fff
    style Y fill:#16a34a,color:#fff
    style AA fill:#16a34a,color:#fff
    style H fill:#7c3aed,color:#fff
    style N fill:#ea580c,color:#fff
    style Z fill:#1a56db,color:#fff
```

## 2. PKCE Sequence

```mermaid
sequenceDiagram
    participant B  as Browser SPA
    participant A0 as Auth0 Tenant
    participant T  as Token Endpoint

    Note over B: User clicks Sign In
    B->>B: Generate code_verifier
    B->>B: code_challenge = SHA-256(code_verifier)
    B->>A0: GET /authorize
    Note over B,A0: client_id, code_challenge,<br/>code_challenge_method=S256,<br/>redirect_uri, scope, acr_values=mfa
    Note over A0: Universal Login page shown
    A0->>A0: User enters email + password
    A0->>A0: MFA OTP challenge triggered
    A0->>A0: User enters 6-digit OTP - validated OK
    A0->>B: 302 Redirect to /callback?code=AUTH_CODE&state=xxx
    Note over B: CallbackPage.jsx receives code
    B->>T: POST /token
    Note over B,T: code=AUTH_CODE<br/>code_verifier=ORIGINAL_VERIFIER<br/>client_id=xxx
    T->>T: SHA-256(code_verifier) == code_challenge OK
    T->>B: ID Token + Access Token + Refresh Token
    Note over B: Tokens in memory only
    Note over B: App renders protected routes
```

## 3. MFA Authentication Flow

```mermaid
flowchart LR
    subgraph AUTH0 ["Auth0 MFA Engine"]
        M1[acr_values received from SPA] --> M2[MFA Policy Always-On]
        M2 --> M3{User has\nMFA enrolled?}
        M3 -- No  --> M4[Show QR Code\nEnrollment Screen]
        M4 --> M5[User scans with\nGoogle Authenticator or Authy]
        M5 --> M6[MFA device\nregistered in Auth0]
        M6 --> M7[OTP Challenge shown]
        M3 -- Yes --> M7
        M7 --> M8[User enters 6-digit code]
        M8 --> M9{Valid?\nTime window 30s}
        M9 -- No  --> M8
        M9 -- Yes --> M10[AMR claim set\nmfa + otp in token]
    end

    subgraph APP ["InsureConnect SPA"]
        A1[useRoles hook\nreads AMR claim] --> A2{mfaVerified?}
        A2 -- Yes --> A3[MFA Verified badge\nshown in Profile]
        A2 -- No  --> A4[Warning shown\nEnable MFA button]
    end

    M10 --> A1

    style AUTH0 fill:#f0fdf4,stroke:#16a34a
    style APP fill:#eff6ff,stroke:#1a56db
    style M10 fill:#16a34a,color:#fff
    style A3 fill:#16a34a,color:#fff
    style A4 fill:#ea580c,color:#fff
```

## 4. Auth0 Action — Token Claim Injection

```mermaid
flowchart TD
    subgraph FLOW ["Auth0 Post-Login Flow"]
        ST([Start]) --> AC[Auth0 Action\nInject Roles + AMR]
        AC --> EN([Complete - Token Issued])
    end

    subgraph ACTION ["Action: Inject Roles and AMR"]
        C1[event.authentication.methods\neg. pwd + otp] --> C2[api.idToken.setCustomClaim\nnamespace/amr = pwd, otp]
        C3[event.authorization.roles\neg. customer, agent] --> C4[api.idToken.setCustomClaim\nnamespace/roles = customer]
        C2 --> C5[Claims embedded\nin ID Token JWT]
        C4 --> C5
    end

    subgraph APP ["useRoles Hook - InsureConnect SPA"]
        R1[Read user object\nfrom Auth0 SDK] --> R2[Read AMR\ncustom claim]
        R2 --> R3{includes otp\nor mfa?}
        R3 -- Yes --> R4[mfaVerified = true]
        R3 -- No  --> R5[mfaVerified = false]
        R1 --> R6[Read roles\ncustom claim]
        R6 --> R7[hasRole check fn]
    end

    AC --> ACTION
    C5 --> APP

    style C5 fill:#16a34a,color:#fff
    style R4 fill:#16a34a,color:#fff
    style R5 fill:#dc2626,color:#fff
    style ST fill:#1a56db,color:#fff
    style EN fill:#16a34a,color:#fff
```

## 5. RBAC Route Protection

```mermaid
flowchart TD
    U([User navigates\nto protected route]) --> PR[ProtectedRoute.jsx]
    PR --> C1{isLoading?}
    C1 -- Yes --> SP[LoadingSpinner\nVerifying session...]
    C1 -- No  --> C2{isAuthenticated?}
    C2 -- No  --> RD[loginWithRedirect\nappState.returnTo saved]
    RD --> AUTH0([Auth0 Universal Login])
    C2 -- Yes --> C3{requiredRole\nspecified?}
    C3 -- No  --> OK([Render page\nany authenticated user])
    C3 -- Yes --> C4{hasRole matches\nrequiredRole?}
    C4 -- No  --> DN[Access Denied\nBack to Dashboard]
    C4 -- Yes --> OK2([Render page\nfor authorised role])

    subgraph ROUTES ["Route Role Requirements"]
        R1["/dashboard - no role needed"]
        R2["/policies  - no role needed"]
        R3["/claims    - no role needed"]
        R4["/admin     - requiredRole: admin"]
        R5["/agent     - requiredRole: agent"]
    end

    style OK fill:#16a34a,color:#fff
    style OK2 fill:#16a34a,color:#fff
    style DN fill:#dc2626,color:#fff
    style AUTH0 fill:#1a56db,color:#fff
    style U fill:#1a56db,color:#fff
```

## 6. Session Lifecycle — Token Expiry and Silent Refresh

```mermaid
flowchart TD
    LI([User logged in\nTokens in memory]) --> TK[ID Token valid\nExpiry 1 hour]
    TK --> SW[SessionWarning.jsx\nchecks expiry every 60s]
    SW --> C1{Time left\nover 5 min?}
    C1 -- Yes --> SW
    C1 -- No  --> WB[Warning banner shown\nX minutes remaining]
    WB --> C2{User action?}
    C2 -- Stay Logged In --> SR[getAccessTokenSilently\ncacheMode: off]
    SR --> C3{Refresh token\nstill valid?}
    C3 -- Yes --> TK2([New tokens issued\nSession extended])
    C3 -- No  --> LO[logout called\nAuth0 session cleared]
    C2 -- Sign Out Now --> LO
    C2 -- No action --> EX{Token expired?}
    EX -- Yes --> LO
    EX -- No  --> WB
    TK2 --> SW
    LO --> LAND([Redirect to Landing Page])

    style LI fill:#16a34a,color:#fff
    style TK2 fill:#16a34a,color:#fff
    style LO fill:#dc2626,color:#fff
    style WB fill:#7c3aed,color:#fff
    style LAND fill:#1a56db,color:#fff
```

## 7. Logout Flow

```mermaid
sequenceDiagram
    participant U  as User
    participant SP as InsureConnect SPA
    participant A0 as Auth0 Tenant

    U->>SP: Clicks Sign Out in Navbar
    SP->>SP: logout called with logoutConfig
    SP->>SP: Tokens cleared from memory
    SP->>A0: GET /v2/logout
    Note over SP,A0: ?client_id=xxx<br/>&returnTo=https://localhost:3010
    Note over A0: Auth0 clears SSO session cookie
    Note over A0: All apps sharing this session are logged out
    A0->>SP: 302 Redirect to https://localhost:3010
    SP->>U: Landing page shown
    Note over SP,U: Policy card blurred again<br/>User must sign in to access data
```

## 8. Security Layers — Defence in Depth

```mermaid
flowchart TD
    subgraph NET ["Layer 1 — Network Security"]
        N1[WAF - NGINX + ModSecurity\nBlocks OWASP Top 10 at ingress]
        N2[DDoS + Rate Limiting\nProtects /authorize endpoint]
        N3[TLS 1.3 only\nHTTP redirected to HTTPS]
    end

    subgraph AUTH ["Layer 2 — Authentication Security"]
        A1[PKCE code_challenge\nPrevents auth code interception]
        A2[Auth0 Universal Login\nPassword never touches SPA code]
        A3[MFA Always-On\nOTP required every login]
    end

    subgraph TOKEN ["Layer 3 — Token Security"]
        T1[Memory-only storage\nXSS cannot steal tokens]
        T2[Refresh token rotation\nStolen tokens auto-revoked]
        T3[1 hour expiry\nLimits breach blast radius]
    end

    subgraph APP ["Layer 4 — Application Security"]
        P1[ProtectedRoute + RBAC\nEvery route checks auth and role]
        P2[X-Frame-Options DENY\nClickjacking blocked]
        P3[CSP frame-ancestors none\nNo iframe embedding allowed]
    end

    NET --> AUTH --> TOKEN --> APP

    style NET fill:#dbeafe,stroke:#1a56db
    style AUTH fill:#dcfce7,stroke:#16a34a
    style TOKEN fill:#ede9fe,stroke:#7c3aed
    style APP fill:#ffedd5,stroke:#ea580c
```
