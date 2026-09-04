import { useCallback, useRef } from 'react';

import type HCaptcha from '@hcaptcha/react-hcaptcha';

import { useClientEnv } from '~/hooks/use-client-env';

/**
 * Provides the hCaptcha site key, component ref, and callback used to execute the challenge after loading.
 *
 * @returns Values needed to configure and execute an hCaptcha component.
 */
export function useHCaptcha() {
  const { HCAPTCHA_SITE_KEY: sitekey } = useClientEnv();
  const captchaRef = useRef<HCaptcha>(null);

  const onLoad = useCallback(() => {
    captchaRef.current?.execute();
  }, []);

  return { captchaRef, onLoad, sitekey };
}
