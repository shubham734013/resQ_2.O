import bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { AuthSessionModel } from '../models/AuthSession.js';
import { ExternalIdentityModel } from '../models/ExternalIdentity.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { HospitalModel } from '../models/Hospital.js';
import { UserModel } from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { verifySocialCredential, type VerifiedSocialIdentity } from '../providers/socialIdentity.js';
import type { AuthenticatedIdentity, SocialProvider, JwtClaims } from '../types/auth.js';
import type { AccountStatus, Role, VerificationStatus } from '../types/roles.js';
import type { AmbulanceDriverRegistrationInput, AmbulanceProviderRegistrationInput, HospitalRegistrationInput, LoginInput, UserRegistrationInput, DriverProfileInput, ProviderProfileInput, UserProfileUpdateInput } from '../schemas/auth.js';

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const INVALID_CREDENTIALS = new AppError('INVALID_CREDENTIALS', 'Invalid email or password', 401);
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export interface AuthResult { user: AuthenticatedIdentity; accessToken: string; refreshToken: string; }
interface AccountWithPassword {
  id: string; email: string; name: string; passwordHash?: string; role: Role; accountStatus: AccountStatus;
  verificationStatus?: VerificationStatus; profileCompletionStatus?: 'INCOMPLETE' | 'COMPLETE'; licenseVerificationStatus?: VerificationStatus;
}
const accountFrom = (id: string, email: string, name: string, role: Role, accountStatus: AccountStatus, passwordHash?: string, extra?: Partial<AccountWithPassword>): AccountWithPassword =>
  ({ id, email, name, passwordHash, role, accountStatus, ...extra });
const publicIdentity = (account: AccountWithPassword): AuthenticatedIdentity => ({
  id: account.id, email: account.email, name: account.name, role: account.role, accountStatus: account.accountStatus,
  ...(account.verificationStatus ? { verificationStatus: account.verificationStatus } : {}),
  ...(account.profileCompletionStatus ? { profileCompletionStatus: account.profileCompletionStatus } : {}),
  ...(account.licenseVerificationStatus ? { licenseVerificationStatus: account.licenseVerificationStatus } : {}),
});

const ensureUniqueContact = async (email: string, phone: string) => {
  const normalized = normalizeEmail(email);
  const [a,b,c,d,e,f,g,h] = await Promise.all([
    UserModel.exists({ email: normalized }), HospitalModel.exists({ email: normalized }), AmbulanceProviderModel.exists({ email: normalized }), AmbulanceDriverModel.exists({ email: normalized }),
    UserModel.exists({ phone }), HospitalModel.exists({ phone }), AmbulanceProviderModel.exists({ phone }), AmbulanceDriverModel.exists({ phone }),
  ]);
  if (a||b||c||d) throw new AppError('EMAIL_ALREADY_EXISTS','An account with this email already exists',409);
  if (e||f||g||h) throw new AppError('PHONE_ALREADY_EXISTS','An account with this phone number already exists',409);
};
const ensureUniqueRegistrationNumber = async (registrationNumber: string) => {
  const [a,b] = await Promise.all([HospitalModel.exists({registrationNumber}), AmbulanceProviderModel.exists({registrationNumber})]);
  if (a||b) throw new AppError('REGISTRATION_NUMBER_ALREADY_EXISTS','Registration number is already in use',409);
};
const ensureUniqueLicenseNumber = async (licenseNumber: string) => {
  if (await AmbulanceDriverModel.exists({licenseNumber})) throw new AppError('LICENSE_NUMBER_ALREADY_EXISTS','License number is already in use',409);
};

