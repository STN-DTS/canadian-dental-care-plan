import type { Redacted } from 'effect';

/** Credentials and scope for an OAuth client credentials grant. */
export interface GetAccessTokenRequest {
  /** HTTPS issuer URL used for discovery, not the discovery endpoint URL. */
  issuer: URL;
  /** Redacted client identifier registered with the issuer. */
  clientId: Redacted.Redacted<string>;
  /** Redacted client secret registered with the issuer. */
  clientSecret: Redacted.Redacted<string>;
  /** Scope or space-separated scopes requested from the issuer. */
  scope: string;
}

/** Retrieves access tokens for an application identity. */
export interface AppIdentityClient {
  /**
   * Retrieves a bearer access token using the client credentials grant.
   *
   * @param request - The issuer, client credentials, and requested scope.
   * @returns A redacted access token.
   * @throws {AppError} If the request is invalid or token acquisition fails.
   */
  getAccessToken(request: GetAccessTokenRequest): Promise<Redacted.Redacted<string>>;
}
