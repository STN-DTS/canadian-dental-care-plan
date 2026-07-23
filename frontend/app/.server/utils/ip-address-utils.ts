import { getEnv } from '~/.server/utils/env-utils';

/**
 * Attempts to retrieve the client's IP address from the "X-Forwarded-For" header of the HTTP request.
 *
 * If the "X-Forwarded-For" header exists, the first element of the comma-separated header is extracted.
 * This is because the header may contain a chain of IP addresses, representing intermediate proxies.
 *
 * In a development environment, this function will return "127.0.0.1" (localhost IP).
 *
 * @param request the incoming HTTP request object.
 * @returns the trimmed IP address or null if the "X-Forwarded-For" header is missing.
 */
export function getClientIpAddress(request: Pick<Request, 'headers'>): string | null {
  const { NODE_ENV } = getEnv();
  if (NODE_ENV === 'development') {
    return '127.0.0.1';
  }

  const xForwardedForHeader = request.headers.get('X-Forwarded-For');
  return xForwardedForHeader?.split(',', 1)[0]?.trim() ?? null;
}
