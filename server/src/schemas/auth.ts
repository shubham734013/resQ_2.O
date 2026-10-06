import { z } from 'zod';

export const MIN_PASSWORD_LENGTH = 8;

const baseRegistration = {
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(MIN_PASSWORD_LENGTH, 'Password must be at least 8 characters long.').max(128),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
};

export const userRegistrationSchema = z.object(baseRegistration);
export const hospitalRegistrationSchema = z.object({
  ...baseRegistration,
  registrationNumber: z.string().trim().min(2).max(80),
  hospitalType: z.string().trim().min(2).max(80),
  services: z.array(z.string().trim().min(1).max(100)).default([]),
  capabilities: z.array(z.string().trim().min(1).max(100)).default([]),
});
export const ambulanceProviderRegistrationSchema = z.object({
  ...baseRegistration,
  registrationNumber: z.string().trim().min(2).max(80),
  serviceType: z.string().trim().min(2).max(80),
});
export const ambulanceDriverRegistrationSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(MIN_PASSWORD_LENGTH, 'Password must be at least 8 characters long.').max(128),
  licenseNumber: z.string().trim().min(3).max(80),
  address: z.string().trim().max(250).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  registeredLatitude: z.number().min(-90).max(90).optional(),
  registeredLongitude: z.number().min(-180).max(180).optional(),
  providerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid providerId'),
  assignedAmbulanceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedAmbulanceId').optional(),
});
export const loginSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(128),
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
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export const driverProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().min(7).max(20),
  licenseNumber: z.string().trim().min(3).max(80),
  address: z.string().trim().min(2).max(250),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  country: z.string().trim().min(2).max(100),
  registeredLatitude: z.number().min(-90).max(90),
  registeredLongitude: z.number().min(-180).max(180),
  providerId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid providerId'),
  assignedAmbulanceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid assignedAmbulanceId').optional(),
});
export type UserRegistrationInput = z.infer<typeof userRegistrationSchema>;
export type HospitalRegistrationInput = z.infer<typeof hospitalRegistrationSchema>;
export type AmbulanceProviderRegistrationInput = z.infer<typeof ambulanceProviderRegistrationSchema>;
export type AmbulanceDriverRegistrationInput = z.infer<typeof ambulanceDriverRegistrationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type SocialAuthInput = z.infer<typeof socialAuthSchema>;
export type DriverProfileInput = z.infer<typeof driverProfileSchema>;
export type ProviderProfileInput = z.infer<typeof providerProfileSchema>;
