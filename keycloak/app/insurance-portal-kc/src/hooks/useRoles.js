// Reads roles and MFA status from Keycloak token claims.
// Roles come from realm_access.roles in the Keycloak token.
// amr (authentication methods) indicates if MFA was used.

import { useKeycloak } from '@react-keycloak/web'

export function useRoles() {
  const { keycloak } = useKeycloak()

  const roles = keycloak.tokenParsed?.realm_access?.roles ?? []
  const amr   = keycloak.tokenParsed?.amr ?? []

  const hasRole = (role) => roles.includes(role)

  // True if this session completed an MFA step
  const mfaVerified = amr.some((m) => ['mfa', 'otp', 'sms', 'totp'].includes(m))

  return { roles, hasRole, mfaVerified }
}
