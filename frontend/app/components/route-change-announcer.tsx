import { useEffect, useRef, useState } from 'react';

import { useLocation } from 'react-router';

/**
 * Announces route changes to assistive technology on client-side navigation.
 * It listens for changes in the pathname and updates an aria-live region with the current document title.
 * This ensures that screen reader users are informed of route changes and can understand the context of the new page.
 */
export function RouteChangeAnnouncer() {
  const { pathname } = useLocation();
  // Skip initial render to avoid announcing the page title on first load/hydration.
  const isFirstRenderRef = useRef(true);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    // Wait until the next paint so document.title reflects the new route before announcing.
    const frameId = window.requestAnimationFrame(() => {
      const title = document.title.trim();
      setAnnouncement(title);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [pathname]);

  return (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </div>
  );
}
