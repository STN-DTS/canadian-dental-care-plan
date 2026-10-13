import { parseUrl } from '~/utils/url-utils';

/**
 * Scrolls and focuses on the element identified by the anchor link's hash.
 *
 * @param {string} href - The anchor link URL.
 */
export function scrollAndFocusFromAnchorLink(href: string): void {
  const urlResult = parseUrl(href);

  if (!urlResult.success) {
    return;
  }

  const { hash } = urlResult.url;

  if (!hash) {
    return;
  }

  const targetElement = document.querySelector<HTMLElement>(hash);

  if (!targetElement) {
    return;
  }

  targetElement.scrollIntoView({ behavior: 'smooth' });
  targetElement.focus();
}
