import { createPublicKey } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import type { SocialProvider } from '../types/auth.js';

export interface VerifiedSocialIdentity {
  provider: SocialProvider;
  providerSubject: string;
  email: string;
  name: string;
  emailVerified: boolean;
}

interface JwksKey { kid: string; kty: string; n?: string; e?: string; }
interface OidcConfiguration { issuer: string; jwks_uri: string; }
const cache = new Map<string, { expiresAt: number; value: unknown }>();

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) throw new AppError('SOCIAL_PROVIDER_UNAVAILABLE', 'Social identity provider is unavailable', 503);
  return response.json() as Promise<T>;
};

const cachedFetch = async <T>(key: string, url: string, ttlMs: number): Promise<T> => {
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value as T;
  const value = await fetchJson<T>(url);
  cache.set(key, { expiresAt: Date.now() + ttlMs, value });
  return value;
};

let testVerifier: ((provider: SocialProvider, credential: string) => Promise<VerifiedSocialIdentity>) | null = null;
export const setSocialCredentialVerifierForTest = (verifier: typeof testVerifier): void => { testVerifier = verifier; };
export const resetSocialCredentialVerifierForTest = (): void => { testVerifier = null; };

const verifyJwtWithJwks = async (
  token: string,
  jwksUrl: string,
  expectedIssuer: string | [string, ...string[]],
  expectedAudience: string | [string, ...string[]],
): Promise<JwtPayload & Record<string, unknown>> => {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded !== 'object' || !decoded.header || typeof decoded.header.kid !== 'string') {
    throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Social credential is invalid', 401);
  }

  const jwks = await cachedFetch<{ keys: JwksKey[] }>('jwks:' + jwksUrl, jwksUrl, 10 * 60 * 1000);
  const key = jwks.keys.find((candidate) => candidate.kid === decoded.header.kid && candidate.kty === 'RSA');
  if (!key?.n || !key.e) throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Social credential is invalid', 401);

  const publicKey = createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' });
  try {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer: expectedIssuer,
      audience: expectedAudience,
    }) as JwtPayload & Record<string, unknown>;
  } catch {
    throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Social credential is invalid or expired', 401);
  }
};

const verifyGoogle = async (credential: string): Promise<VerifiedSocialIdentity> => {
  const expectedAudience = env.GOOGLE_CLIENT_ID;
  if (!expectedAudience) throw new AppError('SOCIAL_AUTH_NOT_CONFIGURED', 'Google sign-in is not configured on the server', 503);
  const payload = await verifyJwtWithJwks(
    credential,
    'https://www.googleapis.com/oauth2/v3/certs',
    ['https://accounts.google.com', 'accounts.google.com'] as [string, ...string[]],
    expectedAudience,
  );
  const providerSubject = typeof payload.sub === 'string' ? payload.sub : '';
  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
  const name = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : (typeof payload.given_name === 'string' ? `${payload.given_name} ${payload.family_name || ''}`.trim() : email.split('@')[0]) || 'Google User';
  if (!providerSubject || !email || payload.email_verified !== true) {
    throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Google account identity could not be verified', 401);
  }
  return { provider: 'GOOGLE', providerSubject, email, name, emailVerified: true };
};

const verifyMicrosoft = async (credential: string): Promise<VerifiedSocialIdentity> => {
  if (!env.MICROSOFT_AUTHORITY || !env.MICROSOFT_CLIENT_ID) {
    throw new AppError('SOCIAL_AUTH_NOT_CONFIGURED', 'Microsoft sign-in is not configured on the server', 503);
  }
  const authority = env.MICROSOFT_AUTHORITY.replace(/\/$/, '');
  const oidc = await cachedFetch<OidcConfiguration>(
    'oidc:' + authority,
    authority + '/v2.0/.well-known/openid-configuration',
    60 * 60 * 1000,
  );
  const decoded = jwt.decode(credential);
  const tokenTenant = decoded && typeof decoded === 'object' && typeof decoded.tid === 'string' ? decoded.tid : '';
  if (!tokenTenant) throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Microsoft account identity could not be verified', 401);
  const configuredTenant = env.MICROSOFT_TENANT_ID;
  const expectedIssuer = oidc.issuer.includes('{tenantid}')
    ? oidc.issuer.replace('{tenantid}', tokenTenant)
    : oidc.issuer;
  const expectedIssuers: [string, ...string[]] = [
    expectedIssuer,
    `https://login.microsoftonline.com/${tokenTenant}/v2.0`,
    `https://sts.windows.net/${tokenTenant}/`,
  ];
  const expectedAudiences: [string, ...string[]] = [
    env.MICROSOFT_CLIENT_ID,
    `api://${env.MICROSOFT_CLIENT_ID}`,
  ];
  const payload = await verifyJwtWithJwks(credential, oidc.jwks_uri, expectedIssuers, expectedAudiences);
  if (configuredTenant && !['common', 'organizations', 'consumers'].includes(configuredTenant) && payload.tid !== configuredTenant) {
    throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Microsoft tenant is not allowed', 401);
  }
  const providerSubject = typeof payload.sub === 'string' ? payload.sub : (typeof payload.oid === 'string' ? payload.oid : '');
  const candidate = typeof payload.email === 'string'
    ? payload.email
    : typeof payload.preferred_username === 'string' ? payload.preferred_username : (typeof payload.upn === 'string' ? payload.upn : '');
  const email = candidate.toLowerCase();
  const name = typeof payload.name === 'string' && payload.name.trim()
    ? payload.name.trim()
    : (email.split('@')[0] || 'Microsoft User');
  if (!providerSubject || !email) {
    throw new AppError('INVALID_SOCIAL_CREDENTIAL', 'Microsoft account identity could not be verified', 401);
  }
  return { provider: 'MICROSOFT', providerSubject, email, name, emailVerified: true };
};

export const verifySocialCredential = async (
  provider: SocialProvider,
  credential: string,
): Promise<VerifiedSocialIdentity> => {
  if (testVerifier) return testVerifier(provider, credential);
  return provider === 'GOOGLE' ? verifyGoogle(credential) : verifyMicrosoft(credential);
};
