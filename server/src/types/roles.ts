export const ROLES = ['USER', 'HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

export const ACCOUNT_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'REJECTED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
