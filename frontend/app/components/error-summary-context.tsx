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
  /** Stable identity assigned to this mounted error registration. */
  id: string;

  /** DOM ID used as the summary link target and ordering anchor. */
  fieldId: string;

  /** Message shown beside the field and in the summary. */
  message: string;
}

/**
 * Field error data before the provider assigns a registration ID.
 *
 * Callers supply the target field and message. The mounted error component's
 * registration ID becomes the resulting {@link ErrorMessage.id}.
 */
export type NewError = OmitStrict<ErrorMessage, 'id'>;

/** State and operations shared with the summary and field-error components. */
export interface ErrorSummaryContextValue {
  /** Registered errors; target DOM order is applied by the provider's layout effect. */
  errors: ErrorMessage[];

  /** Add or update the error owned by a mounted field-level message. */
  registerError: (registrationId: string, error: NewError) => void;

  /** Remove the error owned by a field-level message when it unmounts. */
  unregisterError: (registrationId: string) => void;

  /** Provider-generated value exposed on the summary's data attribute. */
  summaryId: string;

  /** True after action data changes and until the validation run is committed. */
  pendingValidation: boolean;

  /** Monotonic trigger observed by focus and analytics effects. */
  validationRun: number;

  /** Complete the pending run after descendants register their current errors. */
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
