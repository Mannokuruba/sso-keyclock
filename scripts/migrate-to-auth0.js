/**
 * migrate-to-auth0.js
 * Lazy migration — exports users from Keycloak and pre-creates them in Auth0.
 *
 * What this does:
 *   1. Fetches all users from Keycloak "insurance" realm
 *   2. Transforms them into Auth0's bulk-import format
 *   3. Imports them into Auth0 as shell accounts (no passwords)
 *   4. On first login, Auth0 calls Keycloak to verify the password → migrates it
 *
 * Usage:
 *   AUTH0_DOMAIN=xxx AUTH0_MGMT_TOKEN=xxx node scripts/migrate-to-auth0.js
 *
 * Get AUTH0_MGMT_TOKEN:
 *   Auth0 Dashboard → Applications → APIs → Auth0 Management API → Test → copy token
 *
 * Prerequisites:
 *   - Keycloak running with 100 seeded users (run seed-keycloak-users.js first)
 *   - Auth0 Custom Database connection created (see README)
 */

const KEYCLOAK_URL      = 'http://localhost:8080'
const KEYCLOAK_REALM    = 'insurance'
const ADMIN_USER        = 'admin'
const ADMIN_PASSWORD    = 'admin123'

// Set via environment variables — never hardcode Auth0 credentials
const AUTH0_DOMAIN      = process.env.AUTH0_DOMAIN      // e.g. dev-xxx.jp.auth0.com
const AUTH0_MGMT_TOKEN  = process.env.AUTH0_MGMT_TOKEN  // Management API token
const AUTH0_CONNECTION  = process.env.AUTH0_CONNECTION  || 'keycloak-migration' // your Custom DB connection name

// ── Keycloak helpers ──────────────────────────────────────────────────────────

async function getKeycloakAdminToken() {
  const res = await fetch(
    `${KEYCLOAK_URL}/realms/master/protocol/openid-connect/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id:  'admin-cli',
        username:   ADMIN_USER,
        password:   ADMIN_PASSWORD,
      }),
    }
  )
  if (!res.ok) throw new Error(`Keycloak admin token failed: ${res.status}`)
  return (await res.json()).access_token
}

async function fetchKeycloakUsers(token) {
  const allUsers = []
  let first = 0
  const max  = 50  // page size

  while (true) {
    const res = await fetch(
      `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users?first=${first}&max=${max}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    if (!res.ok) throw new Error(`Fetch users failed: ${res.status}`)
    const page = await res.json()
    if (page.length === 0) break
    allUsers.push(...page)
    first += max
    if (page.length < max) break
  }
  return allUsers
}

async function getUserRoles(token, userId) {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  if (!res.ok) return []
  const roles = await res.json()
  return roles.map(r => r.name).filter(r => !['offline_access','uma_authorization','default-roles-insurance'].includes(r))
}

// ── Auth0 helpers ─────────────────────────────────────────────────────────────

/**
 * Transform one Keycloak user into Auth0 bulk-import format.
 * Docs: https://auth0.com/docs/manage-users/user-migration/bulk-user-imports
 */
function toAuth0Format(kcUser, roles) {
  return {
    // Core identity
    email:          kcUser.email,
    email_verified: kcUser.emailVerified ?? false,
    name:           `${kcUser.firstName ?? ''} ${kcUser.lastName ?? ''}`.trim() || kcUser.username,
    given_name:     kcUser.firstName ?? '',
    family_name:    kcUser.lastName  ?? '',
    nickname:       kcUser.username,

    // NO password_hash field → Auth0 will use Custom Database Login script
    // on first login to verify against Keycloak, then store the migrated hash

    // Custom claims (available in Auth0 Rules/Actions as user.app_metadata)
    app_metadata: {
      keycloak_id:      kcUser.id,
      keycloak_realm:   KEYCLOAK_REALM,
      roles,
      policy_number:    kcUser.attributes?.policyNumber?.[0] ?? null,
      migrated_from:    'keycloak',
      migration_status: 'pending',   // becomes "complete" after first login
    },

    // user_metadata is user-editable (phone, preferences etc.)
    user_metadata: {
      source_idp: 'keycloak',
    },
  }
}

/**
 * Auth0 bulk import — accepts a JSON array of users, returns a job ID.
 * Limit: 500,000 users per file, but batches of 500 are recommended.
 */
