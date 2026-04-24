/**
 * GA4 analytics wrapper. Uses direct gtag.js.
 * No-ops when VITE_GA4_MEASUREMENT_ID is unset.
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA4_MEASUREMENT_ID as string | undefined;

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

let initialized = false;

/**
 * Load GA4 script and config. Call once at app startup.
 * Skips when MEASUREMENT_ID is missing.
 */
export function initGa4(): void {
  if (typeof window === 'undefined' || !MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    return;
  }
  if (initialized) {
    return;
  }
  initialized = true;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.gtag?.('js', new Date());
  window.gtag?.('config', MEASUREMENT_ID, { send_page_view: false });
}

/**
 * Send a custom event to GA4.
 * No-op when GA4 is not configured.
 */
export function track(eventName: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.gtag || !MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    return;
  }
  window.gtag('event', eventName, params);
}

/**
 * Send a page_view event (for SPA route changes).
 */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined' || !window.gtag || !MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    return;
  }
  window.gtag('event', 'page_view', { page_path: path });
}
