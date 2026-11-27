import type { AuthProviderConfig } from '~/.server/auth/auth-provider-config-schema';

/**
 * Interactive sign-in provider selected by `AUTH_PROVIDER`.
 *
 * RAOIDC still uses `RaoidcService` directly; this contract currently covers the iSAMS OIDC connectivity proof only.
 */
export type AuthProviderId = AuthProviderConfig['AUTH_PROVIDER'];

/**
 * Values for one sign-in attempt. Keep them server-side (in the session) and discard them at the callback.
 */
export interface AuthCorrelation {
  readonly state: string;
  readonly nonce: string;
  readonly codeVerifier: string;
}

export interface AuthSigninRequest {
  /** Provider authorization URL to redirect the browser to. */
  readonly authUrl: URL;
  readonly correlation: AuthCorrelation;
}

export interface HandleAuthCallbackArgs {
  /** The callback request URL, including the provider's query parameters. */
  readonly callbackUrl: URL;
  /** The correlation values saved when the sign-in request was generated. */
  readonly correlation: AuthCorrelation;
}

/**
 * The provider completed a verified code exchange, but no CDCP user was authenticated. It carries no tokens, subject
 * or claims, and `authenticated: false` keeps it from being treated as a signed-in user.
 */
export interface AuthConnectivityVerifiedResult {
  readonly outcome: 'connectivity-verified';
  readonly authenticated: false;
  /** The discovered issuer identifier. */
  readonly issuer: string;
}

/** Result of a provider callback. Full sign-in results are added by follow-up work (8845). */
export type AuthCallbackResult = AuthConnectivityVerifiedResult;

export interface AuthService {
  readonly provider: AuthProviderId;

  /**
   * Creates a sign-in request with fresh state, nonce and PKCE verifier.
   */
  generateSigninRequest(): Promise<AuthSigninRequest>;

  /**
   * Validates the callback and completes the code exchange.
   *
   * @throws An application error when the callback, token exchange or ID token is invalid.
   */
  handleCallback(args: HandleAuthCallbackArgs): Promise<AuthCallbackResult>;
}
