import { useCallback } from 'react';
import type { JSX } from 'react';

import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useTranslation } from 'react-i18next';

import { useBrowserCompatibilityBannerStorage } from '~/hooks/use-browser-compatibility-banner-storage';
import { useBrowserValidation } from '~/hooks/use-browser-validation';

interface BrowserCompatibilityBannerViewProps {
  onDismiss?: () => void;
}

/**
 * Displays the browser compatibility banner when the current browser is unsupported and the banner has not been dismissed.
 *
 * @returns The banner when visible; otherwise `null`.
 */
export function BrowserCompatibilityBanner(): JSX.Element | null {
  const validationResult = useBrowserValidation();
  const { enabled, value, set } = useBrowserCompatibilityBannerStorage();

  const isBannerVisible = validationResult.status === 'success' && validationResult.data.isValidBrowser === false && enabled && value !== 'dismissed';

  const handleDismiss = useCallback(() => {
    set('dismissed');
  }, [set]);

  if (!isBannerVisible) {
    return null;
  }

  return <BrowserCompatibilityBannerView onDismiss={handleDismiss} />;
}

/**
 * Renders browser compatibility banner markup.
 *
 * @param props Banner properties.
 * @returns Browser compatibility banner element.
 */
export function BrowserCompatibilityBannerView({ onDismiss }: BrowserCompatibilityBannerViewProps): JSX.Element {
  const { t } = useTranslation('gcweb');

  return (
    <div id="browser-compatibility-banner" className="bg-red-50 shadow-md" role="alert">
      <div className="container">
        <div className="flex items-stretch">
          <div className="hidden items-center bg-red-200 p-4 sm:flex">
            <FontAwesomeIcon icon={faCircleExclamation} className="size-6 shrink-0 text-red-700" />
          </div>
          <div className="grow space-y-2 py-4 pl-4">
            <h2 className="font-lato font-bold">{t(($) => $.browserCompatibilityBanner.title)}</h2>
            <p>{t(($) => $.browserCompatibilityBanner.content)}</p>
            <p>
              <Trans ns="gcweb" i18nKey={($) => $.browserCompatibilityBanner.contact} components={{ noWrap: <span className="whitespace-nowrap" /> }} />
            </p>
            <div className="text-right">
              <button type="button" onClick={onDismiss} className="font-lato rounded-sm border border-red-300 px-3 py-2 text-sm text-red-700 outline-offset-4 hover:border-red-400 hover:bg-red-100 focus:border-red-400 focus:bg-red-100">
                {t(($) => $.browserCompatibilityBanner.dismiss)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
