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

let activeRefreshPromise: Promise<boolean> | null = null;

/**
 * Transparently refreshes the HTTP-only session cookies with single-flight deduplication.
 */
export const refreshSession = async (): Promise<boolean> => {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
};

/**
 * Universal authenticated fetch wrapper that includes credentials and transparently
 * handles 401 Unauthorized responses by refreshing the token and retrying the request.
 */
export const authenticatedFetch = async (
  input: string | URL | Request,
  init: RequestInit = {}
): Promise<Response> => {
  const requestInit: RequestInit = {
    ...init,
    credentials: 'include',
  };

  let response = await fetch(input, requestInit);

  const urlStr = typeof input === 'string' ? input : input instanceof Request ? input.url : input.toString();
  const isAuthBypassEndpoint =
    urlStr.includes('/auth/login') ||
    urlStr.includes('/auth/refresh') ||
    urlStr.includes('/auth/register');

  if (response.status === 401 && !isAuthBypassEndpoint) {
    const refreshed = await refreshSession();
    if (refreshed) {
      // Retry original request with freshly minted session cookie
      response = await fetch(input, requestInit);
    }
  }

  return response;
};
