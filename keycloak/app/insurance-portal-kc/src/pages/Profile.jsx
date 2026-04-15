import { useKeycloak } from '@react-keycloak/web'
import MfaStatus from '../components/MfaStatus'

export default function Profile() {
  const { keycloak } = useKeycloak()
  const user = keycloak.tokenParsed

  const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL
  const realm       = import.meta.env.VITE_KEYCLOAK_REALM
  const accountUrl  = `${keycloakUrl}/realms/${realm}/account`

  const handleViewToken = () => {
    console.log('Access Token (dev only):', keycloak.token)
    alert('Access token logged to browser console (dev mode only).')
  }

  const profileFields = [
    { label: 'Full Name',       value: user?.name },
    { label: 'Email',           value: user?.email },
    { label: 'Email Verified',  value: user?.email_verified ? '✅ Verified' : '❌ Not verified' },
    { label: 'Username',        value: user?.preferred_username },
    { label: 'Auth Provider',   value: 'Keycloak' },
    { label: 'User ID',         value: user?.sub },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Profile</h1>
        <p className="page-sub">Manage your account settings and security.</p>
      </div>

      {/* Avatar */}
      <div className="section-card profile-header-card">
        <div className="profile-avatar-placeholder">
          {user?.name?.[0]?.toUpperCase() ?? user?.preferred_username?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <div>
          <h2 className="profile-name">{user?.name ?? user?.preferred_username}</h2>
          <p className="profile-email">{user?.email}</p>
          <span className="badge badge-green">Active Customer</span>
        </div>
      </div>

      {/* MFA Status */}
      <MfaStatus />

      {/* Account Details */}
      <div className="section-card">
        <h2 className="section-heading">Account Details</h2>
        <dl className="profile-fields">
          {profileFields.map(({ label, value }) => (
            <div key={label} className="profile-field">
              <dt className="field-label">{label}</dt>
              <dd className="field-val">{value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Security */}
      <div className="section-card">
        <h2 className="section-heading">Security</h2>
        <div className="security-actions">
          <div className="security-action-row">
            <div>
              <p className="sa-title">Change Password</p>
              <p className="sa-desc">Update your account password via Keycloak.</p>
            </div>
            <a
              href={`${accountUrl}/#/security/signingin`}
              className="btn-outline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Change Password
            </a>
          </div>

          <div className="security-action-row">
            <div>
              <p className="sa-title">Multi-Factor Authentication</p>
              <p className="sa-desc">Manage your MFA devices and authentication methods.</p>
            </div>
            <a
              href={`${accountUrl}/#/security/signingin`}
              className="btn-outline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Manage MFA
            </a>
          </div>

          {import.meta.env.VITE_APP_ENV === 'development' && (
            <div className="security-action-row dev-only">
              <div>
                <p className="sa-title">🔧 Dev: View Token</p>
                <p className="sa-desc">Inspect the current access token (dev only).</p>
              </div>
              <button className="btn-outline" onClick={handleViewToken}>
                View Token
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Sign out */}
      <div className="section-card">
        <button
          className="btn-danger"
          onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
        >
          Sign Out of All Sessions
        </button>
      </div>
    </div>
  )
}
