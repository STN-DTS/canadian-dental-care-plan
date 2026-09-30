import { describe, expect, it } from 'vitest';

import type { ErrorMessage } from '~/components/error-summary-context';
import { errorSummaryReducer, initialErrorSummaryState, sortRegisteredErrors } from '~/components/error-summary-registry';

describe('errorSummaryReducer', () => {
  it('registers multiple messages independently for the same field', () => {
    const stateWithFirstError = errorSummaryReducer(initialErrorSummaryState, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-type-error',
      error: { fieldId: 'file-input', message: 'File type is not supported' },
    });
    const stateWithBothErrors = errorSummaryReducer(stateWithFirstError, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-size-error',
      error: { fieldId: 'file-input', message: 'File is too large' },
    });

    expect([...stateWithBothErrors.registeredErrors.values()]).toEqual([
      { id: 'file-type-error', fieldId: 'file-input', message: 'File type is not supported' },
      { id: 'file-size-error', fieldId: 'file-input', message: 'File is too large' },
    ]);
    expect(stateWithBothErrors).toMatchObject({ pendingValidation: false, validationRun: 0 });
  });

  it('updates a registration immutably and ignores unchanged data', () => {
    const originalState = errorSummaryReducer(initialErrorSummaryState, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-error',
      error: { fieldId: 'file-input', message: 'File is required' },
    });

    const unchangedState = errorSummaryReducer(originalState, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-error',
      error: { fieldId: 'file-input', message: 'File is required' },
    });
    const updatedState = errorSummaryReducer(originalState, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-error',
      error: { fieldId: 'replacement-input', message: 'File is too large' },
    });

    expect(unchangedState).toBe(originalState);
    expect(updatedState.registeredErrors.get('file-error')).toEqual({
      id: 'file-error',
      fieldId: 'replacement-input',
      message: 'File is too large',
    });
    expect(originalState.registeredErrors.get('file-error')).toEqual({
      id: 'file-error',
      fieldId: 'file-input',
      message: 'File is required',
    });
  });

  it('removes only the requested registration and ignores unknown IDs', () => {
    const stateWithFirstError = errorSummaryReducer(initialErrorSummaryState, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-type-error',
      error: { fieldId: 'file-input', message: 'File type is not supported' },
    });
    const stateWithBothErrors = errorSummaryReducer(stateWithFirstError, {
      type: 'REGISTER_ERROR',
      registrationId: 'file-size-error',
      error: { fieldId: 'file-input', message: 'File is too large' },
    });
    const orderedState = errorSummaryReducer(stateWithBothErrors, {
      type: 'SORT_ERRORS',
      registrationIds: ['file-type-error', 'file-size-error'],
    });

    const unchangedState = errorSummaryReducer(orderedState, { type: 'UNREGISTER_ERROR', registrationId: 'unknown-error' });
    const stateWithOneError = errorSummaryReducer(orderedState, { type: 'UNREGISTER_ERROR', registrationId: 'file-type-error' });

    expect(unchangedState).toBe(orderedState);
    expect([...stateWithOneError.registeredErrors.values()]).toEqual([{ id: 'file-size-error', fieldId: 'file-input', message: 'File is too large' }]);
    expect(stateWithOneError.orderedErrorIds).toEqual(['file-size-error']);
    expect(orderedState.registeredErrors.has('file-type-error')).toBe(true);
  });

  it('advances the validation run only when a run is pending', () => {
    const unchangedState = errorSummaryReducer(initialErrorSummaryState, { type: 'COMPLETE_VALIDATION' });
    const pendingState = errorSummaryReducer(initialErrorSummaryState, { type: 'START_VALIDATION' });
    const completedState = errorSummaryReducer(pendingState, { type: 'COMPLETE_VALIDATION' });
    const nextPendingState = errorSummaryReducer(completedState, { type: 'START_VALIDATION' });
    const nextCompletedState = errorSummaryReducer(nextPendingState, { type: 'COMPLETE_VALIDATION' });

    expect(unchangedState).toBe(initialErrorSummaryState);
    expect(pendingState).toMatchObject({ pendingValidation: true, validationRun: 0 });
    expect(completedState).toMatchObject({ pendingValidation: false, validationRun: 1 });
    expect(errorSummaryReducer(completedState, { type: 'COMPLETE_VALIDATION' })).toBe(completedState);
    expect(nextCompletedState).toMatchObject({ pendingValidation: false, validationRun: 2 });
  });
});

describe('sortRegisteredErrors', () => {
  it('sorts by target DOM order and preserves registration order for ties and missing targets', () => {
    const targetContainer = document.createElement('div');
    for (const fieldId of ['field-earlier', 'field-later']) {
      const target = document.createElement('input');
      target.id = fieldId;
      targetContainer.append(target);
    }

    const registeredErrors = new Map<string, ErrorMessage>([
      ['missing-first', { id: 'missing-first', fieldId: 'missing-first', message: 'Missing first' }],
      ['later-first', { id: 'later-first', fieldId: 'field-later', message: 'Later field' }],
      ['earlier', { id: 'earlier', fieldId: 'field-earlier', message: 'Earlier field' }],
      ['later-second', { id: 'later-second', fieldId: 'field-later', message: 'Another later field message' }],
      ['missing-second', { id: 'missing-second', fieldId: 'missing-second', message: 'Missing second' }],
    ]);

    document.body.append(targetContainer);
    try {
      expect(sortRegisteredErrors(registeredErrors)).toEqual(['earlier', 'later-first', 'later-second', 'missing-first', 'missing-second']);
    } finally {
      targetContainer.remove();
    }
  });
});
