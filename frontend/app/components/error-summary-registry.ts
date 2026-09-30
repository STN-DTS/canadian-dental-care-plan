import type { ErrorMessage, NewError } from '~/components/error-summary-context';

/**
 * Registry and validation lifecycle state for one provider.
 * Registration changes and validation completion are tracked independently.
 */
interface ErrorSummaryState {
  /**
   * Errors keyed by mounted message registration ID, not by target field ID.
   * Map insertion order provides the fallback when targets cannot be ordered.
   */
  registeredErrors: ReadonlyMap<string, ErrorMessage>;

  /**
   * Registration IDs in the target order last committed by the layout effect.
   */
  orderedErrorIds: readonly string[];

  /**
   * Completed validation count used to trigger focus and analytics effects.
   */
  validationRun: number;

  /**
   * Whether validation has started and is awaiting completion.
   */
  pendingValidation: boolean;
}

/**
 * Empty registry and validation state used when a provider first mounts.
 * The reducer copies collections before changing registrations, so providers
 * can share this initial value without sharing subsequent registry updates.
 */
export const initialErrorSummaryState: ErrorSummaryState = {
  registeredErrors: new Map(),
  orderedErrorIds: [],
  validationRun: 0,
  pendingValidation: false,
};

/**
 * Error registration paired with its resolved target and fallback order.
 */
interface PositionedError {
  /**
   * Registered message associated with the resolved target.
   */
  error: ErrorMessage;

  /**
   * DOM element used as the registration's ordering anchor.
   */
  target: HTMLElement;

  /**
   * Original map iteration position used to break ordering ties.
   */
  registrationOrder: number;
}

/**
 * State transitions emitted by field messages and provider effects.
 * Registry and ordering actions do not start or complete validation.
 */
type ErrorSummaryAction =
  | { type: 'REGISTER_ERROR'; registrationId: string; error: NewError } //
  | { type: 'UNREGISTER_ERROR'; registrationId: string }
  | { type: 'SORT_ERRORS'; registrationIds: readonly string[] }
  | { type: 'START_VALIDATION' }
  | { type: 'COMPLETE_VALIDATION' };

/**
 * Orders resolved targets by DOM position, then by registration order.
 *
 * Registration order resolves identical targets, disconnected trees, and any
 * relationship the browser cannot order explicitly.
 *
 * @param left The first resolved registration to compare.
 * @param right The second resolved registration to compare.
 * @returns A negative value if left comes first, a positive value if right
 * comes first, or zero when neither registration precedes the other.
 */
function comparePositionedErrors(left: PositionedError, right: PositionedError): number {
  if (left.target === right.target) return left.registrationOrder - right.registrationOrder;

  const position = left.target.compareDocumentPosition(right.target);
  if (position & Node.DOCUMENT_POSITION_DISCONNECTED) return left.registrationOrder - right.registrationOrder;
  if (position & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
  if (position & Node.DOCUMENT_POSITION_PRECEDING) return 1;
  return left.registrationOrder - right.registrationOrder;
}

/**
 * Returns registration IDs in target DOM order, with missing targets last.
 *
 * Resolves each field ID against the current document. Errors sharing a target
 * retain map insertion order, as do errors whose targets are missing or cannot
 * be ordered relative to one another. Neither the registry nor the DOM is mutated.
 *
 * Requires DOM access after field elements have been committed. This function
 * reads a snapshot; it does not observe later mutations or update reducer state.
 *
 * @param registeredErrors Current mounted error registrations.
 * @returns Registration IDs in summary display order for a `SORT_ERRORS` action.
 */
export function sortRegisteredErrors(registeredErrors: ReadonlyMap<string, ErrorMessage>): readonly string[] {
  const positionedErrors: PositionedError[] = [];
  const missingTargetIds: string[] = [];
  let registrationOrder = 0;

  for (const error of registeredErrors.values()) {
    const target = document.getElementById(error.fieldId);
    if (target) {
      positionedErrors.push({ error, target, registrationOrder });
    } else {
      missingTargetIds.push(error.id);
    }

    registrationOrder += 1;
  }

  positionedErrors.sort(comparePositionedErrors);

  return [...positionedErrors.map(({ error }) => error.id), ...missingTargetIds];
}

/**
 * Applies field registration, ordering, and validation lifecycle transitions.
 *
 * Registrations are keyed independently of field IDs, allowing several messages
 * to target one field. Ordering is supplied by `SORT_ERRORS`; this reducer does
 * not read the DOM. Registration and ordering updates never advance validation.
 *
 * `START_VALIDATION` marks a run as pending. `COMPLETE_VALIDATION` clears that
 * flag and advances the counter only when a run is pending.
 *
 * @param state Current registry state.
 * @param action Requested state transition.
 * @returns The next state, retaining the original reference for redundant
 * registration, ordering, or completion actions.
 * @throws {Error} If the action type is not supported.
 */
export function errorSummaryReducer(state: ErrorSummaryState, action: ErrorSummaryAction): ErrorSummaryState {
  switch (action.type) {
    case 'REGISTER_ERROR': {
      const existing = state.registeredErrors.get(action.registrationId);
      if (existing?.fieldId === action.error.fieldId && existing.message === action.error.message) return state;

      const registeredErrors = new Map(state.registeredErrors);
      registeredErrors.set(action.registrationId, { ...action.error, id: action.registrationId });
      return { ...state, registeredErrors };
    }

    case 'UNREGISTER_ERROR': {
      if (!state.registeredErrors.has(action.registrationId)) return state;

      const registeredErrors = new Map(state.registeredErrors);
      registeredErrors.delete(action.registrationId);
      return {
        ...state,
        registeredErrors,
        orderedErrorIds: state.orderedErrorIds.filter((registrationId) => registrationId !== action.registrationId),
      };
    }

    case 'SORT_ERRORS': {
      const orderIsUnchanged = state.orderedErrorIds.length === action.registrationIds.length && state.orderedErrorIds.every((registrationId, index) => registrationId === action.registrationIds[index]);
      if (orderIsUnchanged) return state;

      return { ...state, orderedErrorIds: action.registrationIds };
    }

    case 'START_VALIDATION': {
      return { ...state, pendingValidation: true };
    }

    case 'COMPLETE_VALIDATION': {
      if (!state.pendingValidation) return state;
      return { ...state, pendingValidation: false, validationRun: state.validationRun + 1 };
    }

    default: {
      // @ts-expect-error: Exhaustive switch narrows action to `never`; retain this runtime guard for unhandled actions.
      throw new Error(`Unhandled action type: ${action.type}. Valid actions are: \`REGISTER_ERROR\`, \`UNREGISTER_ERROR\`, \`SORT_ERRORS\`, \`START_VALIDATION\`, \`COMPLETE_VALIDATION\`.`);
    }
  }
}
