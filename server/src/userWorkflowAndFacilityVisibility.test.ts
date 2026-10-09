import test from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';

// Router modules transitively import the validated server environment. Initialize
// non-production test defaults before those modules load. Dynamic imports below
// ensure env.ts sees these values when it is first evaluated.
process.env.NODE_ENV ??= 'test';
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/resq_test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-000000000000000000000000';
process.env.JWT_REFRESH_SECRET ??= 'test-only-refresh-secret-00000000000000000000';
process.env.RESQ_ADMIN_EMAIL ??= 'admin@example.test';
process.env.RESQ_ADMIN_PASSWORD ??= 'test-only-admin-password';

test('cancelEmergencySchema accepts optional reason and empty payload', () => {
  assert.equal(cancelEmergencySchema.safeParse({}).success, true);
  assert.equal(cancelEmergencySchema.safeParse({ reason: 'Patient already en route' }).success, true);
  assert.equal(cancelEmergencySchema.safeParse({ reason: '   ' }).success, true);
  assert.equal(cancelEmergencySchema.safeParse({ unknownField: 'rejected' }).success, false);
});

test('createEmergencyRequestSchema validates coordinates, situation, and hospitalId', () => {
  const valid = {
    hospitalId: '507f1f77bcf86cd799439011',
    situationType: 'Severe chest pain and shortness of breath',
    location: '123 Main St, Jaipur',
    latitude: 26.9124,
    longitude: 75.7873,
  };
  assert.equal(createEmergencyRequestSchema.safeParse(valid).success, true);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...valid, hospitalId: 'invalid-id' }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...valid, latitude: 150 }).success, false);
  assert.equal(createEmergencyRequestSchema.safeParse({ ...valid, situationType: 'A' }).success, false);
});

test('userEmergencyListQuerySchema enforces bounded pagination and valid filters', () => {
  assert.equal(userEmergencyListQuerySchema.safeParse({ page: 1, limit: 20, status: 'RECEIVED' }).success, true);
  assert.equal(userEmergencyListQuerySchema.safeParse({ page: 0 }).success, false);
  assert.equal(userEmergencyListQuerySchema.safeParse({ limit: 100 }).success, false);
  assert.equal(userEmergencyListQuerySchema.safeParse({ status: 'INVALID_STATUS' }).success, false);
});

test('facilitySearchQuerySchema handles text, category, coordinates, and emergency flags', () => {
  assert.equal(facilitySearchQuerySchema.safeParse({ q: 'City Hospital', category: 'emergency', emergencyOnly: true }).success, true);
  assert.equal(facilitySearchQuerySchema.safeParse({ category: 'trauma', latitude: 26.9, longitude: 75.8, radiusMeters: 25000 }).success, true);
  assert.equal(facilitySearchQuerySchema.safeParse({ category: 'pediatric' }).success, true);
  assert.equal(facilitySearchQuerySchema.safeParse({ category: 'urgent_care' }).success, true);
  assert.equal(facilitySearchQuerySchema.safeParse({ category: 'non_existent_category' }).success, false);
});

test('routeRequestSchema validates coordinates and driving preference', () => {
  const payload = {
    origin: { latitude: 26.9124, longitude: 75.7873 },
    destination: { latitude: 26.9200, longitude: 75.8000 },
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
  };
  assert.equal(routeRequestSchema.safeParse(payload).success, true);
  assert.equal(routeRequestSchema.safeParse({ ...payload, travelMode: 'AIRPLANE' }).success, false);
  assert.equal(routeRequestSchema.safeParse({ ...payload, origin: { latitude: 95, longitude: 75 } }).success, false);
});

test('nearbyQuerySchema validates radius and center coordinates', () => {
  assert.equal(nearbyQuerySchema.safeParse({ latitude: 26.9124, longitude: 75.7873, radius: 15000 }).success, true);
  assert.equal(nearbyQuerySchema.safeParse({ latitude: 26.9124, longitude: 75.7873, radius: 200000 }).success, false);
});

