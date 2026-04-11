import { useRoles } from '../hooks/useRoles'

// Shows MFA enrollment status — reads from the custom claim injected by the Auth0 Action.
export default function MfaStatus() {
  const { mfaVerified } = useRoles()

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
          href={`https://${import.meta.env.VITE_AUTH0_DOMAIN}/u/mfa-enrollment`}
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
