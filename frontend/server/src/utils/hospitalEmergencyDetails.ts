interface EmergencyPatientDetails {
  patientName?: string;
  patientPhone?: string;
}

interface UserContactDetails {
  name?: string | null;
  phone?: string | null;
}

const nonBlank = (value?: string | null) => value?.trim() || undefined;

export const resolveHospitalEmergencyPatientDetails = (
  emergency: EmergencyPatientDetails,
  user?: UserContactDetails | null,
) => ({
  patientName: nonBlank(emergency.patientName) ?? nonBlank(user?.name),
  patientPhone: nonBlank(emergency.patientPhone) ?? nonBlank(user?.phone),
});
