/**
 * Global API and Realtime Configuration for ResQ Frontend.
 * Consistently resolves VITE_API_URL / VITE_API_BASE_URL across all clients.
 */

export const getApiBaseUrl = (): string => {
  const value = (
    (import.meta.env.VITE_API_URL as string | undefined) ||
    (import.meta.env.VITE_API_BASE_URL as string | undefined)
  )?.trim();

  if (value) {
    return value.replace(/\/$/, '');
  }

  // Fallback for local development or preview mode
  return 'http://localhost:5001/api/v1';
};

export const API_BASE_URL = getApiBaseUrl();
export const SOCKET_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
