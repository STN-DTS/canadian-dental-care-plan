import { useMemo } from 'react';

import { isClient } from '~/utils/ssr-utils';

/**
 * Check if a specific web storage type is available and usable. This hook tests the availability of `localStorage` or
 * `sessionStorage` by attempting to write and remove a test key. It returns `true` if the storage is accessible and
 * functional, and `false` otherwise. This is particularly useful for environments where storage access may be
 * restricted, such as in private browsing modes or certain server-side rendering contexts.
 *
 * @param type - The type of web storage to check, either 'localStorage' or 'sessionStorage'. Defaults to 'localStorage'.
 * @returns A boolean indicating whether the specified storage type is enabled and functional.
 */
export function useStorageEnabled(type: 'localStorage' | 'sessionStorage' = 'localStorage'): boolean {
  return useMemo<boolean>(() => {
    if (!isClient()) {
      return false;
    }

    try {
      const storage = window[type];
      const testKey = '__storage_test__';
      // Try writing and removing a key. Some environments throw on access or setItem.
      storage.setItem(testKey, '1');
      storage.removeItem(testKey);
      return true;
    } catch {
      return false;
    }
  }, [type]);
}
