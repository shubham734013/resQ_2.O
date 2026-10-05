import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { AuthSessionModel } from '../models/AuthSession.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { HospitalModel } from '../models/Hospital.js';
import { UserModel } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import type { AuthenticatedIdentity, JwtClaims } from '../types/auth.js';
import type { AccountStatus, Role } from '../types/roles.js';
import type {
  AmbulanceDriverRegistrationInput,
  AmbulanceProviderRegistrationInput,
  HospitalRegistrationInput,
  LoginInput,
  UserRegistrationInput,
} from '../schemas/auth.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const INVALID_CREDENTIALS = new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);

const normalizeEmail = (email: string): string => email.trim().toLowerCase();
const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export interface AuthResult {
  user: AuthenticatedIdentity;
  accessToken: string;
  refreshToken: string;
}

interface AccountWithPassword {
  _id: { toString(): string };
  email: string;
  passwordHash: string;
  role: Role;
  accountStatus: AccountStatus;
}

const accountModels = [UserModel, HospitalModel, AmbulanceProviderModel, AmbulanceDriverModel] as const;

const ensureUniqueContact = async (email: string, phone: string): Promise<void> => {
  const normalizedEmail = normalizeEmail(email);
  const [emailMatches, phoneMatches] = await Promise.all([
    Promise.all(accountModels.map((model) => model.exists({ email: normalizedEmail }))),
    Promise.all(accountModels.map((model) => model.exists({ phone }))),
  ]);

  if (emailMatches.some(Boolean)) throw new AppError('EMAIL_ALREADY_EXISTS', 'An account with this email already exists', 409);
  if (phoneMatches.some(Boolean)) throw new AppError('PHONE_ALREADY_EXISTS', 'An account with this phone number already exists', 409);
};

const ensureUniqueRegistrationNumber = async (registrationNumber: string): Promise<void> => {
  const [hospital, provider] = await Promise.all([
    HospitalModel.exists({ registrationNumber }),
    AmbulanceProviderModel.exists({ registrationNumber }),
  ]);
  if (hospital || provider) {
    throw new AppError('REGISTRATION_NUMBER_ALREADY_EXISTS', 'Registration number is already in use', 409);
  }
};

const ensureUniqueLicenseNumber = async (licenseNumber: string): Promise<void> => {
  if (await AmbulanceDriverModel.exists({ licenseNumber })) {
    throw new AppError('LICENSE_NUMBER_ALREADY_EXISTS', 'License number is already in use', 409);
  }
};

const publicIdentity = (account: AccountWithPassword | { _id: { toString(): string }; email: string; role: Role; accountStatus: AccountStatus }): AuthenticatedIdentity => ({
  id: account._id.toString(),
  email: account.email,
  role: account.role,
  accountStatus: account.accountStatus,
});

const findAccountByEmail = async (email: string): Promise<AccountWithPassword | null> => {
  const normalizedEmail = normalizeEmail(email);
  for (const model of accountModels) {
    const account = await model.findOne({ email: normalizedEmail }).select('+passwordHash').exec();
    if (account) return account as unknown as AccountWithPassword;
  }
  return null;
};

const findAccountByIdentity = async (identity: AuthenticatedIdentity): Promise<AccountWithPassword | null> => {
  const model = identity.role === 'USER' || identity.role === 'ADMIN'
    ? UserModel
    : identity.role === 'HOSPITAL'
      ? HospitalModel
      : identity.role === 'AMBULANCE_PROVIDER'
        ? AmbulanceProviderModel
        : AmbulanceDriverModel;

  const account = await model.findById(identity.id).select('+passwordHash').exec();
  return account as unknown as AccountWithPassword | null;
};

