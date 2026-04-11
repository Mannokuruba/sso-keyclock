import { useAuth0 } from '@auth0/auth0-react'
import { logoutConfig } from '../auth0-config'
import MfaStatus from '../components/MfaStatus'

export default function Profile() {
  const { user, logout, getAccessTokenSilently } = useAuth0()

  const handleViewToken = async () => {
    // For debugging only — remove in production
    const token = await getAccessTokenSilently()
    console.log('Access Token (dev only):', token)
    alert('Access token logged to browser console (dev mode only).')
  }

  const profileFields = [
    { label: 'Full Name', value: user?.name },
    { label: 'Email', value: user?.email },
    { label: 'Email Verified', value: user?.email_verified ? '✅ Verified' : '❌ Not verified' },
    { label: 'Auth Provider', value: user?.sub?.split('|')[0] === 'auth0' ? 'Email / Password' : user?.sub?.split('|')[0] },
    { label: 'Account Created', value: user?.updated_at ? new Date(user.updated_at).toLocaleDateString() : '—' },
    { label: 'User ID', value: user?.sub },
  ]

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>My Profile</h1>
        <p className="page-sub">Manage your account settings and security.</p>
      </div>

      {/* Avatar section */}
      <div className="section-card profile-header-card">
        {user?.picture
          ? <img src={user.picture} alt={user.name} className="profile-avatar" />
          : <div className="profile-avatar-placeholder">{user?.name?.[0]?.toUpperCase() ?? 'U'}</div>
        }
        <div>
          <h2 className="profile-name">{user?.name}</h2>
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

      {/* Security Actions */}
      <div className="section-card">
        <h2 className="section-heading">Security</h2>
        <div className="security-actions">
          <div className="security-action-row">
            <div>
              <p className="sa-title">Change Password</p>
              <p className="sa-desc">Update your account password via Auth0.</p>
            </div>
            <a
              href={`https://${import.meta.env.VITE_AUTH0_DOMAIN}/u/reset-password`}
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
              href={`https://${import.meta.env.VITE_AUTH0_DOMAIN}/u/mfa-enrollment`}
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
          onClick={() => logout(logoutConfig)}
        >
          Sign Out of All Sessions
        </button>
      </div>
    </div>
  )
}
