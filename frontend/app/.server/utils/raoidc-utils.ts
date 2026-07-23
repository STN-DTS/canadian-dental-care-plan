/**
 * Utility functions to help with RAOIDC requests.
 */
import { UTCDate } from '@date-fns/utc';
import { invariant } from '@dts-stn/invariant';
import type { JWK, JWTPayload, JWTVerifyResult } from 'jose';
import { SignJWT, compactDecrypt, decodeProtectedHeader, importJWK, jwtVerify } from 'jose';
import type { webcrypto } from 'node:crypto';
import { createHash, subtle } from 'node:crypto';
import { fetch } from 'undici';

import type { FetchFn } from '~/.server/http';
import { createLogger } from '~/.server/logging';

/**
 * An OIDC ID token.
 */
export interface IdToken extends Record<string, unknown> {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  nonce: string;
  sid: string;
  sub: string;
  //
  // optional
  //
  locale?: string;
}

/**
 * An OIDC userinfo token.
 */
export interface UserinfoToken extends Record<string, unknown> {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  jti: string;
  nbf: number;
  sub: string;
  //
  // optional
  //
  birthdate?: string;
  locale?: string;
  sin?: string;
  mocked?: boolean;
}

/**
 * The response returned from an the auth server's token endpoint.
 */
export interface TokenEndpointResponse extends Record<string, unknown> {
  access_token: string;
  id_token: string;
  //
  // optional
  //
  expires_at?: number;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  session_state?: string;
  token_type?: string;
}

/**
 * The response returned from an the auth server's userinfo endpoint.
 */
export interface UserinfoResponse extends Record<string, unknown> {
  userinfo_token: string;
}

/**
 * An OIDC client.
 */
export interface ClientMetadata {
  /**
   * The OIDC client ID.
   */
  clientId: string;
  /**
   * The application's private decryption key.
   * Used for decrypting the userinfo token payload.
   */
  privateDecryptionKey: webcrypto.CryptoKey;
  /**
   * The application's private signing key.
   * Used for client assertion signing during token exchange.
   */
  privateSigningKey: webcrypto.CryptoKey;
  /**
   * A unique identifier identifying the private RSA signing key of the client.
   */
  privateKeyId: string;
}

/**
 * An OIDC authentication server.
 * Returned by the OIDC server's discovery endpoint.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414#section-2
 */
export interface ServerMetadata extends Record<string, unknown> {
  authorization_endpoint: string;
  issuer: string;
  jwks_uri: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  //
  // optional fields
  //
  end_session_endpoint?: string;
  introspection_endpoint_auth_methods_supported?: Array<string>;
  introspection_endpoint_auth_signing_alg_values_supported?: Array<string>;
  mtls_endpoint_aliases?: {
    device_authorization_endpoint?: string;
    introspection_endpoint?: string;
    revocation_endpoint?: string;
    token_endpoint?: string;
    userinfo_endpoint?: string;
  };
  registration_endpoint?: string;
  request_object_signing_alg_values_supported?: Array<string>;
  revocation_endpoint_auth_methods_supported?: Array<string>;
  revocation_endpoint_auth_signing_alg_values_supported?: Array<string>;
  revocation_endpoint?: string;
  token_endpoint_auth_methods_supported?: Array<string>;
  token_endpoint_auth_signing_alg_values_supported?: Array<string>;
}

/**
 * JsonWebKey set.
 * Returned from the auth server's JWKS endpoint.
 */
export interface JWKSet {
  keys: Array<JWK & Record<string, unknown>>;
}

/**
 * Fetches an auth server's metadata via its well-known discovery URL.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc8414#section-3
 */
