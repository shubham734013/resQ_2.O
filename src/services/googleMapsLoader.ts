import type { GoogleMapsApi } from '../types/googleMaps';

let loadPromise: Promise<GoogleMapsApi> | null = null;

const getKey = (): string => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() ?? '';

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<GoogleMapsApi>((resolve, reject) => {
    const apiKey = getKey();
    if (!apiKey) {
      reject(new Error('MAPS_API_KEY_MISSING'));
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-resq-google-maps="true"]');
    if (existing) {
      const waitForGoogle = () => {
        const googleMaps = (window as unknown as { google?: GoogleMapsApi }).google;
        if (googleMaps?.maps?.importLibrary) resolve(googleMaps);
        else window.setTimeout(waitForGoogle, 50);
      };
      waitForGoogle();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(apiKey) + '&v=weekly&loading=async&libraries=places,geometry&callback=__resqGoogleMapsLoaded';
    script.async = true;
    script.defer = true;
    script.dataset.resqGoogleMaps = 'true';
    script.onerror = () => reject(new Error('MAPS_API_LOAD_FAILED'));
    (window as unknown as { __resqGoogleMapsLoaded?: () => void }).__resqGoogleMapsLoaded = () => {
      const googleMaps = (window as unknown as { google?: GoogleMapsApi }).google;
      if (!googleMaps?.maps?.importLibrary) reject(new Error('MAPS_API_LOAD_FAILED'));
      else resolve(googleMaps);
      delete (window as unknown as { __resqGoogleMapsLoaded?: () => void }).__resqGoogleMapsLoaded;
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

export const isGoogleMapsConfigured = (): boolean => Boolean(getKey());