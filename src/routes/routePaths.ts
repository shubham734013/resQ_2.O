import type { UserRole } from '../types/auth';

/**
 * Single Source of Truth for all ResQ 2.0 Route Paths.
 */
export const ROUTES = {
  PUBLIC: {
    HOME: '/',
    ABOUT: '/about',
    CONTACT: '/contact',
    HELP: '/help',
    LOGIN: '/login',
    ADMIN_LOGIN: '/admin/login',
    REGISTER: '/register',
    REGISTER_USER: '/register/user',
    REGISTER_HOSPITAL: '/hospital/register',
    REGISTER_PROVIDER: '/provider/register',
    REGISTER_PROVIDER_LEGACY: '/ambulance-provider/register',
    REGISTER_DRIVER: '/driver/register',
    REGISTER_DRIVER_LEGACY: '/ambulance-driver/register',
    FORGOT_PASSWORD: '/forgot-password',
    RESET_PASSWORD: '/reset-password',
    UNAUTHORIZED: '/unauthorized',
  },
  USER: {
    BASE: '/user',
    DASHBOARD: '/user/dashboard',
    HOSPITALS: '/user/hospitals',
    HOSPITAL_DETAIL: (id: string = ':hospitalId') => `/user/hospitals/${id}`,
    APPOINTMENTS: '/user/appointments',
    APPOINTMENT_DETAIL: (id: string = ':appointmentId') => `/user/appointments/${id}`,
    EMERGENCY: '/user/emergency',
    EMERGENCY_DETAIL: (id: string = ':requestId') => `/user/emergency/${id}`,
    AMBULANCES: '/user/ambulances',
    TRACKING: (id: string = ':requestId') => `/user/tracking/${id}`,
    HISTORY: '/user/history',
    NOTIFICATIONS: '/user/notifications',
    PROFILE: '/user/profile',
    SETTINGS: '/user/settings',
  },
  HOSPITAL: {
    BASE: '/hospital',
    DASHBOARD: '/hospital/dashboard',
    REQUESTS: '/hospital/requests',
    REQUEST_DETAIL: (id: string = ':requestId') => `/hospital/requests/${id}`,
    APPOINTMENTS: '/hospital/appointments',
    APPOINTMENT_DETAIL: (id: string = ':appointmentId') => `/hospital/appointments/${id}`,
    EMERGENCY: '/hospital/emergency',
    PATIENTS: '/hospital/patients',
    SERVICES: '/hospital/services',
    AVAILABILITY: '/hospital/availability',
    ANALYTICS: '/hospital/analytics',
    NOTIFICATIONS: '/hospital/notifications',
    PROFILE: '/hospital/profile',
    SETTINGS: '/hospital/settings',
  },
  PROVIDER: {
    BASE: '/provider',
    DASHBOARD: '/provider/dashboard',
    AMBULANCES: '/provider/ambulances',
    AMBULANCE_DETAIL: (id: string = ':ambulanceId') => `/provider/ambulances/${id}`,
    DRIVERS: '/provider/drivers',
    DRIVER_DETAIL: (id: string = ':driverId') => `/provider/drivers/${id}`,
    REQUESTS: '/provider/requests',
    REQUEST_DETAIL: (id: string = ':requestId') => `/provider/requests/${id}`,
    DISPATCH: '/provider/dispatch',
    TRIPS: '/provider/trips',
    TRIP_DETAIL: (id: string = ':tripId') => `/provider/trips/${id}`,
    ANALYTICS: '/provider/analytics',
    NOTIFICATIONS: '/provider/notifications',
    PROFILE: '/provider/profile',
    SETTINGS: '/provider/settings',
  },
  DRIVER: {
    BASE: '/driver',
    DASHBOARD: '/driver/dashboard',
    ASSIGNMENTS: '/driver/assignments',
    ASSIGNMENT_DETAIL: (id: string = ':assignmentId') => `/driver/assignments/${id}`,
    NAVIGATION: (id: string = ':assignmentId') => `/driver/navigation/${id}`,
    TRIPS: '/driver/trips',
    TRIP_DETAIL: (id: string = ':tripId') => `/driver/trips/${id}`,
    NOTIFICATIONS: '/driver/notifications',
    PROFILE: '/driver/profile',
    SETTINGS: '/driver/settings',
  },
  ADMIN: {
    BASE: '/admin',
    DASHBOARD: '/admin/dashboard',
    USERS: '/admin/users',
    USER_DETAIL: (id: string = ':userId') => `/admin/users/${id}`,
    HOSPITALS: '/admin/hospitals',
    HOSPITAL_DETAIL: (id: string = ':hospitalId') => `/admin/hospitals/${id}`,
    PROVIDERS: '/admin/providers',
    PROVIDER_DETAIL: (id: string = ':providerId') => `/admin/providers/${id}`,
    DRIVERS: '/admin/drivers',
    DRIVER_DETAIL: (id: string = ':driverId') => `/admin/drivers/${id}`,
    AMBULANCES: '/admin/ambulances',
    AMBULANCE_DETAIL: (id: string = ':ambulanceId') => `/admin/ambulances/${id}`,
    REQUESTS: '/admin/requests',
    REQUEST_DETAIL: (id: string = ':requestId') => `/admin/requests/${id}`,
    APPOINTMENTS: '/admin/appointments',
    ANALYTICS: '/admin/analytics',
    AUDIT_LOGS: '/admin/audit-logs',
    SETTINGS: '/admin/settings',
  },
} as const;

/**
 * Maps each user role to their dedicated canonical home dashboard.
 */
export const ROLE_HOMES: Record<UserRole, string> = {
  USER: ROUTES.USER.DASHBOARD,
  HOSPITAL: ROUTES.HOSPITAL.DASHBOARD,
  AMBULANCE_PROVIDER: ROUTES.PROVIDER.DASHBOARD,
  AMBULANCE_DRIVER: ROUTES.DRIVER.DASHBOARD,
  ADMIN: ROUTES.ADMIN.DASHBOARD,
};

export const getRoleHome = (role?: UserRole | null): string => {
  if (!role) return ROUTES.PUBLIC.HOME;
  return ROLE_HOMES[role] ?? ROUTES.PUBLIC.HOME;
};

/**
 * Checks whether an incoming path is permitted for a given user role.
 */
export const isPathAllowedForRole = (role: UserRole, pathname: string): boolean => {
  if (role === 'ADMIN') {
    return pathname.startsWith('/admin');
  }
  if (role === 'HOSPITAL') {
    return pathname.startsWith('/hospital');
  }
  if (role === 'AMBULANCE_PROVIDER') {
    return pathname.startsWith('/provider') || pathname.startsWith('/ambulance-provider') || pathname === '/ambulance/provider';
  }
  if (role === 'AMBULANCE_DRIVER') {
    return pathname.startsWith('/driver') || pathname.startsWith('/ambulance');
  }
  if (role === 'USER') {
    return pathname.startsWith('/user') || pathname === '/' || pathname.startsWith('/about') || pathname.startsWith('/contact') || pathname.startsWith('/help');
  }
  return false;
};
