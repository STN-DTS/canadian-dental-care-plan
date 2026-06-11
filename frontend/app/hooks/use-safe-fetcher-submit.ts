import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { FetcherSubmitOptions, useFetcher } from 'react-router';

import { useFetcherSubmissionState } from '~/hooks/use-fetcher-submission-state';

/**
 * A read-only snapshot type of the FormData object at the time of submission.
 * Mutating methods (`append`, `set`, `delete`) are strictly stripped out at the type level.
 */
type UseSafeFetcherSubmitFormData = OmitStrict<FormData, 'append' | 'set' | 'delete'>;

type UseSafeFetcherSubmit_OnSubmitArgs = {
  /**
   * The original synthetic submit event from the HTML form.
   * Note: Default submission behavior and event propagation are already prevented by this hook.
   */
  event: React.SyntheticEvent<HTMLFormElement>;

  /**
   * A read-only snapshot type of the form data when the submission event occurred.
   *
   * Note: This is an underlying live reference to the original FormData object. To avoid side
   * effects, do not force mutations directly on this object. Instead, instantiate and return
   * a fresh FormData instance as shown in the example.
   *
   * @example
   * onSubmit: ({ data }) => {
   *   const modifiedData = new FormData(data as unknown as HTMLFormElement);
   *   modifiedData.set('secureToken', 'xyz123');
   *   return modifiedData;
   * }
   */
  data: UseSafeFetcherSubmitFormData;
};

export type UseSafeFetcherSubmitOptions = Readonly<
  FetcherSubmitOptions & {
    /**
     * An optional, potentially asynchronous callback triggered before the final routing submission occurs.
     * This is ideal for executing third-party validation scripts, requesting single-use tokens from payment gateways,
     * performing client-side file compression, or hashing sensitive user data before it leaves the browser.
     *
     * Return a new `FormData` object from this function to override the default form payload.
     */
    onSubmit?: (args: UseSafeFetcherSubmit_OnSubmitArgs) => FormData | undefined | Promise<FormData | undefined>;
  }
>;

export type UseSafeFetcherSubmitResult = Readonly<{
  /**
   * A form submit handler that should be attached directly to your `<form>` element's `onSubmit` attribute.
   * It handles instant double-click protection, intercepts asynchronous hooks, and executes the fetcher submission.
   *
   * @example
   * <form onSubmit={handleSubmit}>
   */
  handleSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;

  /**
   * A boolean indicating whether a submission flow is in progress.
   * Stays continuously `true` from the split-second the user clicks submit, through all asynchronous
   * `onSubmit` operations, until the execution thread exits the submission block.
   * Use this to disable buttons or trigger loading spinners.
   *
   * @example
   * <button type="submit" disabled={isSubmitting}>
   *   {isSubmitting ? 'Processing...' : 'Submit'}
   * </button>
   */
  isSubmitting: boolean;

  /**
   * The destination endpoint URL that the fetcher is currently routing its submission payload to.
   */
  submitAction?: string;
}>;

/**
 * A custom wrapper hook around React Router's fetcher submission layer.
 * Enforces strict double-submission protection and blocks concurrent submissions caused by rapid-fire physical clicks
 * or keyboard Enter key spamming. Provides an interceptor window (`onSubmit`) to modify payloads asynchronously
 * before they reach the server routing action.
 */
export function useSafeFetcherSubmit<TFetcher extends Pick<ReturnType<typeof useFetcher>, 'formData' | 'state' | 'submit'>>(fetcher: TFetcher, options?: UseSafeFetcherSubmitOptions): UseSafeFetcherSubmitResult {
  // A synchronous ref-based operational lock that is updated instantly inside the thread.
  // This acts as a hardware block against rapid-fire physical clicks or keyboard Enter smashing before React state cycles can batch.
  const isLockedRef = useRef(false);

  // Options are cached in a ref container to prevent recreating the handleSubmit callback identity
  // when parents pass inline literal configurations or un-memoized onSubmit functions.
  const optionsRef = useRef(options);

  useLayoutEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const { isSubmitting: isFetcherSubmitting, submitAction } = useFetcherSubmissionState(fetcher);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (event: React.SyntheticEvent<HTMLFormElement>) => {
      event.preventDefault();
      event.stopPropagation();

      // Guard instantly drops incoming rapid double-clicks, keyboard entries, or submissions while the router is busy
      if (isLockedRef.current || isFetcherSubmitting) {
        return;
      }

      isLockedRef.current = true;
      setIsLocalSubmitting(true);

      try {
        const baseFormData = new FormData(event.currentTarget);
        let finalFormData = baseFormData;

        const { onSubmit, method = 'POST', ...restOptions } = optionsRef.current ?? {};

        if (onSubmit) {
          // Execution safely awaits asynchronous tasks (like external API token generation or data hashing)
          const result = await onSubmit({ event, data: baseFormData });
          if (result instanceof FormData) {
            finalFormData = result;
          }
        }

        await fetcher.submit(finalFormData, { ...restOptions, method });
      } finally {
        // Safe, instantaneous, synchronous cleanup.
        // Runs completely whether the code succeeds or crashes, preventing deadlocks.
        isLockedRef.current = false;
        setIsLocalSubmitting(false);
      }
    },
    [fetcher, isFetcherSubmitting],
  );

  return {
    handleSubmit,
    isSubmitting: isLocalSubmitting || isFetcherSubmitting,
    submitAction,
  };
}
