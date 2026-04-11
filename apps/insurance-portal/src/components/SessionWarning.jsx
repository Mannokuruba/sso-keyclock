import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useState, useCallback } from 'react'
import { logoutConfig } from '../auth0-config'

// Show a warning banner 5 minutes before the ID token expires.
// Offers "Stay Logged In" (silent refresh) or "Sign Out".
const WARN_BEFORE_MS = 5 * 60 * 1000   // 5 minutes
const CHECK_INTERVAL_MS = 60 * 1000    // check every 60 seconds

export default function SessionWarning() {
  const { isAuthenticated, getIdTokenClaims, getAccessTokenSilently, logout } = useAuth0()
  const [minutesLeft, setMinutesLeft] = useState(null)
  const [visible, setVisible] = useState(false)

  const checkExpiry = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const claims = await getIdTokenClaims()
      if (!claims?.exp) return

      const msLeft = claims.exp * 1000 - Date.now()

      if (msLeft <= 0) {
        // Already expired — force logout
        logout(logoutConfig)
      } else if (msLeft <= WARN_BEFORE_MS) {
        setMinutesLeft(Math.ceil(msLeft / 60000))
        setVisible(true)
      } else {
        setVisible(false)
      }
    } catch {
      // Claims unavailable — session likely expired
      logout(logoutConfig)
    }
  }, [isAuthenticated, getIdTokenClaims, logout])

  // Silent refresh — extends session without re-login prompt
  const extendSession = async () => {
    try {
      await getAccessTokenSilently({ cacheMode: 'off' })
      setVisible(false)
    } catch {
      // Refresh failed (e.g. refresh token also expired)
      logout(logoutConfig)
    }
  }

  useEffect(() => {
    checkExpiry()
    const timer = setInterval(checkExpiry, CHECK_INTERVAL_MS)
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
          onClick={() => logout(logoutConfig)}
        >
          Sign Out Now
        </button>
      </div>
    </div>
  )
}