const assertLoginAllowed = (status: AccountStatus): void => {
  if (status === 'SUSPENDED') throw new AppError('ACCOUNT_SUSPENDED', 'This account is suspended', 403);
  if (status === 'REJECTED') throw new AppError('ACCOUNT_REJECTED', 'This account has been rejected', 403);
  if (status === 'PENDING') throw new AppError('ACCOUNT_PENDING', 'This account is pending operational approval', 403);
  if (status !== 'ACTIVE') throw new AppError('UNAUTHORIZED', 'Account is not active', 401);
};

const signAccessToken = (identity: AuthenticatedIdentity): string => jwt.sign({
  sub: identity.id,
  email: identity.email,
  role: identity.role,
  accountStatus: identity.accountStatus,
  type: 'access',
}, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL_SECONDS });

const signRefreshToken = (identity: AuthenticatedIdentity, tokenId: string): string => jwt.sign({
  sub: identity.id,
  email: identity.email,
  role: identity.role,
  accountStatus: identity.accountStatus,
  type: 'refresh',
  jti: tokenId,
}, env.JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });

const verifyToken = (token: string, secret: string, expectedType: 'access' | 'refresh'): JwtClaims => {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string') throw new Error('Invalid token payload');

    const payload = decoded as JwtPayload & Partial<JwtClaims>;
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.accountStatus !== 'string' ||
      payload.type !== expectedType
    ) {
      throw new Error('Invalid token payload');
    }

    return {
      sub: payload.sub,
      email: payload.email,
      role: payload.role as Role,
      accountStatus: payload.accountStatus as AccountStatus,
      type: expectedType,
      ...(typeof payload.jti === 'string' ? { jti: payload.jti } : {}),
    };
  } catch (error: unknown) {
    if (error instanceof jwt.TokenExpiredError) throw new AppError('TOKEN_EXPIRED', 'Authentication token has expired', 401);
    throw new AppError('INVALID_TOKEN', 'Authentication token is invalid', 401);
  }
};

const createAuthResult = async (account: AccountWithPassword): Promise<AuthResult> => {
  const user = publicIdentity(account);
  const tokenId = randomUUID();
  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user, tokenId);

  await AuthSessionModel.create({
    accountId: user.id,
    role: user.role,
    tokenId,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
  });

  return { user, accessToken, refreshToken };
};

export const registerUser = async (input: UserRegistrationInput): Promise<AuthenticatedIdentity> => {
  await ensureUniqueContact(input.email, input.phone);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const account = await UserModel.create({ ...input, email: normalizeEmail(input.email), passwordHash, role: 'USER', accountStatus: 'ACTIVE' });
  return publicIdentity(account as unknown as AccountWithPassword);
};

export const registerHospital = async (input: HospitalRegistrationInput): Promise<AuthenticatedIdentity> => {
  await ensureUniqueContact(input.email, input.phone);
  await ensureUniqueRegistrationNumber(input.registrationNumber);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const account = await HospitalModel.create({
    ...input,
    email: normalizeEmail(input.email),
    passwordHash,
    verificationStatus: 'PENDING',
    accountStatus: 'PENDING',
    resourceSummary: {},
  });
  return publicIdentity(account as unknown as AccountWithPassword);
};

export const registerAmbulanceProvider = async (input: AmbulanceProviderRegistrationInput): Promise<AuthenticatedIdentity> => {
  await ensureUniqueContact(input.email, input.phone);
  await ensureUniqueRegistrationNumber(input.registrationNumber);
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const account = await AmbulanceProviderModel.create({
    ...input,
    email: normalizeEmail(input.email),
    passwordHash,
    verificationStatus: 'PENDING',
    accountStatus: 'PENDING',
  });
  return publicIdentity(account as unknown as AccountWithPassword);
};

