import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function LandingPage() {
  const { loginWithRedirect, isAuthenticated } = useAuth0()
  const navigate = useNavigate()

  // If already logged in, skip landing and go to dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard')
  }, [isAuthenticated, navigate])

  const features = [
    { icon: '📋', title: 'View Policies', desc: 'Access all your active insurance policies in one place.' },
    { icon: '🏥', title: 'File Claims', desc: 'Submit and track insurance claims with real-time status.' },
    { icon: '🔐', title: 'MFA Protected', desc: 'Your account is secured with multi-factor authentication.' },
    { icon: '📞', title: '24/7 Support', desc: 'Contact your dedicated agent anytime.' },
  ]

  return (
    <div className="landing">
      {/* Hero */}
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">Trusted by 500,000+ customers</div>
          <h1 className="hero-title">
            Your Insurance,<br />
            <span className="hero-accent">Simplified.</span>
          </h1>
          <p className="hero-subtitle">
            Manage all your policies, file claims, and connect with your agent —
            all secured with enterprise-grade authentication.
          </p>
          <div className="hero-actions">
            <button
              className="btn-primary"
              onClick={() => loginWithRedirect({
                authorizationParams: { screen_hint: 'signup' },
              })}
            >
              Create Account
            </button>
            <button
              className="btn-secondary"
              onClick={() => loginWithRedirect()}
            >
              Sign In
            </button>
          </div>

          <div className="trust-badges">
            <span className="trust-item">🔒 256-bit SSL</span>
            <span className="trust-item">✅ SOC 2 Compliant</span>
            <span className="trust-item">🏛️ NAIC Standards</span>
          </div>
        </div>

        <div className="hero-visual">
          <div className="hero-card">
            <div className="hc-header">
              <span className="hc-dot red" />
              <span className="hc-dot yellow" />
              <span className="hc-dot green" />
            </div>
            <div className="hc-body">
              {/* Blurred placeholder rows — real data shown only after login */}
              <div className="hc-locked-overlay">
                <span className="hc-lock-icon">🔒</span>
                <p className="hc-lock-title">Your policies are private</p>
                <p className="hc-lock-desc">Sign in to securely view your coverage, claims, and account details.</p>
              </div>
              <div className="hc-row hc-blurred">
                <span className="hc-label">Policy #</span>
                <span className="hc-val">●●●●●●●●●●</span>
              </div>
              <div className="hc-row hc-blurred">
                <span className="hc-label">Type</span>
                <span className="hc-val">●●●●●●●●</span>
              </div>
              <div className="hc-row hc-blurred">
                <span className="hc-label">Status</span>
                <span className="hc-val">●●●●●</span>
              </div>
              <div className="hc-row hc-blurred">
                <span className="hc-label">Premium</span>
                <span className="hc-val">●●●●●●●</span>
              </div>
              <div className="hc-row hc-blurred">
                <span className="hc-label">Coverage</span>
                <span className="hc-val">●●●●●●●</span>
              </div>
              <div className="hc-auth-bar">
                <span>🔐</span>
                <span className="hc-auth-text">Protected by Auth0 MFA</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features">
        <h2 className="section-title">Everything you need, in one portal</h2>
        <div className="feature-grid">
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="feature-card">
              <span className="feature-icon">{icon}</span>
              <h3 className="feature-title">{title}</h3>
              <p className="feature-desc">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <h2>Ready to get started?</h2>
        <p>Join thousands of customers managing their insurance online.</p>
        <button className="btn-primary" onClick={() => loginWithRedirect()}>
          Sign In to Your Portal
        </button>
      </section>
    </div>
  )
}
