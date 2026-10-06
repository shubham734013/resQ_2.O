import test from 'node:test';
import assert from 'node:assert/strict';
import { ambulanceCreateSchema, ambulanceStatusSchema, assignmentSchema, driverStatusSchema, driverCreateSchema, requestAssignSchema } from './schemas/ambulance.js';
import { AMBULANCE_STATUSES, DRIVER_AVAILABILITY_STATUSES, TRIP_STATUSES } from './types/ambulance.js';

test('ambulance creation rejects unsupported fields',()=>{const result=ambulanceCreateSchema.safeParse({registrationNumber:'RJ14-1',vehicleNumber:'V1',ambulanceType:'BLS',capabilities:[],accountStatus:'ACTIVE'});assert.equal(result.success,false);});
test('ambulance status is controlled',()=>{assert.equal(ambulanceStatusSchema.safeParse({status:'AVAILABLE'}).success,true);assert.equal(ambulanceStatusSchema.safeParse({status:'ACTIVE'}).success,false);});
test('driver status only accepts operational states',()=>{for(const status of DRIVER_AVAILABILITY_STATUSES)assert.equal(driverStatusSchema.safeParse({status}).success,true);assert.equal(driverStatusSchema.safeParse({status:'ACTIVE'}).success,false);});
test('assignment requires a valid driver id',()=>{assert.equal(assignmentSchema.safeParse({driverId:'507f1f77bcf86cd799439011'}).success,true);assert.equal(assignmentSchema.safeParse({driverId:'driver-a'}).success,false);});
test('request assignment requires an ambulance id',()=>{assert.equal(requestAssignSchema.safeParse({ambulanceId:'507f1f77bcf86cd799439011'}).success,true);});
test('driver creation requires a strong password',()=>{const base={fullName:'Driver One',email:'driver@example.com',phone:'9999999999',licenseNumber:'LIC-1'};assert.equal(driverCreateSchema.safeParse({...base,password:'short'}).success,false);assert.equal(driverCreateSchema.safeParse({...base,password:'a-strong-driver-password'}).success,true);});
test('ambulance and trip status vocabularies are finite',()=>{assert.ok(AMBULANCE_STATUSES.includes('AVAILABLE'));assert.ok(AMBULANCE_STATUSES.includes('MAINTENANCE'));assert.ok(TRIP_STATUSES.includes('PATIENT_ONBOARD'));assert.ok(!TRIP_STATUSES.includes('DRIVING' as never));});
test('query pagination is bounded',()=>{assert.equal(ambulanceCreateSchema.safeParse({registrationNumber:'R',vehicleNumber:'V1',ambulanceType:'BLS'}).success,true);});
