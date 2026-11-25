import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hospitalApi, type HospitalListParams } from '../services/hospitalApi';
import type { HospitalEmergencyStatus } from '../types/hospitalManagement';

export const hospitalKeys = {
  all: ['hospital'] as const,
  profile: () => [...hospitalKeys.all, 'profile'] as const,
  services: () => [...hospitalKeys.all, 'services'] as const,
  capabilities: () => [...hospitalKeys.all, 'capabilities'] as const,
  availability: () => [...hospitalKeys.all, 'availability'] as const,
  resources: () => [...hospitalKeys.all, 'resources'] as const,
  emergencySummary: () => [...hospitalKeys.all, 'emergency-summary'] as const,
  emergencies: (params: HospitalListParams) => [...hospitalKeys.all, 'emergencies', params] as const,
  emergency: (id: string) => [...hospitalKeys.all, 'emergency', id] as const,
  coordinationNotifications: (params: { state?: string; page?: number; limit?: number }) => [...hospitalKeys.all, 'coordination-notifications', params] as const,
  coordinationDetail: (id: string) => [...hospitalKeys.all, 'coordination-detail', id] as const,
  patients: (params: HospitalListParams) => [...hospitalKeys.all, 'patients', params] as const,
  patient: (id: string) => [...hospitalKeys.all, 'patient', id] as const,
  ambulances: (params: HospitalListParams) => [...hospitalKeys.all, 'ambulances', params] as const,
  ambulance: (id: string) => [...hospitalKeys.all, 'ambulance', id] as const,
};

export const useHospitalProfile = () => useQuery({ queryKey: hospitalKeys.profile(), queryFn: hospitalApi.getProfile });
export const useHospitalServices = () => useQuery({ queryKey: hospitalKeys.services(), queryFn: hospitalApi.getServices });
export const useHospitalCapabilities = () => useQuery({ queryKey: hospitalKeys.capabilities(), queryFn: hospitalApi.getCapabilities });
export const useHospitalAvailability = () => useQuery({ queryKey: hospitalKeys.availability(), queryFn: hospitalApi.getAvailability });
export const useHospitalResources = () => useQuery({ queryKey: hospitalKeys.resources(), queryFn: hospitalApi.getResources });
export const useHospitalEmergencySummary = () => useQuery({
  queryKey: hospitalKeys.emergencySummary(),
  queryFn: hospitalApi.getEmergencySummary,
  refetchInterval: (query) => {
    const data = query.state.data;
    if (!data) return 15000;
    return data.RECEIVED + data.REVIEWING + data.PREPARING + data.AMBULANCE_COORDINATION > 0 ? 15000 : false;
  },
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
});
export const useHospitalEmergencies = (params: HospitalListParams = {}) => useQuery({
  queryKey: hospitalKeys.emergencies(params),
  queryFn: () => hospitalApi.getEmergencies(params),
  refetchInterval: (query) => {
    const active = query.state.data?.items.some((item) => ['RECEIVED', 'REVIEWING', 'PREPARING', 'AMBULANCE_COORDINATION'].includes(item.status));
    return active ? 15000 : false;
  },
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
});
export const useHospitalEmergency = (id: string) => useQuery({ queryKey: hospitalKeys.emergency(id), queryFn: () => hospitalApi.getEmergency(id), enabled: Boolean(id) });
export const useHospitalCoordinationNotifications = (params: { state?: 'UNREAD' | 'ACKNOWLEDGED' | 'SUPERSEDED' | 'ALL'; page?: number; limit?: number } = { state: 'UNREAD', page: 1, limit: 25 }) => useQuery({
  queryKey: hospitalKeys.coordinationNotifications(params),
  queryFn: () => hospitalApi.getCoordinationNotifications(params),
  refetchInterval: 15000,
  refetchIntervalInBackground: false,
  refetchOnWindowFocus: true,
});
export const useHospitalCoordinationDetail = (id: string) => useQuery({
  queryKey: hospitalKeys.coordinationDetail(id),
  queryFn: () => hospitalApi.getCoordinationDetail(id),
  enabled: Boolean(id),
  refetchInterval: (query) => query.state.data?.trip && !['COMPLETED', 'CANCELLED'].includes(query.state.data.trip.status) ? 10000 : false,
  refetchOnWindowFocus: true,
});
export const useAcknowledgeHospitalCoordinationNotification = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: hospitalApi.acknowledgeCoordinationNotification,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: [...hospitalKeys.all, 'coordination-notifications'] });
      void client.invalidateQueries({ queryKey: [...hospitalKeys.all, 'coordination-detail'] });
      void client.invalidateQueries({ queryKey: hospitalKeys.patients({}) });
      void client.invalidateQueries({ queryKey: hospitalKeys.emergencySummary() });
    },
  });
};
export const useHospitalPatients = (params: HospitalListParams = {}) => useQuery({ queryKey: hospitalKeys.patients(params), queryFn: () => hospitalApi.getPatients(params) });
export const useHospitalPatient = (id: string) => useQuery({ queryKey: hospitalKeys.patient(id), queryFn: () => hospitalApi.getPatient(id), enabled: Boolean(id) });
export const useHospitalAmbulances = (params: HospitalListParams = {}) => useQuery({ queryKey: hospitalKeys.ambulances(params), queryFn: () => hospitalApi.getAmbulances(params) });
export const useHospitalAmbulance = (id: string) => useQuery({ queryKey: hospitalKeys.ambulance(id), queryFn: () => hospitalApi.getAmbulance(id), enabled: Boolean(id) });

export const useHospitalProfileMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: hospitalApi.updateProfile, onSuccess: (data) => { client.setQueryData(hospitalKeys.profile(), data); } });
};
export const useHospitalServicesMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: hospitalApi.updateServices, onSuccess: (data) => { client.setQueryData(hospitalKeys.services(), data); client.invalidateQueries({ queryKey: hospitalKeys.profile() }); } });
};
export const useHospitalCapabilitiesMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: hospitalApi.updateCapabilities, onSuccess: (data) => { client.setQueryData(hospitalKeys.capabilities(), data); client.invalidateQueries({ queryKey: hospitalKeys.profile() }); } });
};
export const useHospitalAvailabilityMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: hospitalApi.updateAvailability, onSuccess: (data) => { client.setQueryData(hospitalKeys.availability(), data); client.invalidateQueries({ queryKey: hospitalKeys.profile() }); } });
};
export const useHospitalResourcesMutation = () => {
  const client = useQueryClient();
  return useMutation({ mutationFn: hospitalApi.updateResources, onSuccess: (data) => { client.setQueryData(hospitalKeys.resources(), data); client.invalidateQueries({ queryKey: hospitalKeys.profile() }); } });
};
export const useHospitalEmergencyStatusMutation = () => {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: HospitalEmergencyStatus }) => hospitalApi.updateEmergencyStatus(id, status),
    onSuccess: (data) => {
      client.setQueryData(hospitalKeys.emergency(data.id), data);
      client.invalidateQueries({ queryKey: hospitalKeys.all });
    },
    onError: (_error, variables) => {
      client.invalidateQueries({ queryKey: hospitalKeys.emergency(variables.id) });
      client.invalidateQueries({ queryKey: hospitalKeys.emergencies({}) });
      client.invalidateQueries({ queryKey: hospitalKeys.emergencySummary() });
    },
  });
};
