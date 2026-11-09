import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  hospitalCareRequestApi,
  type CreateCareRequestInput,
  type RespondCareRequestInput,
  type CareRequestStatus,
} from '../services/hospitalCareRequestApi';

export const useMyCareRequests = (query: { page?: number; limit?: number; status?: CareRequestStatus; serviceDepartment?: string } = {}) => {
  return useQuery({
    queryKey: ['my-care-requests', query],
    queryFn: () => hospitalCareRequestApi.listMyRequests(query),
  });
};

export const useCreateCareRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCareRequestInput) => hospitalCareRequestApi.createRequest(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-care-requests'] });
    },
  });
};

export const useCancelCareRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      hospitalCareRequestApi.cancelMyRequest(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-care-requests'] });
    },
  });
};

export const useHospitalIncomingRequests = (query: { page?: number; limit?: number; status?: CareRequestStatus; serviceDepartment?: string } = {}) => {
  return useQuery({
    queryKey: ['hospital-incoming-requests', query],
    queryFn: () => hospitalCareRequestApi.listIncomingRequests(query),
  });
};

export const useRespondCareRequest = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: RespondCareRequestInput }) =>
      hospitalCareRequestApi.respondToRequest(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['hospital-incoming-requests'] });
    },
  });
};
