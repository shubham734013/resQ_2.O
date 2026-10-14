import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  hospitalAppointmentApi,
  type BookAppointmentInput,
  type ProposeAlternativeSlotInput,
  type HospitalAppointmentAvailability,
  type AppointmentStatus,
} from '../services/hospitalAppointmentApi';

export const useAppointmentAvailability = (
  hospitalId?: string,
  department?: string,
  date?: string,
  enabled = true
) => {
  return useQuery({
    queryKey: ['appointment-availability', hospitalId, department, date],
    queryFn: () => {
      if (!hospitalId || !department || !date) throw new Error('Missing parameters');
      return hospitalAppointmentApi.queryAvailability(hospitalId, department, date);
    },
    enabled: Boolean(enabled && hospitalId && department && date),
  });
};

export const useMyAppointments = (
  query: { page?: number; limit?: number; status?: AppointmentStatus; date?: string; department?: string } = {}
) => {
  return useQuery({
    queryKey: ['my-appointments', query],
    queryFn: () => hospitalAppointmentApi.listMyAppointments(query),
  });
};

export const useBookAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BookAppointmentInput) => hospitalAppointmentApi.bookAppointment(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      qc.invalidateQueries({ queryKey: ['appointment-availability'] });
    },
  });
};

export const useCancelAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      hospitalAppointmentApi.cancelMyAppointment(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-appointments'] });
      qc.invalidateQueries({ queryKey: ['appointment-availability'] });
    },
  });
};

export const useHospitalAppointments = (
  query: { page?: number; limit?: number; status?: AppointmentStatus; date?: string; department?: string } = {}
) => {
  return useQuery({
    queryKey: ['hospital-appointments', query],
    queryFn: () => hospitalAppointmentApi.listHospitalAppointments(query),
  });
};

export const useConfirmAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) =>
      hospitalAppointmentApi.confirmAppointment(id, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-appointments'] });
    },
  });
};

export const useRejectAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, rejectionReason }: { id: string; rejectionReason: string }) =>
      hospitalAppointmentApi.rejectAppointment(id, rejectionReason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-appointments'] });
    },
  });
};

export const useProposeAlternativeSlot = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ProposeAlternativeSlotInput }) =>
      hospitalAppointmentApi.proposeAlternativeSlot(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-appointments'] });
    },
  });
};

export const useCompleteAppointment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => hospitalAppointmentApi.completeAppointment(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-appointments'] });
    },
  });
};

export const useHospitalAvailabilitySettings = () => {
  return useQuery({
    queryKey: ['hospital-availability-settings'],
    queryFn: () => hospitalAppointmentApi.getHospitalAvailabilitySettings(),
  });
};

export const useUpdateHospitalAvailabilitySettings = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HospitalAppointmentAvailability) =>
      hospitalAppointmentApi.updateHospitalAvailabilitySettings(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-availability-settings'] });
      qc.invalidateQueries({ queryKey: ['appointment-availability'] });
    },
  });
};
