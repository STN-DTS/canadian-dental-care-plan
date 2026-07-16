import { render, waitFor } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { scrollAndFocusFromAnchorLink } from '~/utils/link-utils';

/*
 * @vitest-environment jsdom
 */

const scrollIntoViewMock = vi.fn();
Element.prototype.scrollIntoView = scrollIntoViewMock;

describe('scrollAndFocusFromAnchorLink', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('should scroll and focus on the target element', async () => {
    const { findByTestId } = render(
      <h1 id="heading" tabIndex={-1} data-testid="heading">
        heading
      </h1>,
    );

    const actual = await waitFor(async () => await findByTestId('heading'));
    const spyFocus = vi.spyOn(actual, 'focus');

    const url = new URL(window.location.href);
    url.hash = 'heading';
    scrollAndFocusFromAnchorLink(url.href);

    expect(actual).toBeInTheDocument();
    expect(actual).toHaveFocus();
    expect(scrollIntoViewMock).toHaveBeenCalled();
    expect(spyFocus).toHaveBeenCalled();
  });

  it("should not scroll and focus on the target element when href can't be parsed", async () => {
    const { findByTestId } = render(
      <h1 id="heading" tabIndex={-1} data-testid="heading">
        heading
      </h1>,
    );

    const actual = await waitFor(async () => await findByTestId('heading'));
    const spyFocus = vi.spyOn(actual, 'focus');

    scrollAndFocusFromAnchorLink('not-parsable-href');

    expect(actual).toBeInTheDocument();
    expect(actual).not.toHaveFocus();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(spyFocus).not.toHaveBeenCalled();
  });

  it('should not scroll and focus on the target element when href have no hash', async () => {
    const { findByTestId } = render(
      <h1 id="heading" tabIndex={-1} data-testid="heading">
        heading
      </h1>,
    );

    const actual = await waitFor(async () => await findByTestId('heading'));
    const spyFocus = vi.spyOn(actual, 'focus');

    const url = new URL(window.location.href);
    url.hash = '';
    scrollAndFocusFromAnchorLink(url.href);

    expect(actual).toBeInTheDocument();
    expect(actual).not.toHaveFocus();
    expect(spyFocus).not.toHaveBeenCalled();
  });

  it("should not scroll and focus on the target element when element can't be found", async () => {
    const { findByTestId } = render(
      <h1 id="heading" tabIndex={-1} data-testid="heading">
        heading
      </h1>,
    );

    const actual = await waitFor(async () => await findByTestId('heading'));
    const spyFocus = vi.spyOn(actual, 'focus');

    const url = new URL(window.location.href);
    url.hash = 'retemele';
    scrollAndFocusFromAnchorLink(url.href);

    expect(actual).toBeInTheDocument();
    expect(actual).not.toHaveFocus();
    expect(scrollIntoViewMock).not.toHaveBeenCalled();
    expect(spyFocus).not.toHaveBeenCalled();
  });
});
