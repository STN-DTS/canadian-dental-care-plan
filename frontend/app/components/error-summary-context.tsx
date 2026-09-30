/**
 * Error Summary Context — live field error registry
 * -------------------------------------------------
 *
 * Errors exist in the summary while their field-level messages are mounted.
 * The provider tracks validation state. Dedicated descendants handle focus
 * and analytics effects only when validation completes.
 */
import { createContext, use } from 'react';

/**
 * Validation error associated with a field-level control.
 *
 * `fieldId` links the summary entry to the target element and determines its
 * display position. `id` identifies this registration independently, so one
 * field can own more than one error message.
 */
export interface ErrorMessage {
  /**
   * Stable identity supplied when the mounted error message registers itself.
   * This identifies the registration, not the target field.
   */
  id: string;

  /**
   * DOM ID of the control targeted by the summary link.
   * The provider also uses this element to determine display order.
   */
  fieldId: string;

  /**
   * Message shown beside the field and in the summary.
   */
  message: string;
}

/**
 * Field error data without its registration identity.
 *
 * Callers supply the target field and message. The registration ID passed
 * separately to `registerError` becomes the resulting {@link ErrorMessage.id}.
 */
export type NewError = OmitStrict<ErrorMessage, 'id'>;

/**
 * Registry operations and validation state shared within one provider.
 */
export interface ErrorSummaryContextValue {
  /**
   * Current errors exposed to the summary.
   *
   * The provider applies target DOM order in a layout effect when its children
   * or registrations change. Newly registered errors may await that sorting.
   */
  errors: ErrorMessage[];

  /**
   * Adds or updates the error owned by a mounted field-level message.
   *
   * Repeating unchanged field and message data is a no-op. Registration changes
   * do not start validation or request focus.
   *
   * @param registrationId The stable identity owned by the mounted message.
   * @param error The target field and message to display.
   */
  registerError: (registrationId: string, error: NewError) => void;

  /**
   * Removes one field-level message's registration when it unmounts.
   *
   * Unknown IDs are ignored. Other registrations remain, including messages
   * associated with the same field.
   *
   * @param registrationId The identity of the registration to remove.
   */
  unregisterError: (registrationId: string) => void;

  /**
   * Provider-generated value exposed through `data-error-summary-id`.
   * Focus uses this attribute independently of the summary's DOM ID.
   */
  summaryId: string;

  /**
   * Whether a validation run has started but has not been committed.
   * The provider starts a run on mount and whenever action data changes.
   */
  pendingValidation: boolean;

  /**
   * Number of completed validation runs, used to trigger focus and analytics.
   * Registration and ordering changes do not advance this counter.
   */
  validationRun: number;

  /**
   * Completes the pending run after descendants register their current errors.
   * Advances the validation counter once; calls without a pending run are ignored.
   */
  completeValidation: () => void;
}

/**
 * Shares one provider's registry with summary and field-error components.
 *
 * The undefined default lets consumers detect a missing provider without
 * throwing during render.
 */
export const ErrorSummaryContext = createContext<ErrorSummaryContextValue | undefined>(undefined);

/**
 * Reads the nearest provider's error registry and operations.
 *
 * Components may use this hook outside a provider; in that case it returns
 * `undefined` and does not create or mutate error state.
 *
 * @returns The context value, or `undefined` when no provider is present.
 */
export function useErrorSummaryContext(): ErrorSummaryContextValue | undefined {
  return use(ErrorSummaryContext);
}
