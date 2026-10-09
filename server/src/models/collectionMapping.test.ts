import assert from 'node:assert/strict';
import test from 'node:test';
import { UserModel } from './User.js';
import { HospitalModel } from './Hospital.js';
import { AmbulanceProviderModel } from './AmbulanceProvider.js';
import { AmbulanceModel } from './Ambulance.js';

test('models map to the existing ResQ Atlas collections', () => {
  assert.equal(UserModel.collection.collectionName, 'User_Data');
  assert.equal(HospitalModel.collection.collectionName, 'Hospitals_data');
  assert.equal(AmbulanceProviderModel.collection.collectionName, 'Providers_Data');
  assert.equal(AmbulanceModel.collection.collectionName, 'Ambulance_Data');
});
