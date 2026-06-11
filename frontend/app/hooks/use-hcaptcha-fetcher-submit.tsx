import type { RefObject } from 'react';

import type { useFetcher } from 'react-router';

import type HCaptcha from '@hcaptcha/react-hcaptcha';

import type { UseSafeFetcherSubmitOptions, UseSafeFetcherSubmitResult } from '~/hooks';
import { useHCaptcha } from '~/hooks';
import { useSafeFetcherSubmit } from '~/hooks/use-safe-fetcher-submit';
import { useFeature } from '~/root';

export type UseHCaptchaFetcherSubmitResult = Readonly<
  UseSafeFetcherSubmitResult & {
    /**
     * A React Ref object that must be passed directly into your `<HCaptcha />` component's `ref` property.
     */
    hCaptchaRef: RefObject<HCaptcha | null>;

    /**
     * A boolean representing the current state of the 'hcaptcha' feature flag.
     * Use this to conditionally render the captcha element in your view layer.
     */
    hCaptchaEnabled: boolean;

    /**
     * A callback handler passed straight to the `<HCaptcha />` component's `onLoad` property.
     */
    hCaptchaOnLoad: () => void;

    /**
     * The configured public application sitekey string required by the `<HCaptcha />` component's `sitekey` property.
     */
    hCaptchaSitekey: string;
  }
>;

/**
 * A dedicated wrapper hook that binds form submission events with your application's underlying
 * hCaptcha verification pipeline.
 *
 * When the 'hcaptcha' feature flag is active, this hook intercepts form submission, opens the
 * verification puzzle modal, and blocks further interactions. Once resolved, it automatically appends
 * the verification token to the payload under the key `'h-captcha-response'` before safely passing
 * execution to any custom secondary `onSubmit` callbacks or routing layers.
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
      // Create a new FormData instance to safely manipulate the submission payload.
      const newData = new FormData();
      for (const [key, value] of data.entries()) {
        newData.append(key, value);
      }

      if (hCaptchaEnabled && captchaRef.current) {
        // Attempt to execute the hCaptcha verification flow and retrieve a response token.
        try {
          const { response } = await captchaRef.current.execute({ async: true });
          newData.set('h-captcha-response', response);
        } catch {
          /* intentionally ignore and proceed with submission */
        } finally {
          captchaRef.current.resetCaptcha();
        }
      }

      // If no additional onSubmit callback is provided, return our compiled FormData
      // object immediately, ensuring a safe fallback path for simple forms.
      if (!onSubmit) {
        return newData;
      }

      // Allow the caller to modify the FormData with the hCaptcha response token or perform other
      // asynchronous operations before submission.
      return await onSubmit({ event, data: newData });
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