test('hospitalToFacility correctly transforms GeoJSON coordinates and statuses', () => {
  const dummyHospital = {
    _id: new Types.ObjectId('507f1f77bcf86cd799439011'),
    name: 'Apex Trauma & Multi-Specialty Hospital',
    hospitalType: 'General Hospital',
    services: ['Emergency Care', 'Trauma Surgery', 'ICU'],
    capabilities: ['Adult ICU', 'Trauma Level 1'],
    emergencyAvailability: 'AVAILABLE',
    verificationStatus: 'VERIFIED',
    accountStatus: 'ACTIVE',
    updatedAt: new Date('2026-10-09T12:00:00Z'),
    address: '42 Sector 5',
    city: 'Jaipur',
    state: 'Rajasthan',
    country: 'India',
    phone: '+91 9876543210',
    location: { type: 'Point' as const, coordinates: [75.7873, 26.9124] as [number, number] },
  };

  const facility = hospitalToFacility(dummyHospital, 3500);
  assert.equal(facility.id, '507f1f77bcf86cd799439011');
  assert.equal(facility.name, 'Apex Trauma & Multi-Specialty Hospital');
  assert.equal(facility.latitude, 26.9124);
  assert.equal(facility.longitude, 75.7873);
  assert.equal(facility.category, 'trauma');
  assert.equal(facility.distance, '3.5 km');
  assert.equal(facility.distanceMeters, 3500);
  assert.equal(facility.emergencyAvailable, true);
  assert.equal(facility.verified, true);
  assert.equal(facility.isOpen, true);
  assert.equal(facility.isAvailable, true);
  assert.equal(facility.address, '42 Sector 5, Jaipur, Rajasthan, India');
});

test('public facility router does not enforce top-level authenticate middleware', () => {
  // Inspect router stack
  const stack = (facilityRouter as unknown as { stack: Array<{ route?: { path: string; methods: Record<string, boolean> }; handle: { name: string } }> }).stack;
  // None of the middleware layers before routes should be named 'authenticate'
  const middlewareNames = stack.filter((layer) => !layer.route).map((layer) => layer.handle.name);
  assert.equal(middlewareNames.includes('authenticate'), false);

  // Routes /search and /:id should exist
  const routes = stack.filter((layer) => layer.route).map((layer) => layer.route!.path);
  assert.equal(routes.includes('/search'), true);
  assert.equal(routes.includes('/:id'), true);
});

test('public maps and geocoding routers do not enforce authenticate middleware', () => {
  const mapsStack = (mapsRouter as unknown as { stack: Array<{ handle: { name: string } }> }).stack;
  assert.equal(mapsStack.some((l) => l.handle.name === 'authenticate'), false);

  const geocodingStack = (geocodingRouter as unknown as { stack: Array<{ handle: { name: string } }> }).stack;
  assert.equal(geocodingStack.some((l) => l.handle.name === 'authenticate'), false);

  const placesStack = (placesRouter as unknown as { stack: Array<{ handle: { name: string } }> }).stack;
  assert.equal(placesStack.some((l) => l.handle.name === 'authenticate'), false);
});

test('geospatial router separates public facilities from authenticated ambulances', () => {
  const stack = (geospatialRouter as unknown as { stack: Array<{ route?: { path: string; stack: Array<{ handle: { name: string } }> } }> }).stack;
  const facilityLayer = stack.find((l) => l.route?.path === '/facilities/nearby');
  assert.ok(facilityLayer);
  const facilityHandlers = facilityLayer.route!.stack.map((s) => s.handle.name);
  assert.equal(facilityHandlers.includes('authenticate'), false);

  const ambulanceLayer = stack.find((l) => l.route?.path === '/ambulances/nearby');
  assert.ok(ambulanceLayer);
  const ambulanceHandlers = ambulanceLayer.route!.stack.map((s) => s.handle.name);
  assert.equal(ambulanceHandlers.includes('authenticate'), true);
});

test('emergency router middleware contract enforces authentication and USER role', async () => {
  const reqWithoutAuth = { headers: {} } as unknown as Parameters<typeof authenticate>[0];
  const res = {} as unknown as Parameters<typeof authenticate>[1];
  let authError: unknown = null;
  await authenticate(reqWithoutAuth, res, (err?: unknown) => { authError = err; });
  assert.ok(authError);

  const reqWithHospitalRole = { auth: { id: '123', role: 'HOSPITAL' } } as unknown as Parameters<ReturnType<typeof authorizeRole>>[0];
  let roleError: unknown = null;
  authorizeRole('USER')(reqWithHospitalRole, res, (err?: unknown) => { roleError = err; });
  assert.ok(roleError);

  const reqWithUserRole = { auth: { id: '123', role: 'USER' } } as unknown as Parameters<ReturnType<typeof authorizeRole>>[0];
  let roleSuccess = false;
  authorizeRole('USER')(reqWithUserRole, res, (err?: unknown) => { if (!err) roleSuccess = true; });
  assert.equal(roleSuccess, true);
});
