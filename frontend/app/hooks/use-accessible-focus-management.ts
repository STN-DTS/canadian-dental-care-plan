import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';

import { useLocation } from 'react-router';

/**
 * A custom hook that manages focus for accessible route navigation.
 * Moves focus to a specified element when the route pathname changes,
 * but only for keyboard users to avoid visual disruption from pointer/touch interactions.
 *
 * Focus management behavior:
 * - Initial page load is ignored; focus changes apply only on subsequent pathname changes
 * - Focus only moves when the latest interaction modality is keyboard
 * - Uses requestAnimationFrame to ensure DOM is updated before moving focus
 * - Prevents scroll to the focused element for better UX
 *
 * Usage:
 * const focusableElementRef = useRef<HTMLHeadingElement | null>(null);
 * useAccessibleFocusManagement(focusableElementRef);
 * <div ref={focusableElementRef} tabIndex={-1}>...</div>
 *
 * @param focusableElementRef A ref attached to the preferred focus target element.
 */
export const useAccessibleFocusManagement = (focusableElementRef: RefObject<HTMLElement | null>) => {
  const { pathname } = useLocation();
  const isFirstRenderRef = useRef(true);
  // Tracks the latest input modality so focus management only runs for keyboard users.
  const isKeyboardNavigationRef = useRef(false);

  useEffect(() => {
    // Keyboard interaction enables route-change focus so keyboard/screen-reader users
    // are moved to the new page heading/context after navigation.
    function handleKeydown() {
      isKeyboardNavigationRef.current = true;
    }

    // Pointer/touch interaction disables route-change focus to avoid showing focus rings
    // unexpectedly during mouse/touch navigation.
    function handlePointer() {
      isKeyboardNavigationRef.current = false;
    }

    window.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('pointerdown', handlePointer, true);
    window.addEventListener('touchstart', handlePointer, true);

    return () => {
      window.removeEventListener('keydown', handleKeydown, true);
      window.removeEventListener('pointerdown', handlePointer, true);
      window.removeEventListener('touchstart', handlePointer, true);
    };
  }, []);

  useEffect(() => {
    // Do not move focus on initial page load; only handle client-side route changes.
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    // Skip programmatic focus for non-keyboard navigation to reduce visual disruption.
    if (!isKeyboardNavigationRef.current) {
      return;
    }

    // Wait until the next paint so the new route content is in the DOM before moving focus.
    const frameId = window.requestAnimationFrame(() => {
      focusableElementRef.current?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [focusableElementRef, pathname]);
};
