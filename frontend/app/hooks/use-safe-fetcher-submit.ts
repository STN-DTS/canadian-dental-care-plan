import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import type { FetcherSubmitOptions, FormEncType, HTMLFormMethod, useFetcher } from 'react-router';

import { useFetcherSubmissionState } from '~/hooks/use-fetcher-submission-state';

/**
 * A type-level read-only view of the captured form data.
 * Common mutating methods (`append`, `set`, and `delete`) are omitted.
 */
type UseSafeFetcherSubmitFormData = OmitStrict<FormData, 'append' | 'set' | 'delete'>;

type UseSafeFetcherSubmit_OnSubmitArgs = {
  /**
   * The original synthetic submit event from the HTML form.
   * Default submission behavior and event propagation have already been prevented.
   * Use `data` for submitted values instead of reading `event.currentTarget` after asynchronous work.
   */
  event: React.SyntheticEvent<HTMLFormElement>;

  /**
   * A snapshot of the form data captured when submission begins, exposed through a read-only type.
   *
   * The runtime `FormData` object remains mutable. To avoid side effects, create and return a new
   * `FormData` instance when changing the payload.
   *
   * @example
   * onSubmit: ({ data }) => {
   *   const modifiedData = new FormData();
   *   for (const [key, value] of data.entries()) {
   *     modifiedData.append(key, value);
   *   }
   *   modifiedData.set('secureToken', 'xyz123');
   *   return modifiedData;
   * }
   */
  data: UseSafeFetcherSubmitFormData;
};

export type UseSafeFetcherSubmitOptions = Readonly<
  FetcherSubmitOptions & {
    /**
     * An optional synchronous or asynchronous callback run before the fetcher submission.
     *
     * Return a new `FormData` object from this function to override the default form payload.
     * Explicit fetcher options override submitter attributes, which override form attributes.
     */
    onSubmit?: (args: UseSafeFetcherSubmit_OnSubmitArgs) => FormData | undefined | Promise<FormData | undefined>;
  }
>;

export type UseSafeFetcherSubmitResult = Readonly<{
  /**
   * A form submit handler that should be attached directly to your `<form>` element's `onSubmit` attribute.
   * It prevents overlapping submissions through this hook instance, runs `onSubmit`, and submits through the fetcher.
   *
   * @example
   * <form onSubmit={handleSubmit}>
   */
  handleSubmit: (event: React.SyntheticEvent<HTMLFormElement>) => Promise<void>;

  /**
   * A boolean indicating whether a submission flow is in progress.
   * It is `true` while local preparation is running or while the fetcher is not idle.
   * Use this to disable buttons or trigger loading spinners.
   *
   * @example
   * <button type="submit" disabled={isSubmitting}>
   *   {isSubmitting ? 'Processing...' : 'Submit'}
   * </button>
   */
  isSubmitting: boolean;

  /**
   * The string value of the fetcher's `_action` form-data field, when present.
   */
  submitAction?: string;
}>;

/**
 * A custom wrapper hook around React Router's fetcher submission layer.
 * Prevents overlapping submissions through the same hook instance and provides an optional `onSubmit`
 * callback for preparing or replacing the payload. Native form submission options are preserved unless
 * explicitly overridden.
 */
export function useSafeFetcherSubmit<TFetcher extends Pick<ReturnType<typeof useFetcher>, 'formData' | 'state' | 'submit'>>(fetcher: TFetcher, options?: UseSafeFetcherSubmitOptions): UseSafeFetcherSubmitResult {
  const isLockedRef = useRef(false);
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

      if (isLockedRef.current || isFetcherSubmitting) {
        return;
      }

      isLockedRef.current = true;
      setIsLocalSubmitting(true);

      try {
        let formData = new FormData(event.currentTarget);
        const nativeOptions = resolveNativeSubmitOptions(event);
        const { action: configuredAction, encType: configuredEncType, method: configuredMethod, onSubmit, ...restOptions } = optionsRef.current ?? {};
        const action = configuredAction ?? nativeOptions.action;
        const encType = configuredEncType ?? nativeOptions.encType;
        const method = configuredMethod ?? nativeOptions.method;

        if (onSubmit) {
          const result = await onSubmit({ event, data: formData });
          if (result instanceof FormData) {
            formData = result;
          }
        }

        await fetcher.submit(formData, { ...restOptions, ...(action === undefined ? {} : { action }), encType, method });
      } finally {
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

/**
 * Reads an element attribute and normalizes missing or empty values to undefined.
 * This lets native submitter, form, and default values participate in nullish fallback chains.
 */
function getNonEmptyAttribute<TReturn extends string = string>(element: Element | undefined, name: string): TReturn | undefined {
  const value = element?.getAttribute(name);
  return !value ? undefined : (value as TReturn);
}

type NativeSubmitOptions = {
  /**
   * The submitter or form action. When omitted, React Router uses the current route.
   */
  action?: string;
  /**
   * The submitter or form encoding, defaulting to `application/x-www-form-urlencoded`.
   */
  encType: FormEncType;
  /**
   * The submitter or form method, defaulting to `GET`.
   */
  method: HTMLFormMethod;
};

/**
 * Resolves native submitter and form attributes from a submit event using browser submission precedence.
 * Submitter overrides form values, with React Router-compatible defaults for missing values.
 */
function resolveNativeSubmitOptions(event: React.SyntheticEvent<HTMLFormElement>): NativeSubmitOptions {
  const form = event.currentTarget;
  const submitter = (event.nativeEvent as SubmitEvent).submitter;
  const submitterElement = submitter instanceof HTMLElement ? submitter : undefined;

  const action = getNonEmptyAttribute(submitterElement, 'formaction') ?? getNonEmptyAttribute(form, 'action');
  const encType: FormEncType = getNonEmptyAttribute(submitterElement, 'formenctype') ?? getNonEmptyAttribute(form, 'enctype') ?? 'application/x-www-form-urlencoded';
  const method: HTMLFormMethod = getNonEmptyAttribute(submitterElement, 'formmethod') ?? getNonEmptyAttribute(form, 'method') ?? 'GET';

  return { action, encType, method };
}
