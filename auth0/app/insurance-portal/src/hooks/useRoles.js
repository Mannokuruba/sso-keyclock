// Custom hook — reads roles and MFA status from Auth0 ID token claims.
// These claims are injected by the Auth0 Action in your Login flow.
// Namespace must match exactly what the Action writes.

import { useAuth0 } from '@auth0/auth0-react'

const NS = 'https://insurance.app/'

export function useRoles() {
  const { user } = useAuth0()

  const roles = user?.[`${NS}roles`] ?? []
  const amr   = user?.[`${NS}amr`]   ?? []

  const hasRole = (role) => roles.includes(role)

  // True if this session completed an MFA step
  const mfaVerified = amr.some((m) => ['mfa', 'otp', 'sms', 'totp'].includes(m))

  return { roles, hasRole, mfaVerified }
}
