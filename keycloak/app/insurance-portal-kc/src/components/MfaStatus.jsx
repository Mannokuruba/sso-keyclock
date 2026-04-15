import { useRoles } from '../hooks/useRoles'

// Shows MFA status — reads amr claim from the Keycloak token.
export default function MfaStatus() {
  const { mfaVerified } = useRoles()

  const keycloakUrl = import.meta.env.VITE_KEYCLOAK_URL
  const realm       = import.meta.env.VITE_KEYCLOAK_REALM
  const accountUrl  = `${keycloakUrl}/realms/${realm}/account/#/security/signingin`

  return (
    <div className={`mfa-status-card ${mfaVerified ? 'mfa-ok' : 'mfa-warn'}`}>
      <span className="mfa-icon">{mfaVerified ? '🔐' : '⚠️'}</span>
      <div className="mfa-text">
        <p className="mfa-title">
          {mfaVerified ? 'MFA Verified' : 'MFA Not Active'}
        </p>
        <p className="mfa-desc">
          {mfaVerified
            ? 'Your account is protected with multi-factor authentication.'
            : 'Enable MFA to keep your insurance account secure.'}
        </p>
      </div>
      {!mfaVerified && (
        <a
          href={accountUrl}
          className="mfa-enroll-btn"
          target="_blank"
          rel="noopener noreferrer"
        >
          Enable MFA
        </a>
      )}
    </div>
  )
}
