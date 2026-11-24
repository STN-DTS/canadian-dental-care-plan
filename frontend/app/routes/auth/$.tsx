import { redirectDocument } from 'react-router';

import { ATTR_ERROR_TYPE, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
// Session attributes are currently incubating OpenTelemetry conventions.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import { Option } from 'effect';

import { AUDIT_EVENT_AUTH_SESSION_CREATED, AUDIT_EVENT_AUTH_SESSION_DESTROYED } from '~/.server/audit/audit-event-ids';
import type { AuthConnectivityVerifiedResult } from '~/.server/auth/auth-service';
import { TYPES } from '~/.server/constants';
/**
 * Handler for /auth/logout{?locale=(en|fr)} requests
 *
 */
import { appContext } from '~/.server/context/app-context';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_AUTH_MISSING_SESSION_FIELDS } from '~/.server/logging/log-attributes';
import type { IdToken } from '~/.server/utils/raoidc-utils';
import { generateCallbackUri } from '~/.server/utils/raoidc-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

import type { Route } from './+types/$';

const defaultReturnUrl = '/';

/**
 * Checks if a given return URL is safe to redirect to. A safe return URL is one that is a relative path (starts with a
 * single "/"), is not protocol-relative (does not start with "//"), and does not contain any backslashes, which could
 * indicate an attempt at an open redirect or other malicious behavior.
 *
 * @param returnUrl The URL to check.
 * @returns `true` if the URL is safe, `false` otherwise.
 */
function isSafeReturnUrl(returnUrl: string) {
  return (
    returnUrl.startsWith('/') && // Must start with a single slash to be considered a relative path
    !returnUrl.startsWith('//') && // Must not start with double slashes, which could indicate a protocol-relative URL
    !returnUrl.includes('\\') // Must not contain backslashes, which could be used in certain types of attacks
  );
}

/**
 * A do-all authentication handler for the application
 */
export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const log = createLogger('auth.$/loader');
  const { '*': slug } = params;
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  const { AUTH_PROVIDER } = appContainer.get(TYPES.ServerConfig);

  // Only the configured provider's routes are served, so there is no fallback between providers.
  switch (true) {
    case slug === 'login': {
      return handleLoginRequest({ context, url });
    }

    case slug === 'logout': {
      return await handleLogoutRequest({ context, url });
    }

    case slug === 'login/raoidc' && AUTH_PROVIDER === 'raoidc': {
      return await handleRaoidcLoginRequest({ context, url });
    }

    case slug === 'callback/raoidc' && AUTH_PROVIDER === 'raoidc': {
      return await handleRaoidcCallbackRequest({ context, url });
    }

    case slug === 'login/oidc' && AUTH_PROVIDER === 'oidc': {
      return await handleOidcLoginRequest({ context });
    }

    case slug === 'callback/oidc' && AUTH_PROVIDER === 'oidc': {
      return await handleOidcCallbackRequest({ context, url });
    }

    default: {
      log.debug('Unknown authentication route requested', { [ATTR_URL_PATH]: url.pathname, [ATTR_ERROR_TYPE]: 'unknown_authentication_route' });

      instrumentationService.createCounter('auth.unknown.requests').add(1);
      return Response.json(null, { status: 404 });
    }
  }
}

/**
 * Handler for /auth/login requests
 */
function handleLoginRequest({ context, url }: Pick<Route.LoaderArgs, 'context' | 'url'>) {
  const { appContainer } = context.get(appContext);
  const log = createLogger('auth.$/handleLoginRequest');
  log.debug('Handling login request');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('auth.login.requests').add(1);

  const { AUTH_PROVIDER } = appContainer.get(TYPES.ServerConfig);
  const loginUrl = new URL(`/auth/login/${AUTH_PROVIDER}`, url);
  loginUrl.search = url.search;

  log.debug('Redirecting to default authentication provider', { [ATTR_URL_PATH]: loginUrl.pathname });
  return redirectDocument(loginUrl.href);
}

