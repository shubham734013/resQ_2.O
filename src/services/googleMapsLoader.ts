import type { GoogleMapsApi } from '../types/googleMaps';

let loadPromise: Promise<GoogleMapsApi> | null = null;

const getKey = (): string => {
  const env = import.meta.env as Record<string, string | undefined>;
  return (env.VITE_GOOGLE_MAPS_API_KEY ?? env.VITE_GOOGLE_MAPS_JAVASCRIPT_API_KEY)?.trim() ?? '';
};
const getGoogle = (): GoogleMapsApi | undefined =>
  (window as unknown as { google?: GoogleMapsApi }).google;

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (loadPromise) return loadPromise;

  const apiKey = getKey();
  if (!apiKey) return Promise.reject(new Error('MAPS_API_KEY_MISSING'));

  loadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    let settled = false;
    let pollTimer = 0;
    let timeoutTimer = 0;
    const windowWithMapsHooks = window as unknown as {
      __resqGoogleMapsLoaded?: () => void;
      gm_authFailure?: () => void;
    };
    const previousAuthFailure = windowWithMapsHooks.gm_authFailure;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(pollTimer);
      window.clearTimeout(timeoutTimer);
      delete windowWithMapsHooks.__resqGoogleMapsLoaded;
      if (windowWithMapsHooks.gm_authFailure === handleAuthFailure) {
        if (previousAuthFailure) windowWithMapsHooks.gm_authFailure = previousAuthFailure;
        else delete windowWithMapsHooks.gm_authFailure;
      }
      if (error) reject(error);
      else {
        const googleMaps = getGoogle();
        if (googleMaps?.maps?.importLibrary) resolve(googleMaps);
        else reject(new Error('MAPS_API_LOAD_FAILED'));
      }
    };

    const handleAuthFailure = () => {
      previousAuthFailure?.();
      finish(new Error('MAPS_API_AUTH_FAILURE'));
    };
    windowWithMapsHooks.gm_authFailure = handleAuthFailure;

    const waitForExistingScript = () => {
      const googleMaps = getGoogle();
      if (googleMaps?.maps?.importLibrary) {
        finish();
        return;
      }
      if (!settled) pollTimer = window.setTimeout(waitForExistingScript, 100);
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-resq-google-maps="true"]');
    if (existing) {
      timeoutTimer = window.setTimeout(() => finish(new Error('MAPS_API_LOAD_TIMEOUT')), 15000);
      existing.addEventListener('error', () => finish(new Error('MAPS_API_LOAD_FAILED')), { once: true });
      waitForExistingScript();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) + '&v=weekly&loading=async&libraries=places,geometry&callback=__resqGoogleMapsLoaded';
    script.async = true;
    script.defer = true;
    script.dataset.resqGoogleMaps = 'true';
    script.onerror = () => {
      script.remove();
      finish(new Error('MAPS_API_LOAD_FAILED'));
    };
    windowWithMapsHooks.__resqGoogleMapsLoaded = () => finish();
    timeoutTimer = window.setTimeout(() => {
      script.remove();
      finish(new Error('MAPS_API_LOAD_TIMEOUT'));
    }, 15000);
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    // Permit a clean retry after a failed load instead of caching a rejected promise forever.
    loadPromise = null;
    throw error;
  });

  return loadPromise;
}

export const isGoogleMapsConfigured = (): boolean => Boolean(getKey());
