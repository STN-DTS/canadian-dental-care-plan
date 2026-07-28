import { useEffect, useRef } from 'react';

import NProgress from 'nprogress';
import { useGlobalNavigationState } from 'remix-utils/use-global-navigation-state';

export function useNProgress(delay = 500) {
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startedRef = useRef(false);

  const states = useGlobalNavigationState();
  const isIdling = states.every((state) => state === 'idle');

  // Configure NProgress once per hook instance
  useEffect(() => {
    NProgress.configure({
      showSpinner: false,
      // You can add more options here like minimum, easing, speed, etc.
    });
  }, []);

  useEffect(() => {
    if (isIdling) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (startedRef.current) {
        NProgress.done();
        startedRef.current = false;
      }
    } else {
      timerRef.current ??= setTimeout(() => {
        NProgress.start();
        startedRef.current = true;
      }, delay);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isIdling, delay]);

  // Also cleanup on unmount
  useEffect(() => {
    return () => {
      NProgress.done();
    };
  }, []);
}