async function handleLogoutRequest({ context, url }: Pick<Route.LoaderArgs, 'context' | 'url'>) {
  const { appContainer, session } = context.get(appContext);
  const log = createLogger('auth.$/handleLogoutRequest');
  log.debug('Handling RAOIDC logout request');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('auth.logout.requests').add(1);

  const { AUTH_RASCL_LOGOUT_URL } = appContainer.get(TYPES.ServerConfig);

  if (!session.has('idToken')) {
    log.debug('User has not authenticated; bypassing RAOIDC logout and redirecting to RASCL logout');
    instrumentationService.createCounter('auth.logout.requests.unauthenticated').add(1);
    throw redirectDocument(AUTH_RASCL_LOGOUT_URL);
  }

  const idToken: IdToken = session.get('idToken');
  const detectedLocale = url.searchParams.get('locale');
  const locale: AppLocale = detectedLocale === 'fr' ? 'fr' : 'en';

  const raoidcService = appContainer.get(TYPES.RaoidcService);
  const signoutUrl = raoidcService.generateSignoutRequest({ sessionId: idToken.sid, locale });

  log.debug('Destroying application session before provider logout', { [ATTR_SESSION_ID]: session.id });
  const auditService = appContainer.get(TYPES.AuditService);
  auditService.createAudit(AUDIT_EVENT_AUTH_SESSION_DESTROYED, { userId: idToken.sub });

  await session.destroy();
  return redirectDocument(signoutUrl);
}

/**
 * Handler for /auth/login/raoidc requests
 */
async function handleRaoidcLoginRequest({ context, url }: Pick<Route.LoaderArgs, 'context' | 'url'>) {
  const { appContainer, session } = context.get(appContext);
  const log = createLogger('auth.$/handleRaoidcLoginRequest');
  log.debug('Handling RAOIDC login request');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('auth.login.raoidc.requests').add(1);

  const { origin, searchParams } = url;
  const returnUrl = searchParams.get('returnto');

  if (returnUrl && !isSafeReturnUrl(returnUrl)) {
    log.debug('Invalid authentication return URL', { [ATTR_ERROR_TYPE]: 'invalid_authentication_return_url' });
    instrumentationService.createCounter('auth.login.raoidc.requests.invalid-return-url').add(1);

    return Response.json(null, { status: 400 });
  }

  const redirectUri = generateCallbackUri(origin, 'raoidc');

  const raoidcService = appContainer.get(TYPES.RaoidcService);
  const { authUrl, codeVerifier, state } = await raoidcService.generateSigninRequest(redirectUri);

  log.debug('Regenerate session to prevent fixation and wipe prior session data');
  await session.regenerate();

  log.debug('Storing [codeVerifier] and [state] in session for future validation');
  session.set('authCodeVerifier', codeVerifier);
  session.set('authReturnUrl', returnUrl ?? defaultReturnUrl);
  session.set('authState', state);

  log.debug('Redirecting to RAOIDC sign-in');
  return redirectDocument(authUrl.href);
}

/**
 * Handler for /auth/callback/raoidc requests
 */
