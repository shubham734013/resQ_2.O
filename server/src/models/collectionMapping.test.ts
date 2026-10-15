import assert from 'node:assert/strict';
import test from 'node:test';
import { UserModel } from './User.js';
import { HospitalModel } from './Hospital.js';
import { AmbulanceProviderModel } from './AmbulanceProvider.js';
import { AmbulanceModel } from './Ambulance.js';
import { AmbulanceDriverModel } from './AmbulanceDriver.js';
import { EmergencyRequestModel } from './EmergencyRequest.js';
import { DispatchJobModel } from './DispatchJob.js';
import { HospitalAppointmentModel } from './HospitalAppointment.js';
import { HospitalCareRequestModel } from './HospitalCareRequest.js';
import { HospitalPatientModel } from './HospitalPatient.js';
import { AuthSessionModel } from './AuthSession.js';

test('models map to the existing ResQ Atlas collections', () => {
  assert.equal(UserModel.collection.collectionName, 'User_Data');
  assert.equal(HospitalModel.collection.collectionName, 'Hospitals_data');
  assert.equal(AmbulanceProviderModel.collection.collectionName, 'Providers_Data');
  assert.equal(AmbulanceModel.collection.collectionName, 'Ambulance_Data');
});

test('Hospital and Ambulance models have valid GeoJSON 2dsphere location indexes', () => {
  const hospitalIndexes = HospitalModel.schema.indexes();
  const hasHospital2dsphere = hospitalIndexes.some(([spec]) => spec.location === '2dsphere');
  assert.equal(hasHospital2dsphere, true, 'HospitalModel must have a 2dsphere index on location');

  const ambulanceIndexes = AmbulanceModel.schema.indexes();
  const hasAmbulance2dsphere = ambulanceIndexes.some(([spec]) => spec.location === '2dsphere');
  assert.equal(hasAmbulance2dsphere, true, 'AmbulanceModel must have a 2dsphere index on location');
});

test('models have no duplicate schema index definitions', () => {
  const models = [
    UserModel,
    HospitalModel,
    AmbulanceModel,
    AmbulanceDriverModel,
    AmbulanceProviderModel,
    EmergencyRequestModel,
    DispatchJobModel,
    HospitalAppointmentModel,
    HospitalCareRequestModel,
    HospitalPatientModel,
    AuthSessionModel,
  ];

  for (const mdl of models) {
    const indexes = mdl.schema.indexes();
    const seen = new Set<string>();
    for (const [spec] of indexes) {
      const keyStr = JSON.stringify(spec);
      assert.equal(
        seen.has(keyStr),
        false,
        `Duplicate schema index found in ${mdl.modelName} for key ${keyStr}`
      );
      seen.add(keyStr);
    }
  }
});