export const registerAmbulanceDriver = async (input: AmbulanceDriverRegistrationInput): Promise<AuthenticatedIdentity> => {
  await ensureUniqueContact(input.email, input.phone);
  await ensureUniqueLicenseNumber(input.licenseNumber);

  const providerExists = await AmbulanceProviderModel.exists({ _id: input.providerId });
  if (!providerExists) throw new AppError('PROVIDER_NOT_FOUND', 'Ambulance provider was not found', 404);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const account = await AmbulanceDriverModel.create({
    ...input,
    email: normalizeEmail(input.email),
    passwordHash,
    licenseVerificationStatus: 'PENDING',
    accountStatus: 'PENDING',
  });
  return publicIdentity(account as unknown as AccountWithPassword);
};

export const login = async (input: LoginInput): Promise<AuthResult> => {
  const account = await findAccountByEmail(input.email);
  if (!account) throw INVALID_CREDENTIALS;

  const passwordMatches = await bcrypt.compare(input.password, account.passwordHash);
  if (!passwordMatches) throw INVALID_CREDENTIALS;

  assertLoginAllowed(account.accountStatus);
  return createAuthResult(account);
};

export const adminLogin = async (input: LoginInput): Promise<AuthResult> => {
  if (normalizeEmail(input.email) !== normalizeEmail(env.RESQ_ADMIN_EMAIL)) throw INVALID_CREDENTIALS;

  const account = await findAccountByEmail(input.email);
  if (!account || account.role !== 'ADMIN') throw INVALID_CREDENTIALS;

  const passwordMatches = await bcrypt.compare(input.password, account.passwordHash);
  if (!passwordMatches) throw INVALID_CREDENTIALS;

  assertLoginAllowed(account.accountStatus);
  return createAuthResult(account);
};

export const authenticateAccessToken = async (token: string): Promise<AuthenticatedIdentity> => {
  const claims = verifyToken(token, env.JWT_SECRET, 'access');
  const identity: AuthenticatedIdentity = {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    accountStatus: claims.accountStatus,
  };
  const account = await findAccountByIdentity(identity);
  if (!account) throw new AppError('INVALID_TOKEN', 'Authentication token is invalid', 401);
  if (account.email !== identity.email || account.role !== identity.role) throw new AppError('INVALID_TOKEN', 'Authentication token is invalid', 401);
  assertLoginAllowed(account.accountStatus);
  return publicIdentity(account);
};

export const refreshAuthentication = async (refreshToken: string): Promise<AuthResult> => {
  const claims = verifyToken(refreshToken, env.JWT_REFRESH_SECRET, 'refresh');
  if (!claims.jti) throw new AppError('INVALID_TOKEN', 'Refresh token is invalid', 401);

  const session = await AuthSessionModel.findOne({ tokenId: claims.jti }).select('+tokenHash').exec();
  if (!session || session.tokenHash !== hashToken(refreshToken)) throw new AppError('INVALID_TOKEN', 'Refresh token is invalid', 401);

  const identity: AuthenticatedIdentity = {
    id: claims.sub,
    email: claims.email,
    role: claims.role,
    accountStatus: claims.accountStatus,
  };
  const account = await findAccountByIdentity(identity);
  if (!account) throw new AppError('INVALID_TOKEN', 'Refresh token is invalid', 401);
  assertLoginAllowed(account.accountStatus);

  await AuthSessionModel.deleteOne({ _id: session._id }).exec();
  return createAuthResult(account);
};

export const logout = async (refreshToken: string | undefined): Promise<void> => {
  if (!refreshToken) return;

  try {
    const claims = verifyToken(refreshToken, env.JWT_REFRESH_SECRET, 'refresh');
    if (claims.jti) await AuthSessionModel.deleteOne({ tokenId: claims.jti }).exec();
  } catch {
    // Logout remains idempotent even if the client presents an expired/invalid refresh token.
  }
};

export const getCurrentUser = async (identity: AuthenticatedIdentity): Promise<AuthenticatedIdentity> => {
  const account = await findAccountByIdentity(identity);
  if (!account) throw new AppError('UNAUTHORIZED', 'Authenticated account was not found', 401);
  return publicIdentity(account);
};
