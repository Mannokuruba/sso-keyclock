/**
 * auth0-custom-db-login.js
 *
 * Paste this into Auth0 Dashboard:
 *   Connections → Database → your connection → Custom Database → Login script
 *
 * How it works:
 *   1. Auth0 calls this when a user logs in and is NOT yet in Auth0's own DB
 *   2. Script calls Keycloak ROPC endpoint to verify the password
 *   3. If valid → returns user profile → Auth0 stores the user (password migrated)
 *   4. Next login → Auth0 handles it directly, this script is never called again
 *
 * Keycloak requirement:
 *   "Direct Access Grants" must be ENABLED on the insurance-portal client
 *   during the migration window. Disable it when migration is complete.
 */

function login(email, password, callback) {
  var axios = require('axios@0.19.2');  // Auth0 Custom DB supports axios

  var KEYCLOAK_URL   = configuration.KEYCLOAK_URL;    // set in Auth0 Connection settings
  var KEYCLOAK_REALM = configuration.KEYCLOAK_REALM;  // "insurance"
  var CLIENT_ID      = configuration.KEYCLOAK_CLIENT_ID; // "insurance-portal"

  var tokenUrl = KEYCLOAK_URL + '/realms/' + KEYCLOAK_REALM + '/protocol/openid-connect/token';

  // Step 1: Verify credentials against Keycloak ROPC endpoint
  axios.post(tokenUrl, new URLSearchParams({
    grant_type: 'password',
    client_id:  CLIENT_ID,
    username:   email,
    password:   password,
    scope:      'openid profile email',
  }).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  })
  .then(function(tokenRes) {
    var idToken = tokenRes.data.id_token;

    // Step 2: Decode JWT payload (no signature verification needed — came from our Keycloak)
    var payload = JSON.parse(
      Buffer.from(idToken.split('.')[1], 'base64').toString('utf8')
    );

    // Step 3: Return Auth0 user profile — Auth0 stores this and migrates the password
    return callback(null, {
      user_id:        payload.sub,
      email:          payload.email,
      email_verified: payload.email_verified || false,
      name:           payload.name           || payload.preferred_username,
      given_name:     payload.given_name     || '',
      family_name:    payload.family_name    || '',
      nickname:       payload.preferred_username,
      app_metadata: {
        keycloak_id:      payload.sub,
        keycloak_realm:   KEYCLOAK_REALM,
        roles:            (payload.realm_access && payload.realm_access.roles) || [],
        policy_number:    (payload.policy_number) || null,
        migration_status: 'complete',  // password is now in Auth0
      },
    });
  })
  .catch(function(err) {
    // 401 = wrong password, 400 = user not found — both are "wrong credentials"
    if (err.response && (err.response.status === 401 || err.response.status === 400)) {
      return callback(new WrongUsernameOrPasswordError(email));
    }
    // Any other error (Keycloak down etc.) — fail gracefully
    return callback(new Error('Migration login failed: ' + (err.message || 'unknown error')));
  });
}