const findUserAccountByEmail = async (email: string): Promise<AccountWithPassword|null> => {
  const a = await UserModel.findOne({email}).select('+passwordHash').exec();
  return a ? accountFrom(a._id.toString(),a.email,a.name,a.role,a.accountStatus,a.passwordHash) : null;
};
const findHospitalAccountByEmail = async (email: string): Promise<AccountWithPassword|null> => {
  const a = await HospitalModel.findOne({email}).select('+passwordHash').exec();
  return a ? accountFrom(a._id.toString(),a.email,a.name,'HOSPITAL',a.accountStatus,a.passwordHash,{verificationStatus:a.verificationStatus}) : null;
};
const findProviderAccountByEmail = async (email: string): Promise<AccountWithPassword|null> => {
  const a = await AmbulanceProviderModel.findOne({email}).select('+passwordHash').exec();
  return a ? accountFrom(a._id.toString(),a.email,a.name,'AMBULANCE_PROVIDER',a.accountStatus,a.passwordHash,{verificationStatus:a.verificationStatus,profileCompletionStatus:a.profileCompletionStatus}) : null;
};
const findDriverAccountByEmail = async (email: string): Promise<AccountWithPassword|null> => {
  const a = await AmbulanceDriverModel.findOne({email}).select('+passwordHash').exec();
  return a ? accountFrom(a._id.toString(),a.email,a.fullName,'AMBULANCE_DRIVER',a.accountStatus,a.passwordHash,{profileCompletionStatus:a.profileCompletionStatus,licenseVerificationStatus:a.licenseVerificationStatus}) : null;
};
const findAccountByEmail = async (email: string) => {
  const n = normalizeEmail(email);
  for (const finder of [findUserAccountByEmail,findHospitalAccountByEmail,findProviderAccountByEmail,findDriverAccountByEmail]) {
    const a = await finder(n); if (a) return a;
  }
  return null;
};
const findByIdentity = async (identity: AuthenticatedIdentity): Promise<AccountWithPassword|null> => {
  switch (identity.role) {
    case 'USER':
    case 'ADMIN': { const a=await UserModel.findById(identity.id).select('+passwordHash').exec(); return a?accountFrom(a._id.toString(),a.email,a.name,a.role,a.accountStatus,a.passwordHash):null; }
    case 'HOSPITAL': { const a=await HospitalModel.findById(identity.id).select('+passwordHash').exec(); return a?accountFrom(a._id.toString(),a.email,a.name,'HOSPITAL',a.accountStatus,a.passwordHash,{verificationStatus:a.verificationStatus}):null; }
    case 'AMBULANCE_PROVIDER': { const a=await AmbulanceProviderModel.findById(identity.id).select('+passwordHash').exec(); return a?accountFrom(a._id.toString(),a.email,a.name,'AMBULANCE_PROVIDER',a.accountStatus,a.passwordHash,{verificationStatus:a.verificationStatus,profileCompletionStatus:a.profileCompletionStatus}):null; }
    case 'AMBULANCE_DRIVER': { const a=await AmbulanceDriverModel.findById(identity.id).select('+passwordHash').exec(); return a?accountFrom(a._id.toString(),a.email,a.fullName,'AMBULANCE_DRIVER',a.accountStatus,a.passwordHash,{profileCompletionStatus:a.profileCompletionStatus,licenseVerificationStatus:a.licenseVerificationStatus}):null; }
  }
};

export const assertLoginAllowed = (status: AccountStatus) => {
  if (status === 'SUSPENDED') throw new AppError('ACCOUNT_SUSPENDED','This account is suspended',403);
  if (status === 'REJECTED') throw new AppError('ACCOUNT_REJECTED','This account has been rejected',403);
  if (status === 'PENDING') throw new AppError('ACCOUNT_PENDING','This account is awaiting approval',403);
  if (status !== 'ACTIVE') throw new AppError('UNAUTHORIZED','Account is not active',401);
};

