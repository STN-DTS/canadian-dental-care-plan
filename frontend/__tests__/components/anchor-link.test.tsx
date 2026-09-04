import { fireEvent, render } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AnchorLink } from '~/components/anchor-link';
import type { AnchorLinkProps } from '~/components/anchor-link';
import { scrollAndFocusFromAnchorLink } from '~/utils/link-utils';

vi.mock(import('~/utils/link-utils'), () => ({
  scrollAndFocusFromAnchorLink: vi.fn(),
}));

describe('AnchorLink', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const anchorElementId = 'targetElement';
  const defaultProps: AnchorLinkProps = {
    anchorElementId,
  };

  it('renders AnchorLink component', () => {
    const { getByText } = render(<AnchorLink {...defaultProps}>Click me</AnchorLink>);
    const linkElement = getByText('Click me');
    expect(linkElement).toBeInTheDocument();
  });

  it('calls scrollAndFocusFromAnchorLink on click', () => {
    const { getByText } = render(<AnchorLink {...defaultProps}>Click me</AnchorLink>);
    const linkElement = getByText('Click me');

    fireEvent.click(linkElement);

    // Ensure that scrollAndFocusFromAnchorLink is called with the correct argument
    expect(scrollAndFocusFromAnchorLink).toHaveBeenCalledWith(`http://localhost:3000/#${anchorElementId}`);
  });

  it('invokes onClick callback if provided', () => {
    const onClickMock = vi.fn();
    const { getByText } = render(
      <AnchorLink {...defaultProps} onClick={onClickMock}>
        Click me
      </AnchorLink>,
    );
    const linkElement = getByText('Click me');

    fireEvent.click(linkElement);

    // Ensure that onClick callback is called
    expect(onClickMock).toHaveBeenCalled();
  });
});
