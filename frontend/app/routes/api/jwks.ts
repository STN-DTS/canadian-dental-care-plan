import { subtle } from 'node:crypto';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { generateCryptoKey, generateJwkId } from '~/.server/utils/crypto-utils';

import type { Route } from './+types/jwks';

/**
 * JsonWebKey with an additional `kid` (key id) property.
 */
interface JWK extends JsonWebKey {
  kid: string;
}

/**
 * Return a promise that resolves to an array of public JWKs. Startup
 * environment validation rejects a missing or empty public key.
 */
async function getJwks(serverConfig: Pick<ServerConfig, 'AUTH_JWT_PUBLIC_KEY'>) {
  const { AUTH_JWT_PUBLIC_KEY } = serverConfig;
  const jwk = await subtle.exportKey('jwk', await generateCryptoKey(AUTH_JWT_PUBLIC_KEY, 'encrypt'));
  const keyId = generateJwkId(jwk);

  return [{ ...jwk, kid: keyId } as JWK];
}

/**
 * A JSON endpoint that contains a list of the application's public keys that
 * can be used by an auth provider to verify private key JWTs.
 */
export async function loader({ context, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const { AUTH_JWT_PUBLIC_KEY } = appContainer.get(TYPES.ServerConfig);
  const keys = await getJwks({ AUTH_JWT_PUBLIC_KEY });
  const headers = { 'Content-Type': 'application/json' };

  return Response.json({ keys }, { headers: headers });
}