const signAccessToken = (identity: AuthenticatedIdentity) => jwt.sign({
  sub:identity.id,email:identity.email,name:identity.name,role:identity.role,accountStatus:identity.accountStatus,
  verificationStatus:identity.verificationStatus,profileCompletionStatus:identity.profileCompletionStatus,licenseVerificationStatus:identity.licenseVerificationStatus,type:'access'
},env.JWT_SECRET,{expiresIn:ACCESS_TOKEN_TTL_SECONDS});
const signRefreshToken = (identity: AuthenticatedIdentity, tokenId: string) => jwt.sign({
  sub:identity.id,email:identity.email,name:identity.name,role:identity.role,accountStatus:identity.accountStatus,
  verificationStatus:identity.verificationStatus,profileCompletionStatus:identity.profileCompletionStatus,licenseVerificationStatus:identity.licenseVerificationStatus,type:'refresh',jti:tokenId
},env.JWT_REFRESH_SECRET,{expiresIn:REFRESH_TOKEN_TTL_SECONDS});

const verifyToken = (token:string,secret:string,type:'access'|'refresh'):JwtClaims => {
  try {
    const d=jwt.verify(token,secret); if(typeof d==='string') throw new Error();
    const p=d as JwtPayload & Partial<JwtClaims>;
    if(typeof p.sub!=='string'||typeof p.email!=='string'||typeof p.role!=='string'||typeof p.accountStatus!=='string'||p.type!==type) throw new Error();
    return {
      sub:p.sub,email:p.email,name:typeof p.name==='string'?p.name:undefined,role:p.role as Role,accountStatus:p.accountStatus as AccountStatus,type,
      verificationStatus:p.verificationStatus,profileCompletionStatus:p.profileCompletionStatus,licenseVerificationStatus:p.licenseVerificationStatus,
      ...(typeof p.jti==='string'?{jti:p.jti}:{}),
    };
  } catch(error:unknown) {
    if(error instanceof jwt.TokenExpiredError) throw new AppError('TOKEN_EXPIRED','Authentication token has expired',401);
    throw new AppError('INVALID_TOKEN','Authentication token is invalid',401);
  }
};

const createAuthResult = async (account:AccountWithPassword):Promise<AuthResult> => {
  const user=publicIdentity(account); const tokenId=randomUUID(); const accessToken=signAccessToken(user); const refreshToken=signRefreshToken(user,tokenId);
  await AuthSessionModel.create({accountId:user.id,role:user.role,tokenId,tokenHash:hashToken(refreshToken),expiresAt:new Date(Date.now()+REFRESH_TOKEN_TTL_SECONDS*1000)});
  return {user,accessToken,refreshToken};
};

const identityFromDocument=(doc:{_id:{toString():string};email:string;name?:string;accountStatus:AccountStatus},role:Role):AuthenticatedIdentity =>
  publicIdentity(accountFrom(doc._id.toString(),doc.email,doc.name??doc.email,role,doc.accountStatus));

