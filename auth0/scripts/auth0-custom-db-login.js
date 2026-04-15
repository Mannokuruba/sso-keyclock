/**
 * auth0-custom-db-login.js
 *
 * Auth0 Custom Database — Login script
 * Signature: login(email, password, context, callback)
 * NOTE: enable_script_context is ON — context is the 3rd param, callback is 4th.
 */

function login(email, password, context, callback) {
  var request = require('request');

  var KEYCLOAK_URL   = configuration.KEYCLOAK_URL;
  var KEYCLOAK_REALM = configuration.KEYCLOAK_REALM;
  var CLIENT_ID      = configuration.KEYCLOAK_CLIENT_ID;

  var tokenUrl = KEYCLOAK_URL + '/realms/' + KEYCLOAK_REALM + '/protocol/openid-connect/token';

  request.post({
    url: tokenUrl,
    form: {
      grant_type: 'password',
      client_id:  CLIENT_ID,
      username:   email,
      password:   password,
      scope:      'openid profile email'
    }
  }, function(err, response, body) {
    if (err) {
      return callback(new Error('Keycloak unreachable: ' + err.message));
    }

    var data;
    try {
      data = JSON.parse(body);
    } catch(e) {
      return callback(new Error('Invalid response from Keycloak'));
    }

    if (response.statusCode === 401 || response.statusCode === 400) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    if (!data.id_token) {
      return callback(new WrongUsernameOrPasswordError(email));
    }

    var parts   = data.id_token.split('.');
    var payload = JSON.parse(new Buffer(parts[1], 'base64').toString('utf8'));

    return callback(null, {
      user_id:        payload.sub,
      email:          payload.email,
      email_verified: payload.email_verified || false,
      name:           payload.name || payload.preferred_username,
      given_name:     payload.given_name  || '',
      family_name:    payload.family_name || '',
      nickname:       payload.preferred_username,
      app_metadata: {
        keycloak_id:      payload.sub,
        keycloak_realm:   KEYCLOAK_REALM,
        roles:            (payload.realm_access && payload.realm_access.roles) || [],
        policy_number:    payload.policy_number || null,
        migration_status: 'complete'
      }
    });
  });
}
