import { z } from 'zod';

const optionalText = (max: number) =>
  z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    return val;
  }, z.string().trim().max(max).optional());

const baseRegistration = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Invalid email address').transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 characters').max(30),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(128),
  address: optionalText(250),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  latitude: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.number().finite().min(-90).max(90).optional()),
  longitude: z.preprocess((val) => (val === '' || val === null ? undefined : val), z.number().finite().min(-180).max(180).optional()),
  role: z.string().optional(),
  roleHint: z.string().optional(),
};

export const userRegistrationSchema = z.object(baseRegistration);
export const hospitalRegistrationSchema = z.object({
  ...baseRegistration,
  registrationNumber: z.string().trim().min(2, 'Registration number is required').max(80),
  hospitalType: z.string().trim().min(2, 'Hospital type is required').max(80),
  services: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
    return val;
  }, z.array(z.string().trim().min(1).max(100)).default([])),
  capabilities: z.preprocess((val) => {
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return val.split(',').map((s) => s.trim()).filter(Boolean);
    return val;
  }, z.array(z.string().trim().min(1).max(100)).default([])),
});
export const ambulanceProviderRegistrationSchema = z.object({
  ...baseRegistration,
  registrationNumber: z.string().trim().min(2, 'Registration number is required').max(80),
  serviceType: z.string().trim().min(2, 'Service type is required').max(80),
});
export const ambulanceDriverRegistrationSchema = z.object({
  fullName: z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(2).max(100)).optional(),
  name: z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(2).max(100)).optional(),
  email: z.string().trim().email('Invalid email address').transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7, 'Phone number must be at least 7 characters').max(30),
  password: z.string().min(8, 'Password must be at least 8 characters long.').max(128),
  licenseNumber: z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().min(3).max(80)).optional(),
  license_number: z.string().optional(),
  address: optionalText(250),
  city: optionalText(100),
  state: optionalText(100),
  country: optionalText(100),
  providerId: z.preprocess((val) => (typeof val === 'string' ? val.trim() : val), z.string().regex(/^[0-9a-fA-F]{24}$/, 'Provider ID must be a 24-character hexadecimal MongoDB ID')).optional(),
  provider_id: z.string().optional(),
  assignedAmbulanceId: z.preprocess((val) => {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    }
    return val;
  }, z.string().regex(/^[0-9a-fA-F]{24}$/, 'Assigned ambulance ID must be a 24-character hexadecimal MongoDB ID').optional()),
  assigned_ambulance_id: z.string().optional(),
  role: z.string().optional(),
  roleHint: z.string().optional(),
}).transform((data) => {
  const resolvedFullName = (data.fullName || data.name || '').trim();
  const resolvedLicense = (data.licenseNumber || data.license_number || '').trim();
  const resolvedProviderId = (data.providerId || data.provider_id || '').trim();
  const resolvedAmbulanceId = data.assignedAmbulanceId || (data.assigned_ambulance_id?.trim() || undefined);
  return {
    ...data,
    fullName: resolvedFullName,
    licenseNumber: resolvedLicense,
    providerId: resolvedProviderId,
    assignedAmbulanceId: resolvedAmbulanceId,
  };
}).superRefine((data, ctx) => {
  if (!data.fullName || data.fullName.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Full name is required and must be at least 2 characters', path: ['fullName'] });
  }
  if (!data.licenseNumber || data.licenseNumber.length < 3) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'License number is required and must be at least 3 characters', path: ['licenseNumber'] });
  }
  if (!data.providerId || !/^[0-9a-fA-F]{24}$/.test(data.providerId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Provider ID is required and must be a 24-character hex ID', path: ['providerId'] });
  }
});
export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
  roleHint: z.enum(['USER', 'HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER']).optional(),
});
export const socialAuthSchema = z.object({
  credential: z.string().min(20).max(10000),
  roleHint: z.enum(['USER', 'AMBULANCE_PROVIDER']).optional(),
});
export const providerProfileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  registrationNumber: z.string().trim().min(2).max(80),
  serviceType: z.string().trim().min(2).max(80),
  address: z.string().trim().min(2).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});
export const driverProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  licenseNumber: z.string().trim().min(3).max(80),
  address: z.string().trim().min(2).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100),
  registeredLatitude: z.number().finite().min(-90).max(90),
  registeredLongitude: z.number().finite().min(-180).max(180),
}).strict();

// Password reset schemas
export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').transform((v) => v.toLowerCase()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(64, 'Reset token is required').max(128),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export const userProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().min(7).max(20).optional(),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
}).strict();

export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type HospitalRegistrationInput = z.infer<typeof hospitalRegistrationSchema>;
export type AmbulanceProviderRegistrationInput = z.infer<typeof ambulanceProviderRegistrationSchema>;
export type AmbulanceDriverRegistrationInput = z.infer<typeof ambulanceDriverRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
export type DriverProfileInput = z.infer<typeof driverProfileSchema>;
export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;
export type UserProfileUpdateInput = z.infer<typeof userProfileUpdateSchema>;
