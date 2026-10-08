import { useCallback } from 'react';

import { useBeforeUnload, useBlocker } from 'react-router';
import type { Blocker, BlockerFunction } from 'react-router';

/**
 * Guards dirty state against browser unloads and client-side pathname changes.
 * Uses the legacy returnValue fallback alongside preventDefault for older browsers.
 * @param isDirty - Whether the current page has unsaved changes.
 * @returns The router blocker for caller-managed navigation confirmation.
 */
export function usePromptOnUnsavedChanges(isDirty: boolean): Blocker {
  useBeforeUnload(
    useCallback(
      (event: BeforeUnloadEvent) => {
        if (isDirty) {
          event.preventDefault();
          event.returnValue = true;
        }
      },
      [isDirty],
    ),
  );

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) => {
      return isDirty && currentLocation.pathname !== nextLocation.pathname;
    },
    [isDirty],
  );

  return useBlocker(shouldBlock);
}
