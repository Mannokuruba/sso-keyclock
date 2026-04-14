import { useKeycloak } from '@react-keycloak/web'
import { useEffect, useState, useCallback } from 'react'

// Show a warning banner 5 minutes before the ID token expires.
// Offers "Stay Logged In" (token refresh) or "Sign Out".
const WARN_BEFORE_MS  = 5 * 60 * 1000   // 5 minutes
const CHECK_INTERVAL  = 60 * 1000        // check every 60 seconds

export default function SessionWarning() {
  const { keycloak } = useKeycloak()
  const [minutesLeft, setMinutesLeft] = useState(null)
  const [visible, setVisible]         = useState(false)

  const checkExpiry = useCallback(() => {
    if (!keycloak.authenticated) return
    const exp = keycloak.idTokenParsed?.exp
    if (!exp) return

    const msLeft = exp * 1000 - Date.now()

    if (msLeft <= 0) {
      keycloak.logout({ redirectUri: window.location.origin })
    } else if (msLeft <= WARN_BEFORE_MS) {
      setMinutesLeft(Math.ceil(msLeft / 60000))
      setVisible(true)
    } else {
      setVisible(false)
    }
  }, [keycloak])

  // Force-refresh the token — extends the session without re-login
  const extendSession = async () => {
    try {
      await keycloak.updateToken(-1) // -1 forces refresh regardless of expiry
      setVisible(false)
    } catch {
      keycloak.logout({ redirectUri: window.location.origin })
    }
  }

  useEffect(() => {
    checkExpiry()
    const timer = setInterval(checkExpiry, CHECK_INTERVAL)
    return () => clearInterval(timer)
  }, [checkExpiry])

  if (!visible) return null

  return (
    <div className="session-warning" role="alert" aria-live="assertive">
      <span className="session-warning-icon">⏱️</span>
      <p className="session-warning-text">
        Your session expires in{' '}
        <strong>{minutesLeft} minute{minutesLeft !== 1 ? 's' : ''}</strong>.
        Unsaved changes may be lost.
      </p>
      <div className="session-warning-actions">
        <button className="session-extend-btn" onClick={extendSession}>
          Stay Logged In
        </button>
        <button
          className="session-logout-btn"
          onClick={() => keycloak.logout({ redirectUri: window.location.origin })}
        >
          Sign Out Now
        </button>
      </div>
    </div>
  )
}
