import { renderToPipeableStream } from 'react-dom/server';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';

import { createReadableStreamFromReadable } from '@react-router/node';
import type { ActionFunctionArgs, EntryContext, LoaderFunctionArgs, RouterContextProvider } from 'react-router';
import { ServerRouter } from 'react-router';

import { isbot } from 'isbot';
import { PassThrough } from 'node:stream';
import { I18nextProvider } from 'react-i18next';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import { createOtelInstrumentation } from '~/.server/observability/otel-instrumentation';
import { createRequestCounterInstrumentation } from '~/.server/observability/request-counter-instrumentation';
import { generateContentSecurityPolicy } from '~/.server/utils/csp.utils';
import { getLocale, initI18n } from '~/.server/utils/locale.utils';
import { NonceProvider } from '~/components/nonce-context';
import { getNamespaces } from '~/utils/locale-utils';
import { randomHexString } from '~/utils/string-utils';

/**
 * Counts requests handled through React Router's data request path, including
 * client-side navigation requests.
 */
export function handleDataRequest(response: Response, { request, params, context }: LoaderFunctionArgs | ActionFunctionArgs) {
  const { appContainer } = context.get(appContext);
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('http.server.requests').add(1);
  return response;
}

/**
 * Logs React Router request errors using the application logger instead of
 * React Router's default console output.
 */
export function handleError(error: unknown, { context, request }: LoaderFunctionArgs | ActionFunctionArgs) {
  const { appContainer } = context.get(appContext);
  // Avoid logging aborted requests because React Router cancellation and
  // race-condition handling can abort requests during normal operation.
  const log = createLogger('entry.server/handleError');
  if (!request.signal.aborted) {
    if (error instanceof Error) {
      log.error(error);
    } else {
      log.error('Unexpected server error: [%j]', error);
    }

    const instrumentationService = appContainer.get(TYPES.InstrumentationService);
    instrumentationService.createCounter('http.server.requests.failed').add(1);
  }
}

export default async function handleRequest(request: Request, responseStatusCode: number, responseHeaders: Headers, routerContext: EntryContext, context: RouterContextProvider) {
  const { appContainer } = context.get(appContext);
  const log = createLogger('entry.server/handleRequest');
  const handlerFnName = isbot(request.headers.get('user-agent')) ? 'onAllReady' : 'onShellReady';
  log.debug(`Handling [${request.method}] request to [${request.url}] with handler function [${handlerFnName}]`);
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('http.server.requests').add(1);

  const locale = getLocale(new URL(request.url));
  const routes = Object.values(routerContext.routeModules);
  const i18n = await initI18n(locale, getNamespaces(routes));
  const nonce = randomHexString(32);

  return await new Promise((resolve, reject) => {
    const userAgent = request.headers.get('user-agent');

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode //
        ? 'onAllReady'
        : 'onShellReady';

    let shellRendered = false;

    const { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={i18n}>
        <NonceProvider nonce={nonce}>
          <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
        </NonceProvider>
      </I18nextProvider>,
      {
        [readyOption]() {
          shellRendered = true;

          // @see: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Content-Security-Policy', generateContentSecurityPolicy(nonce));

          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }));

          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          // eslint-disable-next-line no-param-reassign
          responseStatusCode = 500;

          // Log streaming rendering errors from inside the shell. Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            log.error('Error while rendering react element', error);
          }
        },
        nonce,
      },
    );

    // Abort the streaming render pass after 11 seconds
    // to allow the rejected boundaries to be flushed
    // see: https://reactrouter.com/explanation/special-files#streamtimeout
    setTimeout(abort, 10_000);
  });
}

export const instrumentations = [createOtelInstrumentation(), createRequestCounterInstrumentation()];
