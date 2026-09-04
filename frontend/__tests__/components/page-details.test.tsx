import { render } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PageDetails } from '~/components/page-details';
import { useBuildInfo, usePageIdentifier } from '~/utils/route-utils';

vi.mock(import('~/utils/route-utils'));

describe('PageDetails', () => {
  beforeEach(() => {
    vi.mocked(useBuildInfo, { partial: true }).mockReturnValue({
      buildDate: '2024-03-11T00:00:00Z',
      buildVersion: '1.0.0',
    });

    vi.mocked(usePageIdentifier).mockReturnValue('page123');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('displays page identifier if available', () => {
    const { getByText } = render(<PageDetails />);
    expect(getByText('pageDetails.screenId')).toBeInTheDocument();
    expect(getByText('page123')).toBeInTheDocument();
  });

  it('displays build date if available', () => {
    const { getByText } = render(<PageDetails />);
    expect(getByText('pageDetails.dateModfied')).toBeInTheDocument();
    expect(getByText('2024-03-11')).toBeInTheDocument();
  });

  it('displays build version if available', () => {
    const { getByText } = render(<PageDetails />);
    expect(getByText('pageDetails.version')).toBeInTheDocument();
    expect(getByText('1.0.0')).toBeInTheDocument();
  });

  it('does not display page identifier if not available', () => {
    vi.mocked(usePageIdentifier).mockReturnValueOnce('');
    const { queryByText } = render(<PageDetails />);
    expect(queryByText('pageDetails.screenId')).not.toBeInTheDocument();
  });

  it('does not display build date if not available', () => {
    vi.mocked(useBuildInfo, { partial: true }).mockReturnValueOnce({});
    const { queryByText } = render(<PageDetails />);
    expect(queryByText('pageDetails.dateModfied')).not.toBeInTheDocument();
  });

  it('does not display build version if not available', () => {
    vi.mocked(useBuildInfo, { partial: true }).mockReturnValueOnce({ buildVersion: '' });
    const { queryByText } = render(<PageDetails />);
    expect(queryByText('pageDetails.version')).not.toBeInTheDocument();
  });
});
