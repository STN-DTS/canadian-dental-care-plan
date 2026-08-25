import { JSDOM } from 'jsdom';

/**
 * Removes HTML tags from a string.
 *
 * @param content - String that may contain HTML.
 * @returns The string without HTML tags.
 *
 * @example
 * stripHtml('Hello <strong>world</strong>.');
 * // 'Hello world.'
 */
export function stripHtml(content: string): string {
  const dom = new JSDOM('');
  const element = dom.window.document.createElement('div');
  element.innerHTML = content;
  return element.textContent;
}