async function importBatchToAuth0(users) {
  if (!AUTH0_DOMAIN || !AUTH0_MGMT_TOKEN) {
    throw new Error(
      'Missing AUTH0_DOMAIN or AUTH0_MGMT_TOKEN environment variables.\n' +
      'Run: AUTH0_DOMAIN=xxx AUTH0_MGMT_TOKEN=xxx node scripts/migrate-to-auth0.js'
    )
  }

  // Build multipart/form-data manually (no external deps)
  const boundary = `----FormBoundary${Date.now()}`
  const usersJson = JSON.stringify(users)

  const body = [
    `--${boundary}`,
    'Content-Disposition: form-data; name="connection_id"',
    '',
    AUTH0_CONNECTION,
    `--${boundary}`,
    'Content-Disposition: form-data; name="users"; filename="users.json"',
    'Content-Type: application/json',
    '',
    usersJson,
    `--${boundary}--`,
  ].join('\r\n')

  const res = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/jobs/users-imports`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${AUTH0_MGMT_TOKEN}`,
        'Content-Type':  `multipart/form-data; boundary=${boundary}`,
      },
      body,
    }
  )

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Auth0 import failed: ${res.status} ${text}`)
  }
  return await res.json()
}

async function pollJobStatus(jobId) {
  console.log(`\n⏳  Polling Auth0 import job ${jobId}...`)
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 3000))

    const res = await fetch(
      `https://${AUTH0_DOMAIN}/api/v2/jobs/${jobId}`,
      { headers: { 'Authorization': `Bearer ${AUTH0_MGMT_TOKEN}` } }
    )
    const job = await res.json()

    if (job.status === 'completed') {
      return job
    } else if (job.status === 'failed') {
      throw new Error(`Job failed: ${JSON.stringify(job.summary)}`)
    }
    process.stdout.write('.')
  }
  console.log('\n⚠  Job still running — check Auth0 Dashboard → Jobs')
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Keycloak → Auth0 Lazy Migration')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Step 1: Fetch from Keycloak
  console.log('1️⃣   Fetching users from Keycloak...')
  const kcToken = await getKeycloakAdminToken()
  const kcUsers = await fetchKeycloakUsers(kcToken)
  console.log(`    Found ${kcUsers.length} users in realm "${KEYCLOAK_REALM}"\n`)

  // Step 2: Fetch roles per user & transform
  console.log('2️⃣   Transforming users + fetching roles...')
  const auth0Users = []
  for (const u of kcUsers) {
    const roles     = await getUserRoles(kcToken, u.id)
    const formatted = toAuth0Format(u, roles)
    auth0Users.push(formatted)
    process.stdout.write('.')
  }
  console.log(`\n    Transformed ${auth0Users.length} users\n`)

  // Step 3: Write export file (useful for review / audit)
  const exportPath = './scripts/keycloak-users-export.json'
  const { writeFileSync } = await import('fs')
  writeFileSync(exportPath, JSON.stringify(auth0Users, null, 2))
  console.log(`3️⃣   Export saved to ${exportPath} (review before importing)\n`)

  // Step 4: Import to Auth0 (skip if env vars not set — dry run mode)
  if (!AUTH0_DOMAIN || !AUTH0_MGMT_TOKEN) {
    console.log('4️⃣   ⚠  AUTH0_DOMAIN / AUTH0_MGMT_TOKEN not set.')
    console.log('    Export is ready at scripts/keycloak-users-export.json')
    console.log('    To import, run:')
    console.log('    AUTH0_DOMAIN=your-domain.auth0.com AUTH0_MGMT_TOKEN=xxx node scripts/migrate-to-auth0.js')
    return
  }

  console.log(`4️⃣   Importing to Auth0 (connection: ${AUTH0_CONNECTION})...`)

  // Batch into groups of 500 (Auth0 recommendation)
  const BATCH_SIZE = 500
  for (let i = 0; i < auth0Users.length; i += BATCH_SIZE) {
    const batch    = auth0Users.slice(i, i + BATCH_SIZE)
    const batchNum = Math.floor(i / BATCH_SIZE) + 1
    console.log(`\n  Batch ${batchNum}: importing ${batch.length} users...`)

    const job = await importBatchToAuth0(batch)
    console.log(`  Job ID: ${job.id}`)

    const result = await pollJobStatus(job.id)
    console.log(`\n  ✅  Batch ${batchNum} complete:`, result.summary)
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('  Migration complete!')
  console.log('  Users exist in Auth0 as shell accounts.')
  console.log('  On first login, Auth0 Custom DB script will')
  console.log('  verify password against Keycloak and migrate it.')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
}

main().catch((err) => { console.error('\n❌ ', err.message); process.exit(1) })