export async function fetchServerMetadata(authServerUrl: string, fetchFn?: FetchFn) {
  const log = createLogger('raoidc-utils/fetchServerMetadata');
  const discoveryUrl = authServerUrl + '/.well-known/openid-configuration';
  log.info('Fetching OIDC server metadata from [%s]', discoveryUrl);

  // prettier-ignore
  const discoveryResponse = fetchFn
    ? await fetchFn(discoveryUrl)
    : await fetch(discoveryUrl);

  if (discoveryResponse.status !== 200) {
    throw new Error('Error fetching server metadata: non-200 status');
  }

  const serverMetadata = (await discoveryResponse.json()) as ServerMetadata;
  validateServerMetadata(serverMetadata);
  log.trace('Server metadata response: [%j]', serverMetadata);

  const jwksUrl = serverMetadata.jwks_uri;
  log.info('Fetching OIDC server public keys from [%s]', jwksUrl);

  // prettier-ignore
  const jwksResponse = fetchFn
    ? await fetchFn(serverMetadata.jwks_uri)
    : await fetch(serverMetadata.jwks_uri);

  if (jwksResponse.status !== 200) {
    throw new Error('Error fetching server jwks: non-200 status');
  }

  const jwkSet = (await jwksResponse.json()) as JWKSet;
  validateJwkSet(jwkSet);
  log.trace('Server JWKS response: [%j]', jwkSet);

  return { jwkSet, serverMetadata };
}

/**
 * Generate an OIDC authorization request that is used to start the OIDC login process.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.1
 */
export function generateAuthorizationRequest(authorizationUri: string, clientId: string, codeChallenge: string, redirectUri: string, scope: string, state: string) {
  const log = createLogger('raoidc-utils/generateAuthorizationRequest');
  const codeChallengeMethod = 'S256';
  const nonce = generateRandomNonce();
  const responseType = 'code';

  const authorizationRequest = new URL(authorizationUri);
  authorizationRequest.searchParams.set('client_id', clientId);
  authorizationRequest.searchParams.set('code_challenge', codeChallenge);
  authorizationRequest.searchParams.set('code_challenge_method', codeChallengeMethod);
  authorizationRequest.searchParams.set('nonce', nonce);
  authorizationRequest.searchParams.set('redirect_uri', redirectUri);
  authorizationRequest.searchParams.set('response_type', responseType);
  authorizationRequest.searchParams.set('scope', scope);
  authorizationRequest.searchParams.set('state', state);

  log.debug('Generated authorization request: [%s]', authorizationRequest);
  return authorizationRequest;
}

/**
 * Exchange an OIDC authorization code for an access token and id token.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-4.1.3
 */
export async function fetchAccessToken(serverMetadata: ServerMetadata, serverJwks: JWKSet, authCode: string, client: ClientMetadata, codeVerifier: string, redirectUri: string, fetchFn?: FetchFn) {
  const log = createLogger('raoidc-utils/fetchAccessToken');
  log.debug('Exchanging authorization code for access/id tokens');

  const clientAssertion = await createClientAssertion(serverMetadata.issuer, client);
  const clientAssertionType = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';
  const grantType = 'authorization_code';

  const fetchOptions = {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: client.clientId,
      client_assertion_type: clientAssertionType,
      client_assertion: clientAssertion,
      code: authCode,
      code_verifier: codeVerifier,
      grant_type: grantType,
      redirect_uri: redirectUri,
    }).toString(),
  };

  // prettier-ignore
  const response = fetchFn
    ? await fetchFn(serverMetadata.token_endpoint, fetchOptions)
    : await fetch(serverMetadata.token_endpoint, fetchOptions);

  if (response.status !== 200) {
    throw new Error('Error fetching server metadata: non-200 status');
  }

  const tokenEndpointResponse = (await response.json()) as TokenEndpointResponse;
  validateAuthorizationToken(tokenEndpointResponse);

  const accessToken = tokenEndpointResponse.access_token;

  const decryptedIdToken = await decryptJwe(tokenEndpointResponse.id_token, client.privateDecryptionKey);
  const idTokenVerifyResult: JWTVerifyResult<IdToken> = await verifyJwt(decryptedIdToken, serverJwks);
  const idToken = idTokenVerifyResult.payload;

  return { accessToken, idToken };
}

