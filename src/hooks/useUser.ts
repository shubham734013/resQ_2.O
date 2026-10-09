import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../services/userApi';
import { emergencyApi } from '../services/emergencyApi';

export const userKeys = {
  profile: ['user', 'profile'] as const,
  savedFacilities: ['user', 'saved-facilities'] as const,
  emergencies: (p: Record<string, unknown>) => ['user', 'emergencies', p] as const,
};

export const useUserProfile = () => useQuery({ queryKey: userKeys.profile, queryFn: userApi.profile, staleTime: 60_000 });
export const useUpdateUserProfile = () => { const qc = useQueryClient(); return useMutation({ mutationFn: userApi.updateProfile, onSuccess: (data) => { qc.setQueryData(userKeys.profile, data); } }); };
export const useSavedFacilities = () => useQuery({ queryKey: userKeys.savedFacilities, queryFn: userApi.savedFacilities, staleTime: 60_000 });
export const useSaveFacility = () => { const qc = useQueryClient(); return useMutation({ mutationFn: userApi.saveFacility, onSuccess: () => { void qc.invalidateQueries({ queryKey: userKeys.savedFacilities }); } }); };
export const useRemoveSavedFacility = () => { const qc = useQueryClient(); return useMutation({ mutationFn: userApi.removeSavedFacility, onSuccess: () => { void qc.invalidateQueries({ queryKey: userKeys.savedFacilities }); } }); };
export const useUserEmergencies = (params: Record<string, unknown> = {}) => useQuery({ queryKey: userKeys.emergencies(params), queryFn: () => emergencyApi.list(params), refetchInterval: 15_000, staleTime: 5_000 });
export const useCancelEmergency = () => { const qc = useQueryClient(); return useMutation({ mutationFn: (id: string) => emergencyApi.cancel(id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['user', 'emergencies'] }); } }); };
