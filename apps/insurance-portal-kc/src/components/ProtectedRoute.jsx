import { useKeycloak } from '@react-keycloak/web'
import { useEffect } from 'react'
import { useRoles } from '../hooks/useRoles'
import LoadingSpinner from './LoadingSpinner'

// Wraps any route that requires authentication.
// Optional `requiredRole` enforces role-based access (e.g. "admin", "agent").
export default function ProtectedRoute({ children, requiredRole }) {
  const { keycloak, initialized } = useKeycloak()
  const { hasRole } = useRoles()

  useEffect(() => {
    if (initialized && !keycloak.authenticated) {
      // Redirect to Keycloak login, returning to the current page after auth
      keycloak.login({ redirectUri: window.location.href })
    }
  }, [initialized, keycloak])

  if (!initialized) return <LoadingSpinner message="Verifying session..." />
  if (!keycloak.authenticated) return <LoadingSpinner message="Redirecting to login..." />

  if (requiredRole && !hasRole(requiredRole)) {
    return (
      <div className="error-screen">
        <div className="error-card">
          <span className="error-icon">🚫</span>
          <h2>Access Denied</h2>
          <p>
            You need the <strong>{requiredRole}</strong> role to access this page.
            Contact your administrator if you believe this is an error.
          </p>
          <button onClick={() => window.location.replace('/dashboard')}>
            Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return children
}
