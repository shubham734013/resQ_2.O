import { PublicClientApplication, type Configuration, LogLevel } from '@azure/msal-browser';

// Support both VITE_MICROSOFT_* and VITE_AZURE_* environment variable formats
const clientId =
  (import.meta.env.VITE_MICROSOFT_CLIENT_ID as string | undefined) ||
  (import.meta.env.VITE_AZURE_CLIENT_ID as string | undefined) ||
  '';

const tenantId =
  (import.meta.env.VITE_MICROSOFT_TENANT_ID as string | undefined) ||
  (import.meta.env.VITE_AZURE_TENANT_ID as string | undefined) ||
  'common';

const redirectUri =
  (import.meta.env.VITE_AZURE_REDIRECT_URI as string | undefined) ||
  (import.meta.env.VITE_MICROSOFT_REDIRECT_URI as string | undefined) ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173');

const authority =
  (import.meta.env.VITE_MICROSOFT_AUTHORITY as string | undefined) ||
  `https://login.microsoftonline.com/${tenantId || 'common'}`;

export const isMsalConfigured = Boolean(clientId && clientId !== 'your_microsoft_client_id');

export const msalConfig: Configuration = {
  auth: {
    clientId: clientId || '00000000-0000-0000-0000-000000000000',
    authority,
    redirectUri,
    knownAuthorities: ['login.microsoftonline.com'],
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        if (level === LogLevel.Error) {
          console.error('[MSAL Error]', message);
        }
      },
      logLevel: LogLevel.Error,
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
  prompt: 'select_account',
};

export const msalInstance = new PublicClientApplication(msalConfig);

let initializePromise: Promise<void> | null = null;
export const ensureMsalInitialized = async (): Promise<PublicClientApplication> => {
  if (!initializePromise) {
    initializePromise = msalInstance.initialize().catch((err) => {
      initializePromise = null;
      throw err;
    });
  }
  await initializePromise;
  return msalInstance;
};

// Initiate non-blocking initialization on evaluation in browser
if (typeof window !== 'undefined') {
  void ensureMsalInitialized().catch(() => {
    /* gracefully handled on demand */
  });
}
