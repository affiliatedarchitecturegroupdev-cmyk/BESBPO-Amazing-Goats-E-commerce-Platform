'use client';
import { useEffect } from 'react';

/**
 * Registers the storefront service worker (T-064) so the app is installable and
 * the shell opens offline. It is a no-op where service workers are unavailable
 * (the test runner, an older browser) and in development, so a stale cache never
 * hides a code change while working locally.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* offline support is best-effort; a failure must not break the page */
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);
  return null;
}
