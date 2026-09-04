import { render } from '@testing-library/react';

import type Bowser from 'bowser';
import { describe, expect, it, vi } from 'vitest';

import { BrowserCompatibilityBanner, BrowserCompatibilityBannerView } from '~/components/browser-compatibility-banner';
import { useBrowserCompatibilityBannerStorage } from '~/hooks/use-browser-compatibility-banner-storage';
import { useBrowserValidation } from '~/hooks/use-browser-validation';

vi.mock('~/hooks/use-browser-compatibility-banner-storage');
vi.mock('~/hooks/use-browser-validation');

describe('BrowserCompatibilityBannerView', () => {
  it('should render the BrowserCompatibilityBannerView', () => {
    const { container } = render(<BrowserCompatibilityBannerView />);
    expect(container).toMatchSnapshot('expected html');
  });

  it('should call onDismiss when the dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(<BrowserCompatibilityBannerView onDismiss={onDismiss} />);

    const dismissButton = getByRole('button', { name: 'browserCompatibilityBanner.dismiss' });
    dismissButton.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe('BrowserCompatibilityBanner', () => {
  const setBannerState = vi.fn();

  function mockBrowserValidation(isValidBrowser: boolean) {
    vi.mocked(useBrowserValidation).mockReturnValue({
      status: 'success',
      data: { isValidBrowser, browserInfo: {} as Bowser.Parser.ParsedResult },
    });
    vi.mocked(useBrowserCompatibilityBannerStorage).mockReturnValue({
      enabled: true,
      value: undefined,
      set: setBannerState,
      remove: vi.fn(),
    });
  }

  it('should render for an unsupported browser', () => {
    mockBrowserValidation(false);

    const { getByRole } = render(<BrowserCompatibilityBanner />);

    expect(getByRole('alert')).toBeInTheDocument();
  });

  it('should not render for a supported browser', () => {
    mockBrowserValidation(true);

    const { queryByRole } = render(<BrowserCompatibilityBanner />);

    expect(queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should persist dismissal', () => {
    mockBrowserValidation(false);
    const { getByRole } = render(<BrowserCompatibilityBanner />);

    getByRole('button', { name: 'browserCompatibilityBanner.dismiss' }).click();

    expect(setBannerState).toHaveBeenCalledWith('dismissed');
  });
});
