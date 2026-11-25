# Authentication

The Canadian Dental Care Plan (CDCP) application uses the RAOIDC service for
authentication, which implements the OpenID Connect authentication standard.

OpenID Connect (OIDC) is an extension of OAuth 2.0, a standard for delegating
authorization to access resources. OIDC enables clients to authenticate users
with an identity provider and obtain their basic profile information in a
standardized way. OIDC uses RESTful APIs and JSON data formats for
interoperability.

The RAOIDC service is owned by the Government of Canada's Enterprise Cyber
Authentication System (ECAS) team.

CDCP uses the _authorization code flow with proof key for code exchange (PKCE)_
OAuth flow to authenticate users.

To sign in to a local frontend with the real nonprod RAOIDC service, see
[Testing RAOIDC locally through the cluster Squid proxy](./raoidc-local-testing-with-squid-proxy.md).

## Authentication routes

The CDCP frontend provides the following routes/endpoints to handle the
authentication process:

- `/auth/login/{provider-id}`: initiates the login process
- `/auth/callback/{provider-id}`: handles the response from the RAOIDC service
- `/auth/logout{?locale=(en|fr)}`: initiates the logout process

## Login Process

The login process consists of three main steps:

1. CDCP initiates the login process by sending a GET request to
   `/auth/login/{provider-id}`, which redirects the user to the authorization
   endpoint RAOIDC. The authorization request includes the following parameters:
   - `response_type=code`: indicates that CDCP expects an _authorization code_ as the response
   - `client_id`: the unique identifier of CDCP registered with RAOIDC
   - `redirect_uri`: the CDCP URL where the user will be redirected after authorization
   - `scope`: the requested permissions, such as `openid`, `profile`, or `email`
   - `state`: a random string used to prevent CSRF attacks
   - `code_challenge`: a hashed and base64url-encoded version of a randomly generated string,
     called the `code_verifier`, which will be used later to verify the authorization code
   - `code_challenge_method`: the method used to generate the code challenge, such as `S256` for SHA-256

1. RAOIDC authenticates the user and (optionally) obtains their consent for the
   requested scope. If successful, RAOIDC redirects the user back to the
   `redirect_uri` with the following parameters:
   - `code`: the authorization code that can be exchanged for an access token and an ID token
   - `state`: the same value that was sent in the previous request, this is used to ensure
     that the response being handled is for the same authentication request

1. In `/auth/callback/{provider-id}`, CDCP verifies that the `state` parameter
   matches the one stored in the session, and sends a POST request to RAOIDC's
   token endpoint to exchange the authorization code for a token response. The
   token exchange request includes the following parameters:
   - `grant_type=authorization_code`: indicates that CDCP is using the authorization code grant type
   - `client_id`: the same value that was sent in the first request
   - `code`: the authorization code received in the previous step
   - `redirect_uri`: the same value that was sent in the first request
   - `code_verifier`: the original random string that was used to generate the code challenge in the first request

   During the token exchange, RAOIDC verifies that the `code_verifier` matches
   the `code_challenge` that was sent in the first request, and returns a token
   response that contains the following:
   - `access_token`: a JSON Web Token (JWT) that can be used to access protected
     resources, such as the userinfo endpoint. The access token is encrypted by
     RAOIDC and **cannot** be decrypted by CDCP.
   - `id_token`: a JWT that contains information about the user's identity, such
     as their name, email, or sub (subject) identifier. The ID token is encrypted
     by RAOIDC using CDCP's public RSA keys, and **can** be decrypted by CDCP.
   - `token_type`: the type of the token, usually `Bearer`
   - `expires_in`: the number of seconds until the access token expires

   The `/auth/callback/{provider-id}` endpoint decrypts the ID token using
   CDCP's private RSA key, and stores it in the session along with the encrypted
   access token. It also calls RAOIDC's userinfo endpoint with the access token
   as the authorization header, and receives a JSON object that contains
   additional information about the user, such as their date of birth or social
   insurance number.

   After fetching the user info, the `/auth/callback/{provider-id}` route
   redirects the user to the home page of CDCP.

## JWE Decryption

RAOIDC encrypts tokens using JSON Web Encryption (JWE), which is a standard for
securing the content of JWTs. JWEs consist of five parts, separated by dots:

- `header`: a base64url-encoded JSON object that contains information about the
  encryption algorithm and the key
- `encrypted_key`: a base64url-encoded encrypted version of the symmetric key
  used to encrypt the payload
- `iv`: a base64url-encoded initialization vector used for the encryption
- `ciphertext`: a base64url-encoded encrypted version of the payload, which is
  the JWT
- `tag`: a base64url-encoded authentication tag that verifies the integrity of
  the ciphertext

CDCP uses the Jose library to handle JWE decryption.
