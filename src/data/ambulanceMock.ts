import type { Ambulance, Driver, EmergencyRequest, HospitalDestination, NavigationState, PickupLocation, Trip } from '../types/ambulance';

export const MOCK_AMBULANCE: Ambulance = { id: 'amb-104', registrationNumber: 'RJ14-AB-1042', driverId: 'driver-22', availability: 'offline' };
export const MOCK_DRIVER: Driver = { id: 'driver-22', name: 'Arjun Sharma', phone: '+91 90000 10042' };
export const MOCK_PICKUP: PickupLocation = { id: 'pickup-01', label: 'Shastri Nagar, Jaipur', address: 'Near Shastri Nagar Metro Station, Jaipur', latitude: 26.9239, longitude: 75.7895, distance: '1.8 km', estimatedPickupTime: '8 min' };
export const MOCK_HOSPITAL: HospitalDestination = { id: 'hospital-01', name: 'SMS Hospital Emergency Department', address: 'Jawaharlal Nehru Marg, Jaipur', latitude: 26.8987, longitude: 75.8113 };
export const MOCK_REQUEST: EmergencyRequest = { id: 'REQ-2048', category: 'Medical emergency', pickupLocation: MOCK_PICKUP, hospitalDestination: MOCK_HOSPITAL };
export const PATIENT_NAVIGATION: NavigationState = { eta: '8 min', distance: '1.8 km', instruction: 'Turn right in 300 m', currentStepIndex: 1 };
export const HOSPITAL_NAVIGATION: NavigationState = { eta: '12 min', distance: '3.4 km', instruction: 'Continue straight for 900 m', currentStepIndex: 2 };
export const MOCK_TRIP: Trip = { id: 'trip-2048', request: MOCK_REQUEST, status: 'incoming-request', duration: '24 min', distance: '5.2 km' };
