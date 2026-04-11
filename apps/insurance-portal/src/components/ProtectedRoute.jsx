import { useAuth0 } from '@auth0/auth0-react'
import { useEffect } from 'react'
import { useRoles } from '../hooks/useRoles'
import LoadingSpinner from './LoadingSpinner'

// Wraps any route that requires authentication.
// Optional `requiredRole` prop enforces role-based access (e.g. "admin", "agent").
// Without requiredRole, any authenticated user is allowed through.
export default function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, isLoading, loginWithRedirect } = useAuth0()
  const { hasRole } = useRoles()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      loginWithRedirect({
        appState: { returnTo: window.location.pathname },
      })
    }
  }, [isLoading, isAuthenticated, loginWithRedirect])

  if (isLoading) return <LoadingSpinner message="Verifying session..." />
  if (!isAuthenticated) return <LoadingSpinner message="Redirecting to login..." />

  // Role check — only runs when requiredRole is specified
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
