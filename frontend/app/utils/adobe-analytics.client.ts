import { getClientEnv } from '~/utils/env-utils';
import { isURL } from '~/utils/string-utils';

/** The shape of the `window.adobeDataLayer` object injected by the Adobe Analytics script. */
type AdobeDataLayer = { push?: (object: Record<string, string | Record<string, string>>) => void };

declare global {
  interface Window {
    adobeDataLayer?: AdobeDataLayer;
  }
}

/**
 * Returns `true` when both Adobe Analytics environment variables are set to valid URLs.
 * Safe to call regardless of environment — returns `false` instead of throwing when variables are absent.
 */
export function isConfigured() {
  const env = getClientEnv();
  return isURL(env.ADOBE_ANALYTICS_JQUERY_SRC) && isURL(env.ADOBE_ANALYTICS_SRC ?? '');
}

/**
 * Executes `callback` with the `adobeDataLayer` instance if Adobe Analytics is configured and
 * `window.adobeDataLayer` has been initialised by the analytics script. Logs a warning and
 * returns early in either failure case without throwing.
 */
export function withAdobeAnalytics(callback: (adobeDataLayer: AdobeDataLayer) => void) {
  if (!isConfigured()) {
    console.warn('Adobe Analytics is not configured. Please check your environment variables.');
    return;
  }

  if (!window.adobeDataLayer) {
    console.warn('window.adobeDataLayer is not defined. This could mean your adobe analytics script has not loaded on the page yet.');
    return;
  }

  try {
    callback(window.adobeDataLayer);
  } catch (error) {
    console.warn('An error occurred while pushing an event to Adobe Analytics:', error);
  }
}

/**
 * Pushes an `error` event for HTTP error pages (403, 404, 500).
 */
export function pushErrorEvent(errorStatusCode: 404 | 403 | 500) {
  withAdobeAnalytics((adobeDataLayer) => {
    adobeDataLayer.push?.({
      event: 'error',
      error: { name: `${errorStatusCode}` },
    });
  });
}

/**
 * Pushes a `pageLoad` event containing the host and pathname of `locationUrl`.
 */
export function pushPageviewEvent(locationUrl: string | URL) {
  withAdobeAnalytics((adobeDataLayer) => {
    const locationUrlObj = new URL(locationUrl);
    const url = `${locationUrlObj.host}${locationUrlObj.pathname}`;
    adobeDataLayer.push?.({
      event: 'pageLoad',
      page: { url },
    });
  });
}

/**
 * Pushes an `error` event for client-side form validation failures.
 * Field IDs are joined with `|` and prefixed with the application namespace.
 * The resulting error name is truncated to 255 characters (Adobe Analytics limit).
 */
export function pushValidationErrorEvent(fieldIds: ReadonlyArray<string>) {
  withAdobeAnalytics((adobeDataLayer) => {
    const joinedFieldIds = fieldIds.join('|');
    const errorName = `ESDC-EDSC:CDCP Online Application:${joinedFieldIds}`;
    adobeDataLayer.push?.({
      event: 'error',
      error: {
        // Adobe Analytics accepts a maximum of 255 characters
        name: errorName.slice(0, 255),
      },
    });
  });
}

/**
 * Pushes a `formSubmit` event containing the submitted form field values. Field values are formatted as
 * `elementType:fieldId:value` and joined with `|` to create a single string for Adobe Analytics.
 *
 * @param formName - The name of the submitted form, used for analytics categorization.
 * @param formValues - A map of form field IDs to their values and element types (checkbox or radio).
 */
export function pushFormSubmitEvent(formName: string, formValues: ReadonlyMap<string, { elementType: 'checkbox' | 'radio'; value: string }>) {
  withAdobeAnalytics((adobeDataLayer) => {
    try {
      // Format form values as `elementType:fieldId:value` and join with `|` to create a single string for Adobe Analytics.
      const formattedFormValues = [...formValues.entries()].map(([fieldId, { elementType, value }]) => `${elementType}:${fieldId}:${value}`);
      const listedValues = formattedFormValues.join('|');

      adobeDataLayer.push?.({
        event: 'formSubmit',
        form: {
          name: formName,
          list: listedValues,
        },
      });
    } catch (error) {
      console.warn('Failed to push form submit event to Adobe Analytics:', error);
    }
  });
}