export const registerUser=async(input:UserRegistrationInput):Promise<AuthResult>=>{
  await ensureUniqueContact(input.email,input.phone); const passwordHash=await bcrypt.hash(input.password,BCRYPT_ROUNDS);
  const normalized=normalizeEmail(input.email);
  const a=await UserModel.create({...input,email:normalized,passwordHash,role:'USER',accountStatus:'ACTIVE',authProvider:'LOCAL',savedFacilityIds:[]});
  return createAuthResult(accountFrom(a._id.toString(),a.email,a.name,'USER','ACTIVE',passwordHash));
};
export const registerHospital=async(input:HospitalRegistrationInput)=>{
  await ensureUniqueContact(input.email,input.phone); await ensureUniqueRegistrationNumber(input.registrationNumber); const passwordHash=await bcrypt.hash(input.password,BCRYPT_ROUNDS);
  const location = (typeof input.latitude === 'number' && typeof input.longitude === 'number')
    ? { type: 'Point' as const, coordinates: [input.longitude, input.latitude] as [number, number] }
    : undefined;
  const a=await HospitalModel.create({
    ...input,
    email:normalizeEmail(input.email),
    passwordHash,
    verificationStatus:'PENDING',
    accountStatus:'PENDING',
    ...(location ? { location } : {}),
  });
  return identityFromDocument(a,'HOSPITAL');
};
export const registerAmbulanceProvider=async(input:AmbulanceProviderRegistrationInput)=>{
  await ensureUniqueContact(input.email,input.phone); await ensureUniqueRegistrationNumber(input.registrationNumber); const passwordHash=await bcrypt.hash(input.password,BCRYPT_ROUNDS);
  const a=await AmbulanceProviderModel.create({...input,email:normalizeEmail(input.email),passwordHash,verificationStatus:'PENDING',accountStatus:'PENDING',profileCompletionStatus:'COMPLETE',authProvider:'LOCAL'}); return identityFromDocument(a,'AMBULANCE_PROVIDER');
};
export const registerAmbulanceDriver=async(input:AmbulanceDriverRegistrationInput)=>{
  await ensureUniqueContact(input.email,input.phone); await ensureUniqueLicenseNumber(input.licenseNumber);
  if(!await AmbulanceProviderModel.exists({_id:input.providerId})) throw new AppError('PROVIDER_NOT_FOUND','Ambulance provider was not found',404);
  const provider = await AmbulanceProviderModel.findOne({_id:input.providerId,accountStatus:'ACTIVE',verificationStatus:'VERIFIED'}).lean().exec();
  if(!provider) throw new AppError('PROVIDER_NOT_OPERATIONAL','Driver cannot be registered against an inactive or unverified provider',409);
  if (input.assignedAmbulanceId) {
    const ambulance = await AmbulanceModel.findOne({ _id: input.assignedAmbulanceId, providerId: input.providerId }).lean().exec();
    if (!ambulance) throw new AppError('AMBULANCE_NOT_FOUND', 'Assigned ambulance does not exist or does not belong to the selected provider', 404);
  }
  const passwordHash=await bcrypt.hash(input.password,BCRYPT_ROUNDS);
  const a=await AmbulanceDriverModel.create({...input,email:normalizeEmail(input.email),passwordHash,licenseVerificationStatus:'PENDING',accountStatus:'PENDING',profileCompletionStatus:'COMPLETE',authProvider:'LOCAL'}); return identityFromDocument(a,'AMBULANCE_DRIVER');
};

export const login=async(input:LoginInput)=>{
  // If the sign-in form selected a role, authenticate against that account collection
  // rather than silently taking a same-email account from another role.
  const a = input.roleHint ? await ({
    USER: findUserAccountByEmail,
    HOSPITAL: findHospitalAccountByEmail,
    AMBULANCE_PROVIDER: findProviderAccountByEmail,
    AMBULANCE_DRIVER: findDriverAccountByEmail,
  }[input.roleHint])(normalizeEmail(input.email)) : await findAccountByEmail(input.email);
  if(!a||!a.passwordHash)throw INVALID_CREDENTIALS;
  if(!(await bcrypt.compare(input.password,a.passwordHash)))throw INVALID_CREDENTIALS;
  assertLoginAllowed(a.accountStatus);
  return createAuthResult(a);
};
export const adminLogin=async(input:LoginInput)=>{if(normalizeEmail(input.email)!==normalizeEmail(env.RESQ_ADMIN_EMAIL))throw INVALID_CREDENTIALS;const a=await findUserAccountByEmail(input.email);if(!a||a.role!=='ADMIN'||!a.passwordHash)throw INVALID_CREDENTIALS;if(!(await bcrypt.compare(input.password,a.passwordHash)))throw INVALID_CREDENTIALS;assertLoginAllowed(a.accountStatus);return createAuthResult(a);};

