import { injectable } from 'inversify';

/**
 * A strategy for resolving bearer tokens from requests.
 */
export interface BearerTokenResolver {
  resolve(request: Pick<Request, 'headers'>): string | undefined;
}

@injectable()
export class DefaultBearerTokenResolver implements BearerTokenResolver {
  readonly BEARER_TOKEN_HEADER_NAME = 'authorization';

  resolve(request: Pick<Request, 'headers'>): string | undefined {
    const authorization = request.headers.get(this.BEARER_TOKEN_HEADER_NAME) ?? '';
    const [scheme, token] = authorization.split(/\s+/, 2);
    if (scheme?.toLowerCase() === 'bearer') return token;
  }
}