async function handleRaoidcCallbackRequest({ context, url }: Pick<Route.LoaderArgs, 'context' | 'url'>) {
  const { appContainer, session } = context.get(appContext);
  const log = createLogger('auth.$/handleRaoidcCallbackRequest');
  log.debug('Handling RAOIDC callback request');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('auth.callback.raoidc.requests').add(1);

  const raoidcService = appContainer.get(TYPES.RaoidcService);
  const codeVerifier = session.find('authCodeVerifier');
  const rawReturnUrl = Option.getOrElse(session.find('authReturnUrl'), () => defaultReturnUrl);
  const returnUrl = isSafeReturnUrl(rawReturnUrl) ? rawReturnUrl : defaultReturnUrl;
  const state = session.find('authState');

  if (Option.isNone(codeVerifier) || Option.isNone(state)) {
    const missingSessionKeys: string[] = [];

    if (Option.isNone(codeVerifier)) {
      missingSessionKeys.push('authCodeVerifier');
    }

    if (Option.isNone(state)) {
      missingSessionKeys.push('authState');
    }

    const authLoginUrl = `/auth/login?${new URLSearchParams({ returnto: returnUrl })}`;
    log.debug('Authentication callback session data is missing; restarting login', {
      [ATTR_ERROR_TYPE]: 'authentication_callback_session_missing',
      [ATTR_SESSION_ID]: session.id,
      [ATTR_CDCP_AUTH_MISSING_SESSION_FIELDS]: missingSessionKeys,
    });
    instrumentationService.createCounter('auth.callback.raoidc.requests.stale-session').add(1);
    throw redirectDocument(authLoginUrl);
  }

  const redirectUri = generateCallbackUri(url.origin, 'raoidc');

  log.debug('Storing auth tokens and userinfo in session');
  const { idToken, userInfoToken } = await raoidcService.handleCallback({ requestUrl: url, codeVerifier: Option.getOrThrow(codeVerifier), expectedState: Option.getOrThrow(state), redirectUri });
  session.set('idToken', idToken);
  session.set('userInfoToken', userInfoToken);

  log.debug('RAOIDC login successful; redirecting to application');
  const auditService = appContainer.get(TYPES.AuditService);
  auditService.createAudit(AUDIT_EVENT_AUTH_SESSION_CREATED, { userId: idToken.sub });

  return redirectDocument(returnUrl);
}

/**
 * Handler for /auth/login/oidc requests (iSAMS OIDC connectivity proof)
 */
async function handleOidcLoginRequest({ context }: Pick<Route.LoaderArgs, 'context'>) {
  const { appContainer, session } = context.get(appContext);
  const log = createLogger('auth.$/handleOidcLoginRequest');
  log.debug('Handling OIDC login request');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('auth.login.oidc.requests').add(1);

  const authService = appContainer.get(TYPES.AuthService);
  const { authUrl, correlation } = await authService.generateSigninRequest();

  log.debug('Regenerate session to prevent fixation and wipe prior session data');
  await session.regenerate();
  session.set('oidcAuthCorrelation', correlation);

  log.debug('Redirecting to OIDC sign-in');
  return redirectDocument(authUrl.href);
}

/**
 * Handler for /auth/callback/oidc requests (iSAMS OIDC connectivity proof)
 *
 * Reports verified connectivity only. It never stores tokens or claims, so it cannot create an authenticated CDCP
 * session or grant access to protected routes.
 */
async function handleOidcCallbackRequest({ context, url }: Pick<Route.LoaderArgs, 'context' | 'url'>) {
  const { appContainer, session } = context.get(appContext);
  const log = createLogger('auth.$/handleOidcCallbackRequest');
  log.debug('Handling OIDC callback request');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('auth.callback.oidc.requests').add(1);

  // Single use: removed before validation so a replayed or failed callback cannot reuse it.
  const correlation = session.find('oidcAuthCorrelation');
  session.unset('oidcAuthCorrelation');

  if (Option.isNone(correlation)) {
    log.debug('OIDC callback has no sign-in attempt in session', { [ATTR_ERROR_TYPE]: 'authentication_callback_session_missing', [ATTR_SESSION_ID]: session.id });
    instrumentationService.createCounter('auth.callback.oidc.requests.stale-session').add(1);
    throw new AppError('OIDC callback has no matching sign-in attempt.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID, { httpStatusCode: HttpStatusCodes.BAD_REQUEST });
  }

  const authService = appContainer.get(TYPES.AuthService);
  // Typed as the connectivity result so this route fails to compile if the callback can ever return a signed-in user.
  const result: AuthConnectivityVerifiedResult = await authService.handleCallback({ callbackUrl: url, correlation: correlation.value });

  instrumentationService.createCounter('auth.callback.oidc.requests.connectivity-verified').add(1);
  return Response.json({ outcome: result.outcome, authenticated: result.authenticated, issuer: result.issuer, verifiedAt: Temporal.Now.instant().toString() }, { headers: { 'Cache-Control': 'no-store' } });
}
