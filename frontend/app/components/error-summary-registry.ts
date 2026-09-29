import type { ErrorMessage, NewError } from '~/components/error-summary-context';

/** Registry and validation lifecycle state for one provider. */
interface ErrorSummaryState {
  /** Errors keyed by mounted message registration ID. */
  registeredErrors: ReadonlyMap<string, ErrorMessage>;
  /** Registration IDs ordered by target position after layout sorting. */
  orderedErrorIds: readonly string[];
  /** Monotonic trigger for validation side effects. */
  validationRun: number;
  /** Whether the latest action result still needs to be committed. */
  pendingValidation: boolean;
}

/** Empty state used when an error-summary provider first mounts. */
export const initialErrorSummaryState: ErrorSummaryState = {
  registeredErrors: new Map(),
  orderedErrorIds: [],
  validationRun: 0,
  pendingValidation: false,
};

/** Error registration paired with its resolved target and fallback order. */
interface PositionedError {
  error: ErrorMessage;
  target: HTMLElement;
  registrationOrder: number;
}

/** State transitions emitted by field messages and provider effects. */
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
 * Returns error IDs in target DOM order, with missing targets last.
 *
 * @param registeredErrors Current mounted error registrations.
 * @returns IDs in summary display order.
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
 * @param state Current registry state.
 * @param action Requested state transition.
 * @returns Updated state, or the same state when the action changes nothing.
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
