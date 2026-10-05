export type AmbulanceAvailability = 'offline' | 'available' | 'busy';
export type AmbulanceTripStatus = 'incoming-request' | 'to-patient' | 'at-patient' | 'to-hospital' | 'at-hospital' | 'completed';
export interface PickupLocation { id: string; label: string; address: string; latitude: number; longitude: number; distance: string; estimatedPickupTime: string; }
export interface HospitalDestination { id: string; name: string; address: string; latitude: number; longitude: number; }
export interface Ambulance { id: string; registrationNumber: string; driverId: string; availability: AmbulanceAvailability; }
export interface Driver { id: string; name: string; phone: string; }
export interface EmergencyRequest { id: string; category: string; pickupLocation: PickupLocation; hospitalDestination: HospitalDestination; }
export interface NavigationState { eta: string; distance: string; instruction: string; currentStepIndex: number; }
export interface Trip { id: string; request: EmergencyRequest; status: AmbulanceTripStatus; duration: string; distance: string; }
