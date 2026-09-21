/**
 * Schedules a callback to run before the browser's next repaint.
 *
 * @param callback Receives the animation frame timestamp when invoked.
 * @returns A cleanup function that cancels the callback if it is still pending.
 */
export function scheduleNextFrame(callback: FrameRequestCallback): () => void {
  const frameId = window.requestAnimationFrame(callback);
  return function cancelScheduledNextFrame() {
    window.cancelAnimationFrame(frameId);
  };
}

/**
 * Focuses the element returned by `getElement` during the next animation frame.
 *
 * @param getElement Returns the element to focus when the animation frame runs.
 * @param options Options passed to `HTMLElement.focus`.
 * @returns A cleanup function that cancels the pending animation frame.
 */
export function focusOnNextFrame(getElement: () => HTMLElement | null | undefined, options: FocusOptions = { preventScroll: true }): () => void {
  return scheduleNextFrame(() => getElement()?.focus(options));
}
