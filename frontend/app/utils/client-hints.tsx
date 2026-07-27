/**
 * Configures client hints used to detect and server-render the user's timezone.
 *
 * @see https://sergiodxa.com/tutorials/use-client-hints-for-server-side-timezone-rendering
 */
import { getHintUtils } from '@epic-web/client-hints';
import { clientHint as timeZoneHint } from '@epic-web/client-hints/time-zone';

import { getClientEnv } from '~/utils/env-utils';

function getClientHintUtils() {
  const { TIME_ZONE } = getClientEnv();

  return getHintUtils({ timeZone: { ...timeZoneHint, fallback: TIME_ZONE } });
}

/**
 * Reads client hints from the current request or browser cookie.
 *
 * @returns Detected client hints, including the user's timezone.
 */
export function getHints(request?: Request) {
  return getClientHintUtils().getHints(request);
}

/**
 * Renders the inline script that detects client hints before hydration.
 *
 * @param nonce Content Security Policy nonce for the inline script.
 * @returns Inline client-hint check script.
 */
export function ClientHintCheck({ nonce }: { nonce: string }) {
  return (
    <script
      nonce={nonce}
      // The package generates this static client-hint check script.
      // eslint-disable-next-line @eslint-react/dom-no-dangerously-set-innerhtml
      dangerouslySetInnerHTML={{ __html: getClientHintUtils().getClientHintCheckScript() }}
    />
  );
}
