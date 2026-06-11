import type { RefObject } from 'react';

import type { useFetcher } from 'react-router';

import type HCaptcha from '@hcaptcha/react-hcaptcha';

import { useFeature } from '~/hooks/use-feature';
import { useHCaptcha } from '~/hooks/use-hcaptcha';
import type { UseSafeFetcherSubmitOptions, UseSafeFetcherSubmitResult } from '~/hooks/use-safe-fetcher-submit';
import { useSafeFetcherSubmit } from '~/hooks/use-safe-fetcher-submit';

export type UseHCaptchaFetcherSubmitResult = Readonly<
  UseSafeFetcherSubmitResult & {
    /** The ref to pass to the `<HCaptcha />` component. */
    hCaptchaRef: RefObject<HCaptcha | null>;

    /** Whether the `hcaptcha` feature is enabled. */
    hCaptchaEnabled: boolean;

    /** The callback to pass to the `<HCaptcha />` component's `onLoad` property. */
    hCaptchaOnLoad: () => void;

    /** The configured public hCaptcha site key. */
    hCaptchaSitekey: string;
  }
>;

/**
 * Extends safe fetcher submission with optional hCaptcha verification.
 * When enabled and available, the verification token is added to the payload as
 * `h-captcha-response` before the optional `onSubmit` callback runs.
 *
 * @example
 * const {
 *   handleSubmit,
 *   isSubmitting,
 *   hCaptchaEnabled,
 *   hCaptchaRef,
 *   hCaptchaOnLoad,
 *   hCaptchaSitekey
 * } = useHCaptchaFetcherSubmit(fetcher);
 *
 * return (
 *   <form onSubmit={handleSubmit}>
 *     {hCaptchaEnabled && (
 *       <HCaptcha
 *         size="invisible"
 *         sitekey={hCaptchaSitekey}
 *         ref={hCaptchaRef}
 *         onLoad={hCaptchaOnLoad}
 *       />
 *     )}
 *     <button type="submit" disabled={isSubmitting}>Submit</button>
 *   </form>
 * );
 */
export function useHCaptchaFetcherSubmit<TFetcher extends Pick<ReturnType<typeof useFetcher>, 'formData' | 'state' | 'submit'>>(fetcher: TFetcher, options?: UseSafeFetcherSubmitOptions): UseHCaptchaFetcherSubmitResult {
  const hCaptchaEnabled = useFeature('hcaptcha');
  const { captchaRef, onLoad, sitekey } = useHCaptcha();

  const { onSubmit, ...restOptions } = options ?? {};

  const { isSubmitting, handleSubmit, submitAction } = useSafeFetcherSubmit(fetcher, {
    ...restOptions,
    onSubmit: async ({ event, data }) => {
      const newData = new FormData();
      for (const [key, value] of data.entries()) {
        newData.append(key, value);
      }

      const captcha = captchaRef.current;
      if (hCaptchaEnabled && captcha) {
        try {
          const { response } = await captcha.execute({ async: true });
          newData.set('h-captcha-response', response);
        } catch {
          /* intentionally ignore and proceed with submission */
        } finally {
          captcha.resetCaptcha();
        }
      }

      if (!onSubmit) {
        return newData;
      }

      const result = await onSubmit({ event, data: newData });
      return result ?? newData;
    },
  });

  return {
    handleSubmit,
    hCaptchaEnabled,
    hCaptchaOnLoad: onLoad,
    hCaptchaRef: captchaRef,
    hCaptchaSitekey: sitekey,
    isSubmitting,
    submitAction,
  };
}
