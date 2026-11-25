import type { Request, Response } from 'express';

export const ACCESS_TOKEN_COOKIE = 'resq_access_token';
export const REFRESH_TOKEN_COOKIE = 'resq_refresh_token';

const isProduction = process.env.NODE_ENV === 'production';
const sameSitePolicy = isProduction
  ? ((process.env.COOKIE_SAME_SITE as 'none' | 'lax' | 'strict') || 'lax')
  : 'lax';

export const getCookieOptions = () => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: sameSitePolicy as 'lax' | 'none' | 'strict',
  path: '/',
});

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
  const options = getCookieOptions();
  res.cookie(ACCESS_TOKEN_COOKIE, accessToken, { ...options, maxAge: 15 * 60 * 1000 });
  res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...options, maxAge: 7 * 24 * 60 * 60 * 1000 });
};

export const clearAuthCookies = (res: Response): void => {
  const options = getCookieOptions();
  res.clearCookie(ACCESS_TOKEN_COOKIE, options);
  res.clearCookie(REFRESH_TOKEN_COOKIE, options);
};

export const getCookie = (req: Request, name: string): string | undefined => {
  const header = req.headers.cookie;
  if (!header) return undefined;

  const value = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return value ? decodeURIComponent(value.slice(name.length + 1)) : undefined;
};
