import { useEffect } from 'react'
import { useAuth0 } from '@auth0/auth0-react'
import { useNavigate } from 'react-router-dom'
import LoadingSpinner from '../components/LoadingSpinner'

// Auth0 redirects users to /callback after login (including after MFA).
// This page handles the code exchange and redirects to the intended destination.
export default function CallbackPage() {
  const { isAuthenticated, isLoading, error } = useAuth0()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return

    if (error) {
      console.error('Auth0 callback error:', error)
      navigate('/', { replace: true })
      return
    }

    if (isAuthenticated) {
      // Safely read returnTo — fall back to dashboard if missing or external
      const raw = window.history.state?.usr?.returnTo ?? '/dashboard'
      const returnTo = raw.startsWith('/') ? raw : '/dashboard'
      navigate(returnTo, { replace: true })
    }
  }, [isLoading, isAuthenticated, error, navigate])

  return <LoadingSpinner message="Completing sign-in..." />
}
