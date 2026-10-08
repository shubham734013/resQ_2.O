import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../services/adminApi';
import type { AdminAccountStatus, AdminListParams, AdminVerificationStatus } from '../types/adminManagement';

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  users: (p: AdminListParams) => ['admin', 'users', p] as const,
  user: (id: string) => ['admin', 'user', id] as const,
  hospitals: (p: AdminListParams) => ['admin', 'hospitals', p] as const,
  hospital: (id: string) => ['admin', 'hospital', id] as const,
  providers: (p: AdminListParams) => ['admin', 'providers', p] as const,
  provider: (id: string) => ['admin', 'provider', id] as const,
  ambulances: (p: AdminListParams) => ['admin', 'ambulances', p] as const,
  ambulance: (id: string) => ['admin', 'ambulance', id] as const,
  emergencies: (p: Parameters<typeof adminApi.emergencies>[0]) => ['admin','emergencies',p] as const,
  emergency: (id:string) => ['admin','emergency',id] as const,
  drivers: (p: AdminListParams) => ['admin', 'drivers', p] as const,
  driver: (id: string) => ['admin', 'driver', id] as const,
  reportsOverview: (p:{from?:string;to?:string}) => ['admin','reports','overview',p] as const,
  reportsEmergencies: (p:{from?:string;to?:string}) => ['admin','reports','emergencies',p] as const,
  reportsAnalytics: (p:{from?:string;to?:string}) => ['admin','reports','analytics',p] as const,
};

export const useAdminOverview = () => useQuery({ queryKey: adminKeys.overview, queryFn: adminApi.overview });
export const useAdminUsers = (params: AdminListParams) => useQuery({ queryKey: adminKeys.users(params), queryFn: () => adminApi.users(params) });
export const useAdminUser = (id: string) => useQuery({ queryKey: adminKeys.user(id), queryFn: () => adminApi.user(id), enabled: Boolean(id) });
export const useAdminHospitals = (params: AdminListParams) => useQuery({ queryKey: adminKeys.hospitals(params), queryFn: () => adminApi.hospitals(params) });
export const useAdminHospital = (id: string) => useQuery({ queryKey: adminKeys.hospital(id), queryFn: () => adminApi.hospital(id), enabled: Boolean(id) });
export const useAdminProviders = (params: AdminListParams) => useQuery({ queryKey: adminKeys.providers(params), queryFn: () => adminApi.providers(params) });
export const useAdminProvider = (id: string) => useQuery({ queryKey: adminKeys.provider(id), queryFn: () => adminApi.provider(id), enabled: Boolean(id) });
export const useAdminAmbulances = (params: AdminListParams) => useQuery({ queryKey: adminKeys.ambulances(params), queryFn: () => adminApi.ambulances(params) });
export const useAdminAmbulance = (id: string) => useQuery({ queryKey: adminKeys.ambulance(id), queryFn: () => adminApi.ambulance(id), enabled: Boolean(id) });

export const useUpdateAmbulanceVerification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, verificationStatus }: { id:string; verificationStatus: AdminVerificationStatus }) => adminApi.ambulanceVerification(id, verificationStatus),
    onSuccess: (_, variables) => { void qc.invalidateQueries({ queryKey: adminKeys.ambulance(variables.id) }); void qc.invalidateQueries({ queryKey: ['admin','ambulances'] }); void qc.invalidateQueries({ queryKey: adminKeys.overview }); },
  });
};
export const useUpdateAmbulanceStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id:string; status: Extract<AdminAccountStatus,'ACTIVE'|'SUSPENDED'|'REJECTED'> }) => adminApi.ambulanceStatus(id, status),
    onSuccess: (_, variables) => { void qc.invalidateQueries({ queryKey: adminKeys.ambulance(variables.id) }); void qc.invalidateQueries({ queryKey: ['admin','ambulances'] }); void qc.invalidateQueries({ queryKey: adminKeys.overview }); },
  });
};export const useAdminEmergencies = (params: Parameters<typeof adminApi.emergencies>[0]) => useQuery({ queryKey: adminKeys.emergencies(params), queryFn: () => adminApi.emergencies(params), refetchInterval: 15_000, staleTime: 5_000 });
export const useAdminEmergency = (id:string) => useQuery({ queryKey: adminKeys.emergency(id), queryFn: () => adminApi.emergency(id), enabled:Boolean(id), refetchInterval:15_000, staleTime:5_000 });
export const useAdminDrivers = (params: AdminListParams) => useQuery({ queryKey: adminKeys.drivers(params), queryFn: () => adminApi.drivers(params) });
export const useAdminDriver = (id: string) => useQuery({ queryKey: adminKeys.driver(id), queryFn: () => adminApi.driver(id), enabled: Boolean(id) });

