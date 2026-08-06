/**
 * Extends i18next with application translation resources and defaults.
 *
 * This file contains a module augmentation, so its imports keep it an
 * external module while allowing the `i18next` declarations to be extended.
 */
import type { FlatNamespace } from 'i18next';

import type { i18nResources } from '~/.server/i18n-resources';

declare module 'i18next' {
  /**
   * @see https://www.i18next.com/overview/typescript
   * @see https://www.i18next.com/overview/typescript#selector-api
   */
  interface CustomTypeOptions {
    enableSelector: true;
    defaultNS: ExtractStrict<FlatNamespace, 'common'>;
    resources: (typeof i18nResources)['en'];
  }
}
