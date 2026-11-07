import { redirectDocument } from 'react-router';

import { ATTR_ERROR_TYPE, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
// Session attributes are currently incubating OpenTelemetry conventions.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import { Option } from 'effect';

import { TYPES } from '~/.server/constants';
/**
 * Handler for /auth/logout{?locale=(en|fr)} requests
 *
 */
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_AUTH_MISSING_SESSION_FIELDS } from '~/.server/logging/log-attributes';
import type { IdToken } from '~/.server/utils/raoidc-utils';
import { generateCallbackUri } from '~/.server/utils/raoidc-utils';

import type { Route } from './+types/$';

const defaultProviderId = 'raoidc';
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

  switch (slug) {
    case 'login': {
      return handleLoginRequest({ context, url });
    }

    case 'logout': {
      return await handleLogoutRequest({ context, url });
    }

    case 'login/raoidc': {
      return await handleRaoidcLoginRequest({ context, url });
    }

    case 'callback/raoidc': {
      return await handleRaoidcCallbackRequest({ context, url });
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

  const loginUrl = new URL(`/auth/login/${defaultProviderId}`, url);
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
  auditService.createAudit('auth.session-destroyed', { userId: idToken.sub });

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
  auditService.createAudit('auth.session-created', { userId: idToken.sub });

  return redirectDocument(returnUrl);
}
