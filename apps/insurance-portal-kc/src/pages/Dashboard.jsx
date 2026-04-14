import { useKeycloak } from '@react-keycloak/web'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'

const mockSummary = {
  activePolicies: 3,
  openClaims: 1,
  nextPremium: { amount: '$427.50', date: 'May 15, 2026' },
  totalCoverage: '$1,250,000',
}

const recentActivity = [
  { id: 1, type: 'claim',   label: 'Claim #CLM-2024-0831 submitted', date: 'Apr 8, 2026',  status: 'In Review' },
  { id: 2, type: 'payment', label: 'Premium payment received',        date: 'Apr 1, 2026',  status: 'Completed' },
  { id: 3, type: 'policy',  label: 'Home policy renewed',             date: 'Mar 22, 2026', status: 'Active'    },
]

export default function Dashboard() {
  const { keycloak } = useKeycloak()
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12)      setGreeting('Good morning')
    else if (hour < 18) setGreeting('Good afternoon')
    else                setGreeting('Good evening')
  }, [])

  const user      = keycloak.tokenParsed
  const firstName = user?.given_name || user?.name?.split(' ')[0] || user?.preferred_username || 'there'

  return (
    <div className="page-container">
      <div className="welcome-banner">
        <div>
          <h1 className="welcome-title">{greeting}, {firstName}! 👋</h1>
          <p className="welcome-sub">Here's your insurance overview for today.</p>
        </div>
        <Link to="/claims" className="btn-primary sm">+ File a Claim</Link>
      </div>

      <div className="summary-grid">
        <div className="summary-card blue">
          <span className="summary-icon">📋</span>
          <div><p className="summary-num">{mockSummary.activePolicies}</p><p className="summary-label">Active Policies</p></div>
        </div>
        <div className="summary-card orange">
          <span className="summary-icon">🔍</span>
          <div><p className="summary-num">{mockSummary.openClaims}</p><p className="summary-label">Open Claims</p></div>
        </div>
        <div className="summary-card green">
          <span className="summary-icon">💰</span>
          <div><p className="summary-num">{mockSummary.nextPremium.amount}</p><p className="summary-label">Next Premium ({mockSummary.nextPremium.date})</p></div>
        </div>
        <div className="summary-card purple">
          <span className="summary-icon">🛡️</span>
          <div><p className="summary-num">{mockSummary.totalCoverage}</p><p className="summary-label">Total Coverage</p></div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-heading">Quick Actions</h2>
        <div className="quick-actions">
          <Link to="/policies" className="qa-btn">📋 View Policies</Link>
          <Link to="/claims"   className="qa-btn">📝 New Claim</Link>
          <Link to="/profile"  className="qa-btn">👤 My Profile</Link>
          <a href="tel:18001234567" className="qa-btn">📞 Call Agent</a>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-heading">Recent Activity</h2>
        <ul className="activity-list">
          {recentActivity.map((item) => (
            <li key={item.id} className="activity-item">
              <span className="activity-icon">
                {item.type === 'claim' ? '📝' : item.type === 'payment' ? '💳' : '📋'}
              </span>
              <div className="activity-info">
                <p className="activity-label">{item.label}</p>
                <p className="activity-date">{item.date}</p>
              </div>
              <span className={`activity-status ${item.status === 'Completed' ? 'status-ok' : item.status === 'Active' ? 'status-active' : 'status-pending'}`}>
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