/**
 * Fetch the current user's info from the auth server's userinfo endpoint.
 */
export async function fetchUserInfo(userinfoUri: string, serverJwks: JWKSet, accessToken: string, client: ClientMetadata, fetchFn?: FetchFn) {
  const log = createLogger('raoidc-utils/fetchUserInfo');
  log.debug('Fetching user info');

  const fetchOptions = {
    headers: {
      Accept: 'application/json, application/jwt',
      Authorization: `Bearer ${accessToken}`,
    },
  };

  // prettier-ignore
  const response = fetchFn
    ? await fetchFn(userinfoUri, fetchOptions)
    : await fetch(userinfoUri, fetchOptions);

  if (response.status !== 200) {
    throw new Error('Error fetching user info: non-200 status');
  }

  const userInfoResponse = (await response.json()) as UserinfoResponse;
  validateUserInfoTokenResponse(userInfoResponse);

  const decryptedUserinfoToken = await decryptJwe(userInfoResponse.userinfo_token, client.privateDecryptionKey);
  const userinfoTokenVerifyResult: JWTVerifyResult<UserinfoToken> = await verifyJwt(decryptedUserinfoToken, serverJwks);
  const userinfoToken = userinfoTokenVerifyResult.payload;

  return userinfoToken;
}

/**
 * Validate (and extend) an RAOIDC session.
 *
 * This function is used to detect whether or not a user has timed out, or
 * logged out in RAOIDC/ECAS protected space. A noteworthy side-effect of this
 * validation call is that the user's RAOIDC/ECAS session is extended for
 * another TTL (typically 20 minutes).
 */
export async function validateSession(authUrl: string, clientId: string, sessionId: string, fetchFn?: FetchFn) {
  const log = createLogger('raoidc-utils/validateSession');
  const validateUrl = new URL('validatesession', authUrl + '/');
  log.debug('Validating/extending session [%s] via [%s]', sessionId, validateUrl);

  validateUrl.searchParams.set('client_id', clientId);
  validateUrl.searchParams.set('shared_session_id', sessionId);

  // prettier-ignore
  const response = fetchFn
    ? await fetchFn(validateUrl)
    : await fetch(validateUrl);

  if (response.status !== 200) {
    throw new Error('Error validating session: non-200 status');
  }

  // RAOIDC will return simply 'true' or 'false'
  // to indicate if the session is valid
  const result = (await response.text()) === 'true';

  log.debug('Session [%s] is valid: [%s]', sessionId, result);
  return result;
}

/**
 * Creates an OIDC client assertion.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc7521
 */
async function createClientAssertion(issuer: string, client: ClientMetadata) {
  const log = createLogger('raoidc-utils/createClientAssertion');
  log.debug(`Creating client [%s] assertion for issuer [%s]`, client.clientId, issuer);

  const now = Math.floor(UTCDate.now() / 1000); // current time, rounded down to the nearest second
  const expiry = now + 60; // valid for 1 minute
  const jwtId = generateRandomString(32); // mitigate replay attacks

  const header = {
    alg: 'PS256',
    kid: client.privateKeyId,
  };

  const payload = {
    aud: issuer,
    exp: expiry,
    iat: now,
    iss: client.clientId,
    jti: jwtId,
    nbf: now,
    sub: client.clientId,
  };

  // prettier-ignore
  return await new SignJWT(payload)
    .setProtectedHeader(header)
    .sign(client.privateSigningKey);
}

/**
 * Decrypt a JWE token using the provided private key.
 */
async function decryptJwe(jwe: string, privateKey: webcrypto.CryptoKey) {
  const { kty, ...restOfJwk } = await subtle.exportKey('jwk', privateKey);
  invariant(kty, 'Expected JWK to have a key type');

  const key = await importJWK({ ...restOfJwk, kty }, 'RSA-OAEP-256');
  const decryptResult = await compactDecrypt(jwe, key);

  return Buffer.from(decryptResult.plaintext).toString();
}