const createSocialAccount = async (identity: VerifiedSocialIdentity, role: 'USER' | 'AMBULANCE_PROVIDER'): Promise<AccountWithPassword> => {
  const normalized = normalizeEmail(identity.email);
  if (role === 'USER') {
    const a = await UserModel.create({
      name: identity.name,
      email: normalized,
      authProvider: identity.provider,
      providerSubject: identity.providerSubject,
      role: 'USER',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      savedFacilityIds: [],
    });
    return accountFrom(a._id.toString(), a.email, a.name, 'USER', 'ACTIVE');
  }
  const registrationNumber = 'SOCIAL-' + randomUUID();
  const a = await AmbulanceProviderModel.create({
    name: identity.name,
    email: normalized,
    phone: '',
    passwordHash: undefined,
    authProvider: identity.provider,
    providerSubject: identity.providerSubject,
    registrationNumber,
    serviceType: '',
    profileCompletionStatus: 'INCOMPLETE',
    verificationStatus: 'PENDING',
    accountStatus: 'PENDING',
  });
  return accountFrom(a._id.toString(), a.email, a.name, 'AMBULANCE_PROVIDER', 'PENDING', undefined, {
    verificationStatus: 'PENDING',
    profileCompletionStatus: 'INCOMPLETE',
  });
};

export const socialLogin = async (
  provider: SocialProvider,
  credential: string,
  roleHint: 'USER' | 'AMBULANCE_PROVIDER' = 'USER',
) => {
  const verified = await verifySocialCredential(provider, credential);
  const normalizedEmail = normalizeEmail(verified.email);

  // 1. Check if external identity is already registered
  const linked = await ExternalIdentityModel.findOne({ provider, providerSubject: verified.providerSubject }).exec();
  if (linked) {
    let account = await findByIdentity({ id: linked.accountId, email: linked.email, role: linked.role, accountStatus: 'ACTIVE' });
    if (!account) {
      account = await findAccountByEmail(normalizedEmail);
      if (account) {
        linked.accountId = account.id;
        linked.email = account.email;
        linked.role = account.role;
        await linked.save();
      }
    }
    if (!account) throw new AppError('SOCIAL_ACCOUNT_NOT_FOUND', 'The linked ResQ account could not be found', 401);
    assertLoginAllowed(account.accountStatus);
    return createAuthResult(account);
  }

  // 2. Check legacy user linkage
  const legacyUser = await UserModel.findOne({ authProvider: provider, providerSubject: verified.providerSubject }).select('+passwordHash').exec();
  if (legacyUser) {
    const account = accountFrom(legacyUser._id.toString(), legacyUser.email, legacyUser.name, legacyUser.role, legacyUser.accountStatus, legacyUser.passwordHash);
    await ExternalIdentityModel.create({ provider, providerSubject: verified.providerSubject, accountId: account.id, role: account.role, email: account.email }).catch(() => null);
    assertLoginAllowed(account.accountStatus);
    return createAuthResult(account);
  }

  // 3. Deterministic linking to existing account with same verified email
  const existing = await findAccountByEmail(normalizedEmail);
  if (existing) {
    try {
      await ExternalIdentityModel.findOneAndUpdate(
        { provider, providerSubject: verified.providerSubject },
        { provider, providerSubject: verified.providerSubject, accountId: existing.id, role: existing.role, email: existing.email },
        { upsert: true, new: true },
      ).exec();
    } catch {
      // Ignore concurrent upsert collision
    }
    if (existing.role === 'USER') {
      await UserModel.updateOne({ _id: existing.id }, { $set: { emailVerified: true } }).exec();
    }
    assertLoginAllowed(existing.accountStatus);
    return createAuthResult(existing);
  }

  // 4. New user onboarding via social sign-in
  try {
    const account = await createSocialAccount({ ...verified, email: normalizedEmail }, roleHint);
    await ExternalIdentityModel.create({
      provider,
      providerSubject: verified.providerSubject,
      accountId: account.id,
      role: account.role,
      email: normalizedEmail,
    });
    assertLoginAllowed(account.accountStatus);
    return createAuthResult(account);
  } catch (error: unknown) {
    const raceAccount = await findAccountByEmail(normalizedEmail);
    if (raceAccount) {
      await ExternalIdentityModel.findOneAndUpdate(
        { provider, providerSubject: verified.providerSubject },
        { provider, providerSubject: verified.providerSubject, accountId: raceAccount.id, role: raceAccount.role, email: raceAccount.email },
        { upsert: true, new: true },
      ).exec();
      assertLoginAllowed(raceAccount.accountStatus);
      return createAuthResult(raceAccount);
    }
    throw error;
  }
};
export const linkSocialAccount=async(identity:AuthenticatedIdentity,provider:SocialProvider,credential:string)=>{
  const account=await findByIdentity(identity);if(!account)throw new AppError('UNAUTHORIZED','Authenticated account was not found',401);const verified=await verifySocialCredential(provider,credential);if(verified.email!==account.email)throw new AppError('ACCOUNT_LINKING_REQUIRED','The verified provider email must match your ResQ account email',409);
  const occupied=await ExternalIdentityModel.findOne({provider,providerSubject:verified.providerSubject}).exec();if(occupied&&occupied.accountId!==account.id)throw new AppError('SOCIAL_IDENTITY_ALREADY_LINKED','This provider identity is already linked to another ResQ account',409);
  const existingForAccount=await ExternalIdentityModel.findOne({accountId:account.id,provider}).exec();if(existingForAccount&&existingForAccount.providerSubject!==verified.providerSubject)throw new AppError('PROVIDER_ALREADY_LINKED','Another identity for this provider is already linked',409);
  if(!occupied)await ExternalIdentityModel.create({provider,providerSubject:verified.providerSubject,accountId:account.id,role:account.role,email:account.email});return publicIdentity(account);
};

