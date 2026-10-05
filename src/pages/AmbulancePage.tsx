import { useState } from 'react';
import { AlertCircle, CheckCircle2, Hospital, MapPin, Phone } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { AmbulanceStatus } from '../components/ambulance/AmbulanceStatus';
import { EmergencyRequestPanel } from '../components/ambulance/EmergencyRequestPanel';
import { NavigationPanel } from '../components/ambulance/NavigationPanel';
import { TripAction } from '../components/ambulance/TripAction';
import { AmbulanceLayout } from '../components/ambulance/AmbulanceLayout';
import { MapView } from '../components/map/MapView';
import {
  HOSPITAL_NAVIGATION,
  MOCK_AMBULANCE,
  MOCK_DRIVER,
  MOCK_HOSPITAL,
  MOCK_PICKUP,
  MOCK_REQUEST,
  MOCK_TRIP,
  PATIENT_NAVIGATION,
} from '../data/ambulanceMock';
import type { AmbulanceAvailability, AmbulanceTripStatus } from '../types/ambulance';
import type { UserLocation } from '../types/facility';
import type { RouteOptionItem } from '../types/route';

const DRIVER_LOCATION: UserLocation = {
  latitude: 26.9124,
  longitude: 75.7873,
  label: 'Jaipur driver location',
  accuracy: 'high',
};

const PATIENT_ROUTE: RouteOptionItem = {
  id: 'ambulance-patient-route',
  name: 'Patient route',
  distance: PATIENT_NAVIGATION.distance,
  duration: PATIENT_NAVIGATION.eta,
  durationSeconds: 480,
  trafficCondition: 'moderate',
  summary: 'Mock emergency pickup route.',
  viaRoute: 'via local arterial roads',
  isRecommended: true,
  polylinePoints: [
    { x: 50, y: 50 },
    { x: 57, y: 44 },
    { x: 63, y: 39 },
    { x: 70, y: 33 },
  ],
  instructions: [],
};

const HOSPITAL_ROUTE: RouteOptionItem = {
  id: 'ambulance-hospital-route',
  name: 'Hospital route',
  distance: HOSPITAL_NAVIGATION.distance,
  duration: HOSPITAL_NAVIGATION.eta,
  durationSeconds: 720,
  trafficCondition: 'moderate',
  summary: 'Mock patient transport route.',
  viaRoute: 'via main medical corridor',
  isRecommended: true,
  polylinePoints: [
    { x: 50, y: 50 },
    { x: 43, y: 57 },
    { x: 38, y: 64 },
    { x: 31, y: 72 },
  ],
  instructions: [],
};

