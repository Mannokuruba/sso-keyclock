/**
 * migrate-one-user.js
 * Migrates a single user from Keycloak → Auth0 for testing.
 *
 * Usage:
 *   AUTH0_MGMT_TOKEN=xxx AUTH0_CONNECTION=xxx node scripts/migrate-one-user.js user001
 *   AUTH0_MGMT_TOKEN=xxx AUTH0_CONNECTION=xxx node scripts/migrate-one-user.js james.harris1@insureconnect-demo.com
 */

const KEYCLOAK_URL   = 'http://localhost:8080'
const KEYCLOAK_REALM = 'insurance'
const ADMIN_USER     = 'admin'
const ADMIN_PASSWORD = 'admin123'
const AUTH0_DOMAIN   = process.env.AUTH0_DOMAIN   || 'dev-lmezv6ucdrtju3c1.jp.auth0.com'
const AUTH0_TOKEN    = process.env.AUTH0_MGMT_TOKEN
const AUTH0_CONN     = process.env.AUTH0_CONNECTION

const lookup = process.argv[2]  // username or email

if (!lookup) {
  console.error('Usage: node scripts/migrate-one-user.js <username|email>')
  process.exit(1)
}
if (!AUTH0_TOKEN || !AUTH0_CONN) {
  console.error('Missing AUTH0_MGMT_TOKEN or AUTH0_CONNECTION env vars')
  process.exit(1)
}

// ── Keycloak ──────────────────────────────────────────────────────────────────

async function getAdminToken() {
  const res = await fetch(`${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'password', client_id: 'admin-cli',
      username: ADMIN_USER, password: ADMIN_PASSWORD,
    }),
  })
  if (!res.ok) throw new Error(`Admin token: ${res.status}`)
  return (await res.json()).access_token
}

async function findKeycloakUser(token, lookup) {
  const isEmail = lookup.includes('@')
  const param   = isEmail ? `email=${encodeURIComponent(lookup)}` : `username=${encodeURIComponent(lookup)}`
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?${param}&exact=true`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  if (!res.ok) throw new Error(`User lookup: ${res.status}`)
  const users = await res.json()
  if (users.length === 0) throw new Error(`User "${lookup}" not found in Keycloak`)
  return users[0]
}

async function getUserRoles(token, userId) {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
    { headers: { Authorization: `Bearer ${token}` } }
  )
  const roles = await res.json()
  return roles
    .map(r => r.name)
    .filter(r => !['offline_access','uma_authorization','default-roles-insurance'].includes(r))
}

// ── Auth0 ─────────────────────────────────────────────────────────────────────

async function getAuth0ConnectionId(connName) {
  const res = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/connections?name=${encodeURIComponent(connName)}&strategy=auth0`,
    { headers: { Authorization: `Bearer ${AUTH0_TOKEN}` } }
  )
  if (!res.ok) throw new Error(`Connection lookup: ${res.status} ${await res.text()}`)
  const conns = await res.json()
  if (conns.length === 0) throw new Error(`No Auth0 DB connection named "${connName}"`)
  return conns[0].id
}

async function importUserToAuth0(user, roles, connectionId) {
  const payload = [{
    email:          user.email,
    email_verified: user.emailVerified ?? false,
    name:           `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.username,
    given_name:     user.firstName ?? '',
    family_name:    user.lastName  ?? '',
    nickname:       user.username,
    app_metadata: {
      keycloak_id:      user.id,
      keycloak_realm:   KEYCLOAK_REALM,
      roles,
      policy_number:    user.attributes?.policyNumber?.[0] ?? null,
      migrated_from:    'keycloak',
      migration_status: 'pending',
    },
    user_metadata: { source_idp: 'keycloak' },
  }]

  const boundary = `----Boundary${Date.now()}`
  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="connection_id"',
    '', connectionId,
    `--${boundary}`,
    'Content-Disposition: form-data; name="upsert"',
    '', 'true',
    `--${boundary}`,
    'Content-Disposition: form-data; name="users"; filename="users.json"',
    'Content-Type: application/json',
    '', JSON.stringify(payload),
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(`https://${AUTH0_DOMAIN}/api/v2/jobs/users-imports`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${AUTH0_TOKEN}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })
  if (!res.ok) throw new Error(`Import: ${res.status} ${await res.text()}`)
  return await res.json()
}

async function pollJob(jobId) {
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`https://${AUTH0_DOMAIN}/api/v2/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${AUTH0_TOKEN}` },
    })
    const job = await res.json()
    if (job.status === 'completed') return job
    if (job.status === 'failed') throw new Error(`Job failed: ${JSON.stringify(job)}`)
    process.stdout.write('.')
  }
  throw new Error('Job timed out')
}

async function verifyInAuth0(email) {
  const res = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
    { headers: { Authorization: `Bearer ${AUTH0_TOKEN}` } }
  )
  if (!res.ok) throw new Error(`Verify: ${res.status}`)
  const users = await res.json()
  return users[0] ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔍  Looking up "${lookup}" in Keycloak...`)
  const kcToken  = await getAdminToken()
  const kcUser   = await findKeycloakUser(kcToken, lookup)
  const roles    = await getUserRoles(kcToken, kcUser.id)

  console.log(`\n📋  Found Keycloak user:`)
  console.log(`    Username : ${kcUser.username}`)
  console.log(`    Email    : ${kcUser.email}`)
  console.log(`    Name     : ${kcUser.firstName} ${kcUser.lastName}`)
  console.log(`    Roles    : ${roles.join(', ') || 'none'}`)
  console.log(`    KC ID    : ${kcUser.id}`)

  console.log(`\n🔗  Resolving Auth0 connection "${AUTH0_CONN}"...`)
  const connId = await getAuth0ConnectionId(AUTH0_CONN)
  console.log(`    Connection ID: ${connId}`)

  console.log(`\n📤  Importing to Auth0...`)
  const job = await importUserToAuth0(kcUser, roles, connId)
  console.log(`    Job ID: ${job.id}`)
  process.stdout.write('    Waiting')
  const result = await pollJob(job.id)
  console.log(`\n    Result: ${JSON.stringify(result.summary)}`)

  console.log(`\n✅  Verifying user exists in Auth0...`)
  const auth0User = await verifyInAuth0(kcUser.email)

  if (auth0User) {
    console.log(`\n🎉  Migration successful!`)
    console.log(`    Auth0 user_id : ${auth0User.user_id}`)
    console.log(`    Email         : ${auth0User.email}`)
    console.log(`    Roles         : ${auth0User.app_metadata?.roles?.join(', ')}`)
    console.log(`    Status        : ${auth0User.app_metadata?.migration_status}`)
    console.log(`\n    ⚡  This user can now log in via Auth0.`)
    console.log(`       On first login, the Custom DB script will verify`)
    console.log(`       "${kcUser.username} / InsurePass${kcUser.username.replace('user','')}!" against Keycloak`)
    console.log(`       and migrate the password hash permanently.\n`)
  } else {
    console.log(`\n⚠  User not found in Auth0 after import — check job errors above`)
  }
}

main().catch(err => { console.error('\n❌ ', err.message); process.exit(1) })