const driverFieldsComplete=(d:Partial<DriverProfileInput>) => Boolean(d.fullName&&d.phone&&d.licenseNumber&&d.address&&d.city&&d.state&&d.country&&typeof d.registeredLatitude==='number'&&typeof d.registeredLongitude==='number');
export const updateDriverProfile=async(identity:AuthenticatedIdentity,input:DriverProfileInput)=>{
  if(identity.role!=='AMBULANCE_DRIVER')throw new AppError('FORBIDDEN','Only drivers can update driver profiles',403);const a=await AmbulanceDriverModel.findById(identity.id).exec();if(!a)throw new AppError('UNAUTHORIZED','Driver account was not found',401);
  if(await AmbulanceDriverModel.exists({licenseNumber:input.licenseNumber,_id:{$ne:a._id}}))throw new AppError('LICENSE_NUMBER_ALREADY_EXISTS','License number is already in use',409);
  a.fullName=input.fullName;a.phone=input.phone;a.licenseNumber=input.licenseNumber;a.address=input.address;a.city=input.city;a.state=input.state;a.country=input.country;a.registeredLatitude=input.registeredLatitude;a.registeredLongitude=input.registeredLongitude;a.profileCompletionStatus=driverFieldsComplete(input)?'COMPLETE':'INCOMPLETE';await a.save();
  return publicIdentity(accountFrom(a._id.toString(),a.email,a.fullName,'AMBULANCE_DRIVER',a.accountStatus,undefined,{profileCompletionStatus:a.profileCompletionStatus,licenseVerificationStatus:a.licenseVerificationStatus}));
};
export const updateProviderProfile=async(identity:AuthenticatedIdentity,input:ProviderProfileInput)=>{
  if(identity.role!=='AMBULANCE_PROVIDER')throw new AppError('FORBIDDEN','Only providers can update provider profiles',403);const a=await AmbulanceProviderModel.findById(identity.id).exec();if(!a)throw new AppError('UNAUTHORIZED','Provider account was not found',401);
  const duplicate=await AmbulanceProviderModel.findOne({registrationNumber:input.registrationNumber,_id:{$ne:a._id}}).exec();if(duplicate)throw new AppError('REGISTRATION_NUMBER_ALREADY_EXISTS','Registration number is already in use',409);
  a.name=input.name;a.phone=input.phone;a.registrationNumber=input.registrationNumber;a.serviceType=input.serviceType;a.address=input.address;a.city=input.city;a.state=input.state;a.country=input.country;a.latitude=input.latitude;a.longitude=input.longitude;a.profileCompletionStatus='COMPLETE';await a.save();
  return publicIdentity(accountFrom(a._id.toString(),a.email,a.name,'AMBULANCE_PROVIDER',a.accountStatus,undefined,{verificationStatus:a.verificationStatus,profileCompletionStatus:'COMPLETE'}));
};