function useAdminMutation<TVariables>(fn: (variables: TVariables) => Promise<unknown>, invalidate: (qc: ReturnType<typeof useQueryClient>, variables: TVariables) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (_data, variables) => invalidate(qc, variables) });
}

export const useUpdateUserStatus = () => useAdminMutation(({ id, status }: { id: string; status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'> }) => adminApi.userStatus(id, status), async (qc, v) => { await qc.invalidateQueries({ queryKey: ['admin', 'users'] }); await qc.invalidateQueries({ queryKey: adminKeys.user(v.id) }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });
export const useUpdateHospitalVerification = () => useAdminMutation(({ id, verificationStatus }: { id: string; verificationStatus: AdminVerificationStatus }) => adminApi.hospitalVerification(id, verificationStatus), async (qc, v) => { await qc.invalidateQueries({ queryKey: ['admin', 'hospitals'] }); await qc.invalidateQueries({ queryKey: adminKeys.hospital(v.id) }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });
export const useUpdateHospitalStatus = () => useAdminMutation(({ id, status }: { id: string; status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'> }) => adminApi.hospitalStatus(id, status), async (qc, v) => { await qc.invalidateQueries({ queryKey: ['admin', 'hospitals'] }); await qc.invalidateQueries({ queryKey: adminKeys.hospital(v.id) }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });
export const useUpdateProviderVerification = () => useAdminMutation(({ id, verificationStatus }: { id: string; verificationStatus: AdminVerificationStatus }) => adminApi.providerVerification(id, verificationStatus), async (qc, v) => { await qc.invalidateQueries({ queryKey: ['admin', 'providers'] }); await qc.invalidateQueries({ queryKey: adminKeys.provider(v.id) }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });
export const useUpdateProviderStatus = () => useAdminMutation(({ id, status }: { id: string; status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'> }) => adminApi.providerStatus(id, status), async (qc) => { await qc.invalidateQueries({ queryKey: ['admin', 'providers'] }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });
export const useUpdateDriverVerification = () => useAdminMutation(({ id, verificationStatus }: { id: string; verificationStatus: AdminVerificationStatus }) => adminApi.driverVerification(id, verificationStatus), async (qc, v) => { await qc.invalidateQueries({ queryKey: ['admin', 'drivers'] }); await qc.invalidateQueries({ queryKey: adminKeys.driver(v.id) }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });
export const useUpdateDriverStatus = () => useAdminMutation(({ id, status }: { id: string; status: Extract<AdminAccountStatus, 'ACTIVE' | 'SUSPENDED' | 'REJECTED'> }) => adminApi.driverStatus(id, status), async (qc) => { await qc.invalidateQueries({ queryKey: ['admin', 'drivers'] }); await qc.invalidateQueries({ queryKey: adminKeys.overview }); });

export const useAdminReportOverview = (params: {from?: string; to?: string}) => useQuery({ queryKey: adminKeys.reportsOverview(params), queryFn: () => adminApi.reportsOverview(params), staleTime: 60_000 });
export const useAdminEmergencyReports = (params: {from?: string; to?: string}) => useQuery({ queryKey: adminKeys.reportsEmergencies(params), queryFn: () => adminApi.reportsEmergencies(params), staleTime: 60_000 });
export const useAdminAnalytics = (params: {from?: string; to?: string}) => useQuery({ queryKey: adminKeys.reportsAnalytics(params), queryFn: () => adminApi.reportsAnalytics(params), staleTime: 60_000 });
