/**
 * seed-keycloak-users.js
 * Creates 100 dummy insurance customers in the Keycloak "insurance" realm.
 *
 * Usage:
 *   node scripts/seed-keycloak-users.js
 *
 * Prerequisites:
 *   - Keycloak running at http://localhost:8080
 *   - "insurance" realm exists
 *   - Admin credentials below match your .env (admin / admin123)
 */

const KEYCLOAK_URL   = 'http://localhost:8080'
const REALM          = 'insurance'
const ADMIN_USER     = 'admin'
const ADMIN_PASSWORD = 'admin123'

// ── 100 unique dummy users ────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James','Mary','John','Patricia','Robert','Jennifer','Michael','Linda',
  'William','Barbara','David','Susan','Richard','Jessica','Joseph','Sarah',
  'Thomas','Karen','Charles','Lisa','Christopher','Nancy','Daniel','Betty',
  'Matthew','Margaret','Anthony','Sandra','Mark','Ashley','Donald','Dorothy',
  'Steven','Kimberly','Paul','Emily','Andrew','Donna','Joshua','Michelle',
  'Kenneth','Carol','Kevin','Amanda','Brian','Melissa','George','Deborah',
  'Timothy','Stephanie','Ronald','Rebecca','Edward','Sharon','Jason','Laura',
  'Jeffrey','Cynthia','Ryan','Kathleen','Jacob','Amy','Gary','Angela',
  'Nicholas','Shirley','Eric','Anna','Jonathan','Brenda','Stephen','Pamela',
  'Larry','Emma','Justin','Nicole','Scott','Helen','Brandon','Samantha',
  'Benjamin','Katherine','Samuel','Christine','Raymond','Debra','Gregory','Rachel',
  'Frank','Carolyn','Alexander','Janet','Patrick','Catherine','Jack','Maria',
  'Dennis','Heather',
]

const LAST_NAMES = [
  'Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis',
  'Rodriguez','Martinez','Hernandez','Lopez','Gonzalez','Wilson','Anderson',
  'Thomas','Taylor','Moore','Jackson','Martin','Lee','Perez','Thompson',
  'White','Harris','Sanchez','Clark','Ramirez','Lewis','Robinson','Walker',
  'Young','Allen','King','Wright','Scott','Torres','Nguyen','Hill','Flores',
  'Green','Adams','Nelson','Baker','Hall','Rivera','Campbell','Mitchell',
  'Carter','Roberts','Turner','Phillips','Evans','Collins','Stewart','Morris',
  'Morgan','Reed','Cook','Bell','Murphy','Bailey','Cooper','Richardson',
  'Cox','Howard','Ward','Torres','Peterson','Gray','Ramirez','James',
  'Watson','Brooks','Kelly','Sanders','Price','Bennett','Wood','Barnes',
  'Ross','Henderson','Coleman','Jenkins','Perry','Powell','Long','Patterson',
  'Hughes','Flores','Washington','Butler','Simmons','Foster','Gonzales','Bryant',
  'Alexander','Russell','Griffin','Diaz','Hayes','Myers',
]

const ROLES = ['customer', 'customer', 'customer', 'customer', 'agent'] // 80% customer, 20% agent

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateUsers(count = 100) {
  const users = []
  const usedEmails = new Set()

  for (let i = 1; i <= count; i++) {
    let email
    let firstName, lastName

    // Guarantee unique email
    do {
      firstName = FIRST_NAMES[(i - 1) % FIRST_NAMES.length]
      lastName  = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      email     = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@insureconnect-demo.com`
    } while (usedEmails.has(email))

    usedEmails.add(email)

    users.push({
      username:      `user${String(i).padStart(3, '0')}`,
      email,
      firstName,
      lastName,
      password:      `InsurePass${i}!`,   // unique per user — safe for demo
      role:          randomItem(ROLES),
      policyNumber:  `INS-DEMO-${String(100000 + i)}`,
    })
  }
  return users
}

// ── Keycloak Admin API helpers ────────────────────────────────────────────────

async function getAdminToken() {
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
  if (!res.ok) throw new Error(`Admin token failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  return data.access_token
}

async function createUser(token, user) {
  const res = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        username:      user.username,
        email:         user.email,
        firstName:     user.firstName,
        lastName:      user.lastName,
        emailVerified: true,
        enabled:       true,
        credentials: [
          { type: 'password', value: user.password, temporary: false },
        ],
        attributes: {
          policyNumber: [user.policyNumber],
          migratedFrom: ['keycloak'],
        },
      }),
    }
  )

  if (res.status === 409) {
    return { skipped: true, username: user.username }  // already exists
  }
  if (!res.ok) {
    throw new Error(`Create user ${user.username} failed: ${res.status} ${await res.text()}`)
  }

  // Get the created user's ID from Location header
  const location = res.headers.get('location')
  const userId   = location?.split('/').pop()
  return { userId, username: user.username }
}

async function assignRole(token, userId, roleName) {
  // 1. Look up the role object
  const rolesRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/roles/${roleName}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  )
  if (!rolesRes.ok) {
    console.warn(`  ⚠ Role "${roleName}" not found — skipping role assignment`)
    return
  }
  const role = await rolesRes.json()

  // 2. Assign it to the user
  const assignRes = await fetch(
    `${KEYCLOAK_URL}/admin/realms/${REALM}/users/${userId}/role-mappings/realm`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify([role]),
    }
  )
  if (!assignRes.ok) {
    console.warn(`  ⚠ Role assign failed for user ${userId}: ${assignRes.status}`)
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🔑  Getting Keycloak admin token...')
  const token = await getAdminToken()
  console.log('✅  Token obtained\n')

  const users   = generateUsers(100)
  let created   = 0
  let skipped   = 0
  let failed    = 0

  console.log(`👥  Creating ${users.length} users in realm "${REALM}"...\n`)

  for (const user of users) {
    try {
      const result = await createUser(token, user)

      if (result.skipped) {
        console.log(`  ⏭  ${user.username} — already exists, skipped`)
        skipped++
        continue
      }

      await assignRole(token, result.userId, user.role)
      console.log(`  ✅  ${user.username} (${user.email}) — role: ${user.role}`)
      created++

    } catch (err) {
      console.error(`  ❌  ${user.username} — ${err.message}`)
      failed++
    }
  }

  console.log('\n─────────────────────────────────────')
  console.log(`✅  Created : ${created}`)
  console.log(`⏭  Skipped : ${skipped}`)
  console.log(`❌  Failed  : ${failed}`)
  console.log('─────────────────────────────────────')
  console.log('\n📋  Sample credentials:')
  console.log(`  Username: ${users[0].username}  Password: ${users[0].password}`)
  console.log(`  Username: ${users[1].username}  Password: ${users[1].password}`)
  console.log('\nDone. Now run: node scripts/migrate-to-auth0.js')
}

main().catch((err) => { console.error(err); process.exit(1) })