export const getUserProfile=async(identity:AuthenticatedIdentity)=>{
  if(identity.role!=='USER')throw new AppError('FORBIDDEN','Only users can access the user profile',403);
  const user=await UserModel.findById(identity.id).select('-passwordHash').lean().exec();if(!user)throw new AppError('UNAUTHORIZED','User account was not found',401);
  return {id:String(user._id),name:user.name,email:user.email,phone:user.phone,address:user.address,city:user.city,state:user.state,country:user.country,latitude:user.latitude,longitude:user.longitude,createdAt:user.createdAt,updatedAt:user.updatedAt};
};

export const updateUserProfile=async(identity:AuthenticatedIdentity,input:UserProfileUpdateInput)=>{
  if(identity.role!=='USER')throw new AppError('FORBIDDEN','Only users can update the user profile',403);
  const user=await UserModel.findById(identity.id).exec();if(!user)throw new AppError('UNAUTHORIZED','User account was not found',401);
  if(input.phone&&input.phone!==user.phone&&await UserModel.exists({phone:input.phone,_id:{$ne:user._id}}))throw new AppError('PHONE_ALREADY_EXISTS','Phone number is already in use',409);
  const update={...input};Object.assign(user,update);await user.save();
  return getUserProfile(identity);
};

export const authenticateAccessToken=async(token:string)=>{
  const c=verifyToken(token,env.JWT_SECRET,'access');const identity:AuthenticatedIdentity={id:c.sub,email:c.email,name:c.name??c.email,role:c.role,accountStatus:c.accountStatus,verificationStatus:c.verificationStatus,profileCompletionStatus:c.profileCompletionStatus,licenseVerificationStatus:c.licenseVerificationStatus};
  const account=await findByIdentity(identity);if(!account||account.email!==identity.email||account.role!==identity.role)throw new AppError('INVALID_TOKEN','Authentication token is invalid',401);assertLoginAllowed(account.accountStatus);return publicIdentity(account);
};
export const refreshAuthentication=async(refreshToken:string)=>{
  const c=verifyToken(refreshToken,env.JWT_REFRESH_SECRET,'refresh');if(!c.jti)throw new AppError('INVALID_TOKEN','Refresh token is invalid',401);const s=await AuthSessionModel.findOne({tokenId:c.jti}).select('+tokenHash').exec();if(!s||s.tokenHash!==hashToken(refreshToken))throw new AppError('INVALID_TOKEN','Refresh token is invalid',401);
  const account=await findByIdentity({id:c.sub,email:c.email,name:c.name??c.email,role:c.role,accountStatus:c.accountStatus});if(!account)throw new AppError('INVALID_TOKEN','Refresh token is invalid',401);assertLoginAllowed(account.accountStatus);await AuthSessionModel.deleteOne({_id:s._id}).exec();return createAuthResult(account);
};
export const logout=async(refreshToken:string|undefined)=>{if(!refreshToken)return;try{const c=verifyToken(refreshToken,env.JWT_REFRESH_SECRET,'refresh');if(c.jti)await AuthSessionModel.deleteOne({tokenId:c.jti}).exec();}catch(error:unknown){void error;}};
export const getCurrentUser=async(identity:AuthenticatedIdentity)=>{const a=await findByIdentity(identity);if(!a)throw new AppError('UNAUTHORIZED','Authenticated account was not found',401);return publicIdentity(a);};