/**
 * Creates the OIDC callback URL.
 *
 * @see https://datatracker.ietf.org/doc/html/rfc6749#section-3.1.2
 */
export function generateCallbackUri(baseUri: string, providerId: string) {
  return new URL(`/auth/callback/${providerId}`, baseUri).href;
}

/**
 * Generate an OIDC code challenge from the verifier string.
 *
 * @see https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#pkce-code-challenge-method
 */
export function generateCodeChallenge() {
  const codeVerifier = generateRandomCodeVerifier();
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeChallenge, codeVerifier };
}

/**
 * Generate a random OIDC code verifier.
 *
 * @see https://www.iana.org/assignments/oauth-parameters/oauth-parameters.xhtml#parameters
 */
export function generateRandomCodeVerifier(len = 64) {
  return generateRandomString(len);
}

/**
 * Generate a random nonce string.
 */
export function generateRandomNonce(len = 32) {
  return generateRandomString(len);
}

/**
 * Generate a random state state.
 */
export function generateRandomState(len = 32) {
  return generateRandomString(len);
}

/**
 * Generate a random string, duh.
 */
export function generateRandomString(length: number) {
  const allowedChars = '0123456789abcdefghijklmnopqrstuvwxyz';
  const toRandomChar = () => allowedChars[Math.floor(Math.random() * allowedChars.length)];
  return Array.from({ length }).map(toRandomChar).join('');
}

function validateAuthorizationToken(tokenEndpointResponse: TokenEndpointResponse) {
  const log = createLogger('raoidc-utils/validateAuthorizationToken');
  if (!tokenEndpointResponse.access_token) {
    throw new Error('Authorization token is missing access_token claim');
  }

  if (!tokenEndpointResponse.id_token) {
    throw new Error('Authorization token is missing id_token claim');
  }

  log.debug('Authorization token successfully validated');
}

function validateUserInfoTokenResponse(userInfoResponse: UserinfoResponse) {
  const log = createLogger('raoidc-utils/validateUserInfoTokenResponse');
  if (!userInfoResponse.userinfo_token) {
    throw new Error('Userinfo token is missing userinfo_token claim');
  }

  log.debug('Userinfo token successfully validated');
}

/**
 * Throw if the JWK set is fubar.
 */
function validateJwkSet(jwkSet: JWKSet) {
  const log = createLogger('raoidc-utils/validateJwkSet');
  if (jwkSet.keys.length === 0) {
    throw new Error('JWK set has no keys');
  }

  log.info('JWK set has been successfilly validated');
}

/**
 * Throw if the server metadata is fubar.
 */
function validateServerMetadata(serverMetadata: ServerMetadata) {
  const log = createLogger('raoidc-utils/validateServerMetadata');
  log.debug('Validating server metadata');

  if (!serverMetadata.issuer) {
    throw new Error('Server metadata has no declared issuer');
  }

  if (!serverMetadata.authorization_endpoint) {
    throw new Error('Server metadata has no authorization endpoint');
  }

  if (!serverMetadata.token_endpoint) {
    throw new Error('Server metadata has no token endpoint');
  }

  if (!serverMetadata.userinfo_endpoint) {
    throw new Error('Server metadata has no userinfo endpoint');
  }

  if (!serverMetadata.jwks_uri) {
    throw new Error('Server metadata has no jwks endpoint');
  }

  log.info('Server metadata has been successfilly validated');
}

/**
 * Verify a JWT by checking it against a collection of JWKs.
 */
async function verifyJwt<Payload = JWTPayload>(jwt: string, jwks: JWKSet) {
  const log = createLogger('raoidc-utils/verifyJwt');

  const { alg, kid } = decodeProtectedHeader(jwt);
  const key = jwks.keys.find((jwk) => jwk.kid === kid);

  if (!key) {
    log.error('JWT verification failure; no matching JWK with kid=%s could be found', kid);
    throw new Error('No matching JWK was found to verify JWT');
  }

  const jwk = await importJWK(key, alg);
  return await jwtVerify<Payload>(jwt, jwk);
}