export const AmbulancePage = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const routeMode = pathname.replace('/ambulance', '').replace(/^\//, '');
  const [availability, setAvailability] = useState<AmbulanceAvailability>(MOCK_AMBULANCE.availability);
  const [tripStatus, setTripStatus] = useState<AmbulanceTripStatus | null>(null);
  const [issueReported, setIssueReported] = useState(false);

  const goOnline = () => {
    setAvailability('available');
    navigate('/ambulance');
  };

  const openMockRequest = () => {
    navigate('/ambulance/request');
    setTripStatus('incoming-request');
  };

  const acceptRequest = () => {
    setAvailability('busy');
    setIssueReported(false);
    setTripStatus('to-patient');
    navigate('/ambulance/navigation');
  };

  const declineRequest = () => {
    setAvailability('available');
    setTripStatus(null);
    navigate('/ambulance');
  };

  const arriveAtPatient = () => {
    setTripStatus('at-patient');
    navigate('/ambulance/trip');
  };

  const patientPickedUp = () => {
    setTripStatus('to-hospital');
    navigate('/ambulance/navigation');
  };

  const arriveAtHospital = () => {
    setTripStatus('at-hospital');
    navigate('/ambulance/trip');
  };

  const completeTrip = () => {
    setTripStatus('completed');
    navigate('/ambulance/trip');
  };

  const backToAvailable = () => {
    setAvailability('available');
    setTripStatus(null);
    navigate('/ambulance');
  };

  return (
    <AmbulanceLayout>
      {routeMode === 'request' && (
        <EmergencyRequestPanel
          request={MOCK_REQUEST}
          onAccept={acceptRequest}
          onDecline={declineRequest}
        />
      )}

      {routeMode === 'navigation' && effectiveTripStatus === 'to-patient' && (
        <NavigationPanel
          title="Navigate to Patient"
          destinationName={MOCK_PICKUP.label}
          destinationAddress={MOCK_PICKUP.address}
          destinationCoordinates={{ latitude: MOCK_PICKUP.latitude, longitude: MOCK_PICKUP.longitude }}
          navigation={PATIENT_NAVIGATION}
          userLocation={DRIVER_LOCATION}
          route={PATIENT_ROUTE}
          onAction={arriveAtPatient}
          actionLabel="Arrived at Patient"
          onCall={() => window.location.assign(`tel:${MOCK_DRIVER.phone}`)}
        />
      )}

      {routeMode === 'navigation' && effectiveTripStatus === 'to-hospital' && (
        <NavigationPanel
          title="Transporting to Hospital"
          destinationName={MOCK_HOSPITAL.name}
          destinationAddress={MOCK_HOSPITAL.address}
          destinationCoordinates={{ latitude: MOCK_HOSPITAL.latitude, longitude: MOCK_HOSPITAL.longitude }}
          navigation={HOSPITAL_NAVIGATION}
          userLocation={DRIVER_LOCATION}
          route={HOSPITAL_ROUTE}
          onAction={arriveAtHospital}
          actionLabel="Arrived at Hospital"
        />
      )}

      {routeMode === 'trip' && effectiveTripStatus === 'at-patient' && (
        <div className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current status</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">Arrived at Patient</h1>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <Button type="button" size="lg" fullWidth onClick={patientPickedUp} className="min-h-14">Patient Picked Up</Button>
              <Button type="button" variant="secondary" size="lg" fullWidth icon={<AlertCircle className="h-4 w-4" />} onClick={() => undefined} className="min-h-14">Report Issue</Button>
            </div>
          </div>
        </div>
      )}

      {routeMode === 'trip' && tripStatus === 'at-hospital' && (
        <div className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
            <div className="flex items-center gap-3">
              <Hospital className="h-7 w-7 text-slate-700" aria-hidden="true" />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current status</p>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950">Arrived at Hospital</h1>
              </div>
            </div>
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-900">{MOCK_HOSPITAL.name}</p>
              <p className="mt-2 text-sm text-slate-500">Hospital arrival recorded. Complete the trip when handover is finished.</p>
            </div>
            <div className="mt-6">
              <Button type="button" size="lg" fullWidth onClick={completeTrip} className="min-h-14">Trip Completed</Button>
            </div>
          </div>
        </div>
      )}

      {routeMode === 'trip' && effectiveTripStatus === 'completed' && (
        <div className="flex flex-1 flex-col">
          <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-8 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Trip complete</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">Trip Completed</h1>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs text-slate-500">Hospital</p>
                <p className="mt-1 font-semibold text-slate-900">{MOCK_HOSPITAL.name}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs text-slate-500">Trip duration</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{MOCK_TRIP.duration}</p>
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs text-slate-500">Approximate distance</p>
                <p className="mt-1 text-2xl font-bold text-slate-950">{MOCK_TRIP.distance}</p>
              </div>
            </div>
          </div>
          <TripAction onClick={backToAvailable}>Back to Available</TripAction>
        </div>
      )}

      {routeMode === 'profile' && (
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Driver profile</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">{MOCK_DRIVER.name}</h1>
            </div>
            <Button type="button" variant="ghost" icon={<Phone className="h-4 w-4" />} onClick={() => window.location.assign(`tel:${MOCK_DRIVER.phone}`)}>Call</Button>
          </div>
          <div className="mt-6 space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Ambulance ID</p>
              <p className="mt-1 font-semibold text-slate-900">{MOCK_AMBULANCE.registrationNumber}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">Driver contact</p>
              <p className="mt-1 font-semibold text-slate-900">{MOCK_DRIVER.phone}</p>
            </div>
          </div>
        </div>
      )}

      {routeMode === '' && (
        <div className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Ambulance {MOCK_AMBULANCE.id.toUpperCase()}</p>
                <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{MOCK_DRIVER.name}</h1>
              </div>
              <AmbulanceStatus status={availability} />
            </div>

            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">Ambulance ID</p>
                  <p className="mt-1 font-semibold text-slate-900">{MOCK_AMBULANCE.registrationNumber}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-500">Availability</p>
                  <p className="mt-1 font-semibold text-slate-900">{availability === 'offline' ? 'Offline' : availability === 'available' ? 'Available' : 'On active trip'}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 min-h-[300px] overflow-hidden rounded-lg border border-slate-200 bg-slate-200 h-[45vh] sm:h-[48vh]">
              <MapView userLocation={DRIVER_LOCATION} center={DRIVER_LOCATION} interactive className="h-full w-full" />
            </div>

            <div className="mt-4 flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4">
              <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
              <div>
                <p className="text-xs text-slate-500">Current location</p>
                <p className="mt-1 font-semibold text-slate-900">{DRIVER_LOCATION.label}</p>
              </div>
            </div>

            {availability === 'offline' && (
              <div className="mt-5 pb-5">
                <p className="text-2xl font-bold tracking-tight text-slate-950">You are Offline</p>
                <div className="mt-3"><TripAction onClick={goOnline}>Go Online</TripAction></div>
              </div>
            )}

            {availability === 'available' && (
              <div className="mt-5 pb-5">
                <p className="text-2xl font-bold tracking-tight text-slate-950">Available for Emergency Requests</p>
                <div className="mt-3"><Button type="button" size="lg" fullWidth onClick={openMockRequest} className="min-h-14">Open Mock Request</Button></div>
              </div>
            )}

            {availability === 'busy' && tripStatus && (
              <div className="mt-5 rounded-lg border border-slate-200 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Current trip</p>
                <p className="mt-1 text-xl font-bold text-slate-950">{tripStatus === 'to-patient' ? 'Navigate to Patient' : 'Transporting to Hospital'}</p>
                <Button type="button" variant="secondary" size="lg" fullWidth onClick={() => navigate('/ambulance/navigation')} className="mt-4 min-h-14">Continue Trip</Button>
              </div>
            )}
          </div>
        </div>
      )}
    </AmbulanceLayout>
  );
};
