import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { UserModel } from '../models/User.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { TripModel } from '../models/Trip.js';
import { OrganizationModel } from '../models/Organization.js';
import { OrganizationMembershipModel } from '../models/OrganizationMembership.js';
import { HospitalAppointmentModel } from '../models/HospitalAppointment.js';
import { HospitalAppointmentSlotModel } from '../models/HospitalAppointmentSlot.js';
import { HospitalAppointmentAvailabilityModel } from '../models/HospitalAppointmentAvailability.js';
import { HospitalCareRequestModel } from '../models/HospitalCareRequest.js';

import * as hospitalService from '../services/hospitalService.js';
import * as ambulanceOperationsService from '../services/ambulanceOperationsService.js';
import * as emergencyService from '../services/emergencyService.js';
import * as hospitalAppointmentService from '../services/hospitalAppointmentService.js';
import * as hospitalCareRequestService from '../services/hospitalCareRequestService.js';
import {
  requireOrganizationMembership,
  getAuthorizedOrganizationIds,
  assertResourceOrganization,
  scopeByOrganization,
  assertSameOrganization,
  assertEmergencyCoordinationAccess,
} from '../services/organizationAccess.js';
import { canAccessTrackingSnapshot } from '../services/trackingAuthorization.js';
import type { AuthenticatedIdentity } from '../types/auth.js';

describe('DATA-01C.3: Cross-Tenant Isolation and Emergency Workflow Verification', () => {
  // Tracking created document IDs for explicit cleanup
  const createdOrgIds: Types.ObjectId[] = [];
  const createdMembershipIds: Types.ObjectId[] = [];
  const createdHospitalIds: Types.ObjectId[] = [];
  const createdProviderIds: Types.ObjectId[] = [];
  const createdDriverIds: Types.ObjectId[] = [];
  const createdAmbulanceIds: Types.ObjectId[] = [];
  const createdUserIds: Types.ObjectId[] = [];
  const createdEmergencyIds: Types.ObjectId[] = [];
  const createdPatientIds: Types.ObjectId[] = [];
  const createdTripIds: Types.ObjectId[] = [];
  const createdAppointmentIds: Types.ObjectId[] = [];
  const createdSlotIds: Types.ObjectId[] = [];
  const createdAvailabilityIds: Types.ObjectId[] = [];
  const createdCareRequestIds: Types.ObjectId[] = [];

  // Principals and references
  let hospital1Id: string;
  let hospital2Id: string;
  let providerAId: string;
  let providerBId: string;
  let driverAId: string;
  let driverBId: string;
  let ambulanceAId: string;
  let ambulanceBId: string;
  let user1Id: string;
  let user2Id: string;
  let emergency1Id: string;
  let emergency2Id: string;
  let trip1Id: string;
  let trip2Id: string;
  let appointment1Id: string;
  let appointment2Id: string;
  let careRequest1Id: string;
  let careRequest2Id: string;
  let activeOrgId: Types.ObjectId;
  let suspendedOrgId: Types.ObjectId;

  before(async () => {
    await connectTestDatabase();

    const timestamp = Date.now();

    // 1. Create Organizations
    const activeOrg = await OrganizationModel.create({
      name: `Active Hospital Network ${timestamp}`,
      type: 'HOSPITAL_NETWORK',
      status: 'ACTIVE',
    });
    activeOrgId = activeOrg._id;
    createdOrgIds.push(activeOrgId);

    const suspendedOrg = await OrganizationModel.create({
      name: `Suspended Network ${timestamp}`,
      type: 'HOSPITAL_NETWORK',
      status: 'SUSPENDED',
    });
    suspendedOrgId = suspendedOrg._id;
    createdOrgIds.push(suspendedOrgId);

    // 2. Create Hospitals
    const hosp1 = await HospitalModel.create({
      name: `Hospital Alpha ${timestamp}`,
      registrationNumber: `REG-H1-${timestamp}`,
      email: `hosp1-${timestamp}@resq-test.local`,
      phone: '+919876543201',
      passwordHash: 'dummy-hash',
      hospitalType: 'GENERAL',
      services: ['emergency', 'cardiology'],
      capabilities: ['emergency', 'trauma'],
      emergencyAvailability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
      organizationId: activeOrgId,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
    });
    hospital1Id = hosp1._id.toString();
    createdHospitalIds.push(hosp1._id);

    const hosp2 = await HospitalModel.create({
      name: `Hospital Beta ${timestamp}`,
      registrationNumber: `REG-H2-${timestamp}`,
      email: `hosp2-${timestamp}@resq-test.local`,
      phone: '+919876543202',
      passwordHash: 'dummy-hash',
      hospitalType: 'GENERAL',
      services: ['emergency', 'orthopaedics'],
      capabilities: ['emergency'],
      emergencyAvailability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
      location: { type: 'Point', coordinates: [77.6046, 12.9816] },
    });
    hospital2Id = hosp2._id.toString();
    createdHospitalIds.push(hosp2._id);

    // Membership for Hospital 1 in activeOrg
    const memHosp1 = await OrganizationMembershipModel.create({
      organizationId: activeOrgId,
      principalType: 'HOSPITAL',
      principalId: hosp1._id,
      role: 'HOSPITAL_ADMIN',
      permissions: ['hospital:manage', 'patient:manage'],
      status: 'ACTIVE',
    });
    createdMembershipIds.push(memHosp1._id);

    // 3. Create Ambulance Providers
    const provA = await AmbulanceProviderModel.create({
      name: `Provider Alpha Fleet ${timestamp}`,
      registrationNumber: `REG-PA-${timestamp}`,
      email: `prova-${timestamp}@resq-test.local`,
      phone: '+919876543203',
      serviceType: 'EMERGENCY_AMBULANCE',
      passwordHash: 'dummy-hash',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    });
    providerAId = provA._id.toString();
    createdProviderIds.push(provA._id);

    const provB = await AmbulanceProviderModel.create({
      name: `Provider Beta Fleet ${timestamp}`,
      registrationNumber: `REG-PB-${timestamp}`,
      email: `provb-${timestamp}@resq-test.local`,
      phone: '+919876543204',
      serviceType: 'EMERGENCY_AMBULANCE',
      passwordHash: 'dummy-hash',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
    });
    providerBId = provB._id.toString();
    createdProviderIds.push(provB._id);

    // 4. Create Ambulances
    const ambA = await AmbulanceModel.create({
      providerId: provA._id,
      registrationNumber: `AMB-A-${timestamp}`,
      vehicleNumber: `KA01A${String(timestamp).slice(-4)}`,
      ambulanceType: 'ALS',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currentStatus: 'AVAILABLE',
      currentLatitude: 12.9716,
      currentLongitude: 77.5946,
      location: { type: 'Point', coordinates: [77.5946, 12.9716] },
      locationUpdatedAt: new Date(),
    });
    ambulanceAId = ambA._id.toString();
    createdAmbulanceIds.push(ambA._id);

    const ambB = await AmbulanceModel.create({
      providerId: provB._id,
      registrationNumber: `AMB-B-${timestamp}`,
      vehicleNumber: `KA01B${String(timestamp).slice(-4)}`,
      ambulanceType: 'BLS',
      accountStatus: 'ACTIVE',
      verificationStatus: 'VERIFIED',
      currentStatus: 'AVAILABLE',
      currentLatitude: 12.9816,
      currentLongitude: 77.6046,
      location: { type: 'Point', coordinates: [77.6046, 12.9816] },
      locationUpdatedAt: new Date(),
    });
    ambulanceBId = ambB._id.toString();
    createdAmbulanceIds.push(ambB._id);

    // 5. Create Drivers
    const drvA = await AmbulanceDriverModel.create({
      providerId: provA._id,
      fullName: `Driver Alpha ${timestamp}`,
      email: `drva-${timestamp}@resq-test.local`,
      phone: '+919876543205',
      passwordHash: 'dummy-hash',
      licenseNumber: `DL-A-${timestamp}`,
      accountStatus: 'ACTIVE',
      licenseVerificationStatus: 'VERIFIED',
      availabilityStatus: 'ONLINE',
      isOnDuty: true,
      assignedAmbulanceId: ambA._id,
      registeredLatitude: 12.9716,
      registeredLongitude: 77.5946,
    });
    driverAId = drvA._id.toString();
    createdDriverIds.push(drvA._id);

    const drvB = await AmbulanceDriverModel.create({
      providerId: provB._id,
      fullName: `Driver Beta ${timestamp}`,
      email: `drvb-${timestamp}@resq-test.local`,
      phone: '+919876543206',
      passwordHash: 'dummy-hash',
      licenseNumber: `DL-B-${timestamp}`,
      accountStatus: 'ACTIVE',
      licenseVerificationStatus: 'VERIFIED',
      availabilityStatus: 'ONLINE',
      isOnDuty: true,
      assignedAmbulanceId: ambB._id,
      registeredLatitude: 12.9816,
      registeredLongitude: 77.6046,
    });
    driverBId = drvB._id.toString();
    createdDriverIds.push(drvB._id);

    // 6. Create Citizens
    const usr1 = await UserModel.create({
      name: `Citizen One ${timestamp}`,
      email: `user1-${timestamp}@resq-test.local`,
      phone: '+919876543207',
      passwordHash: 'dummy-hash',
      role: 'USER',
      accountStatus: 'ACTIVE',
    });
    user1Id = usr1._id.toString();
    createdUserIds.push(usr1._id);

    const usr2 = await UserModel.create({
      name: `Citizen Two ${timestamp}`,
      email: `user2-${timestamp}@resq-test.local`,
      phone: '+919876543208',
      passwordHash: 'dummy-hash',
      role: 'USER',
      accountStatus: 'ACTIVE',
    });
    user2Id = usr2._id.toString();
    createdUserIds.push(usr2._id);

    // 7. Create Emergencies (Citizen-owned)
    const emg1 = await EmergencyRequestModel.create({
      requestCode: `RSQ-E1-${timestamp}`,
      idempotencyKey: `idem-key-emg1-${timestamp}`,
      userId: usr1._id,
      hospitalId: hosp1._id,
      situationType: 'CARDIAC',
      reportedAt: new Date(),
      location: '100 Main St',
      latitude: 12.9716,
      longitude: 77.5946,
      status: 'AMBULANCE_COORDINATION',
      ambulanceId: ambA._id,
      ambulanceProviderId: provA._id,
      driverId: drvA._id,
      statusHistory: [{ status: 'RECEIVED', changedAt: new Date(), actorId: usr1._id, actorRole: 'USER' }],
    });
    emergency1Id = emg1._id.toString();
    createdEmergencyIds.push(emg1._id);

    const emg2 = await EmergencyRequestModel.create({
      requestCode: `RSQ-E2-${timestamp}`,
      idempotencyKey: `idem-key-emg2-${timestamp}`,
      userId: usr2._id,
      hospitalId: hosp2._id,
      situationType: 'TRAUMA',
      reportedAt: new Date(),
      location: '200 Market St',
      latitude: 12.9816,
      longitude: 77.6046,
      status: 'RECEIVED',
      statusHistory: [{ status: 'RECEIVED', changedAt: new Date(), actorId: usr2._id, actorRole: 'USER' }],
    });
    emergency2Id = emg2._id.toString();
    createdEmergencyIds.push(emg2._id);

    // 8. Create Hospital Patients
    const pat1 = await HospitalPatientModel.create({
      caseId: `CASE-1-${timestamp}`,
      hospitalId: hosp1._id,
      emergencyId: emg1._id,
      emergencyType: 'CARDIAC',
      coordinationStatus: 'INCOMING',
      receivedAt: new Date(),
    });
    createdPatientIds.push(pat1._id);

    const pat2 = await HospitalPatientModel.create({
      caseId: `CASE-2-${timestamp}`,
      hospitalId: hosp2._id,
      emergencyId: emg2._id,
      emergencyType: 'TRAUMA',
      coordinationStatus: 'INCOMING',
      receivedAt: new Date(),
    });
    createdPatientIds.push(pat2._id);

    // 9. Create Trips
    const trip1 = await TripModel.create({
      emergencyRequestId: emg1._id,
      providerId: provA._id,
      ambulanceId: ambA._id,
      driverId: drvA._id,
      destinationHospitalId: hosp1._id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      statusHistory: [{ status: 'ACCEPTED', changedAt: new Date(), actorId: drvA._id, actorRole: 'AMBULANCE_DRIVER' }],
    });
    trip1Id = trip1._id.toString();
    createdTripIds.push(trip1._id);

    const trip2 = await TripModel.create({
      emergencyRequestId: emg2._id,
      providerId: provB._id,
      ambulanceId: ambB._id,
      driverId: drvB._id,
      destinationHospitalId: hosp2._id,
      status: 'ACCEPTED',
      acceptedAt: new Date(),
      statusHistory: [{ status: 'ACCEPTED', changedAt: new Date(), actorId: drvB._id, actorRole: 'AMBULANCE_DRIVER' }],
    });
    trip2Id = trip2._id.toString();
    createdTripIds.push(trip2._id);

    // 10. Create Appointment Setup & Appointments
    const avail1 = await HospitalAppointmentAvailabilityModel.create({
      hospitalId: hosp1._id,
      department: 'Cardiology',
      slotDurationMinutes: 30,
      maxCapacityPerSlot: 2,
      weeklySchedule: [{ dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }],
      isActive: true,
    });
    createdAvailabilityIds.push(avail1._id);

    const slot1 = await HospitalAppointmentSlotModel.create({
      hospitalId: hosp1._id,
      department: 'Cardiology',
      date: '2026-11-01',
      startTime: '10:00',
      endTime: '10:30',
      maxCapacity: 2,
      bookedCount: 1,
      isCancelled: false,
    });
    createdSlotIds.push(slot1._id);

    const appt1 = await HospitalAppointmentModel.create({
      appointmentCode: `APT-1-${timestamp}`,
      userId: usr1._id,
      hospitalId: hosp1._id,
      slotId: slot1._id,
      serviceDepartment: 'Cardiology',
      slotDate: '2026-11-01',
      startTime: '10:00',
      endTime: '10:30',
      slotDurationMinutes: 30,
      status: 'PENDING',
      visitReason: 'Routine Heart Checkup',
      statusHistory: [{ status: 'PENDING', timestamp: new Date(), updatedBy: usr1._id, role: 'USER' }],
    });
    appointment1Id = appt1._id.toString();
    createdAppointmentIds.push(appt1._id);

    const slot2 = await HospitalAppointmentSlotModel.create({
      hospitalId: hosp2._id,
      department: 'Orthopaedics',
      date: '2026-11-01',
      startTime: '11:00',
      endTime: '11:30',
      maxCapacity: 2,
      bookedCount: 1,
      isCancelled: false,
    });
    createdSlotIds.push(slot2._id);

    const appt2 = await HospitalAppointmentModel.create({
      appointmentCode: `APT-2-${timestamp}`,
      userId: usr2._id,
      hospitalId: hosp2._id,
      slotId: slot2._id,
      serviceDepartment: 'Orthopaedics',
      slotDate: '2026-11-01',
      startTime: '11:00',
      endTime: '11:30',
      slotDurationMinutes: 30,
      status: 'PENDING',
      visitReason: 'Joint Pain Consultation',
      statusHistory: [{ status: 'PENDING', timestamp: new Date(), updatedBy: usr2._id, role: 'USER' }],
    });
    appointment2Id = appt2._id.toString();
    createdAppointmentIds.push(appt2._id);

    // 11. Create Care Requests
    const care1 = await HospitalCareRequestModel.create({
      referenceId: `REQ-1-${timestamp}`,
      userId: usr1._id,
      hospitalId: hosp1._id,
      serviceDepartment: 'Cardiology',
      requestType: 'SPECIALIST_CONSULTATION',
      visitReason: 'Need specialist consultation',
      preferredTiming: 'MORNING',
      contactPreference: 'PHONE',
      status: 'PENDING',
      statusHistory: [{ status: 'PENDING', timestamp: new Date(), updatedBy: usr1._id, role: 'USER' }],
    });
    careRequest1Id = care1._id.toString();
    createdCareRequestIds.push(care1._id);

    const care2 = await HospitalCareRequestModel.create({
      referenceId: `REQ-2-${timestamp}`,
      userId: usr2._id,
      hospitalId: hosp2._id,
      serviceDepartment: 'Orthopaedics',
      requestType: 'GENERAL_CONSULTATION',
      visitReason: 'Knee surgery advice',
      preferredTiming: 'FLEXIBLE',
      contactPreference: 'IN_APP',
      status: 'PENDING',
      statusHistory: [{ status: 'PENDING', timestamp: new Date(), updatedBy: usr2._id, role: 'USER' }],
    });
    careRequest2Id = care2._id.toString();
    createdCareRequestIds.push(care2._id);
  });

  after(async () => {
    // Explicit, filtered cleanup of test artifacts
    if (createdMembershipIds.length) await OrganizationMembershipModel.deleteMany({ _id: { $in: createdMembershipIds } }).exec();
    if (createdOrgIds.length) await OrganizationModel.deleteMany({ _id: { $in: createdOrgIds } }).exec();
    if (createdCareRequestIds.length) await HospitalCareRequestModel.deleteMany({ _id: { $in: createdCareRequestIds } }).exec();
    if (createdAppointmentIds.length) await HospitalAppointmentModel.deleteMany({ _id: { $in: createdAppointmentIds } }).exec();
    if (createdSlotIds.length) await HospitalAppointmentSlotModel.deleteMany({ _id: { $in: createdSlotIds } }).exec();
    if (createdAvailabilityIds.length) await HospitalAppointmentAvailabilityModel.deleteMany({ _id: { $in: createdAvailabilityIds } }).exec();
    if (createdTripIds.length) await TripModel.deleteMany({ _id: { $in: createdTripIds } }).exec();
    if (createdPatientIds.length) await HospitalPatientModel.deleteMany({ _id: { $in: createdPatientIds } }).exec();
    if (createdEmergencyIds.length) await EmergencyRequestModel.deleteMany({ _id: { $in: createdEmergencyIds } }).exec();
    if (createdDriverIds.length) await AmbulanceDriverModel.deleteMany({ _id: { $in: createdDriverIds } }).exec();
    if (createdAmbulanceIds.length) await AmbulanceModel.deleteMany({ _id: { $in: createdAmbulanceIds } }).exec();
    if (createdProviderIds.length) await AmbulanceProviderModel.deleteMany({ _id: { $in: createdProviderIds } }).exec();
    if (createdHospitalIds.length) await HospitalModel.deleteMany({ _id: { $in: createdHospitalIds } }).exec();
    if (createdUserIds.length) await UserModel.deleteMany({ _id: { $in: createdUserIds } }).exec();

    await mongoose.disconnect();
  });

  describe('1. Hospital Cross-Tenant Data Isolation (Read & Write)', () => {
    it('allows Hospital 1 to read and update its own profile', async () => {
      const profile = await hospitalService.getProfile(hospital1Id);
      assert.equal(profile.id, hospital1Id);
      assert.ok(profile.name.includes('Hospital Alpha'));

      const updated = await hospitalService.updateProfile(hospital1Id, {
        operationalDescription: 'Primary trauma and emergency ward',
      });
      assert.equal(updated.operationalDescription, 'Primary trauma and emergency ward');
    });

    it('allows Hospital 1 to list and access its own emergencies and patients', async () => {
      const emergencies = await hospitalService.listEmergencies(hospital1Id, { page: 1, limit: 10, sortOrder: 'desc' });
      assert.ok(emergencies.items.some((e) => e.id === emergency1Id));
      assert.ok(!emergencies.items.some((e) => e.id === emergency2Id), 'Hospital 1 should NOT see Hospital 2 emergency');

      const emg = await hospitalService.getEmergency(hospital1Id, emergency1Id);
      assert.equal(emg.id, emergency1Id);
      assert.equal(emg.situationType, 'CARDIAC');

      const patients = await hospitalService.listPatients(hospital1Id, { page: 1, limit: 10, sortOrder: 'desc' });
      assert.ok(patients.items.some((p) => p.emergencyId === emergency1Id));
    });

    it('allows Hospital 1 to access its own appointments and care requests (positive)', async () => {
      const appt = await hospitalAppointmentService.getHospitalAppointmentById(hospital1Id, appointment1Id);
      assert.equal(String(appt._id), appointment1Id);

      const care = await hospitalCareRequestService.getHospitalCareRequestById(hospital1Id, careRequest1Id);
      assert.equal(String(care._id), careRequest1Id);
    });

    it('blocks Hospital 1 from reading Hospital 2 emergency records (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await hospitalService.getEmergency(hospital1Id, emergency2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Hospital 1 from mutating status of Hospital 2 emergency (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await hospitalService.updateEmergencyStatus(hospital1Id, emergency2Id, 'REVIEWING');
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Hospital 1 from reading Hospital 2 patient case records (fails closed with 404)', async () => {
      const pat2 = await HospitalPatientModel.findOne({ emergencyId: emergency2Id }).lean().exec();
      assert.ok(pat2);

      await assert.rejects(
        async () => {
          await hospitalService.getPatient(hospital1Id, pat2._id.toString());
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Hospital 1 from reading or responding to Hospital 2 care requests (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await hospitalCareRequestService.getHospitalCareRequestById(hospital1Id, careRequest2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );

      await assert.rejects(
        async () => {
          await hospitalCareRequestService.respondToCareRequest(hospital1Id, careRequest2Id, {
            action: 'ACCEPT',
            notes: 'Illegitimate cross-hospital acceptance',
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Hospital 1 from viewing or confirming Hospital 2 appointments (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await hospitalAppointmentService.getHospitalAppointmentById(hospital1Id, appointment2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );

      await assert.rejects(
        async () => {
          await hospitalAppointmentService.confirmHospitalAppointment(hospital1Id, appointment2Id, 'Confirmed');
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });
  });

  describe('2. Ambulance Provider Cross-Tenant Fleet & Driver Isolation', () => {
    it('allows Provider A to list and manage its own ambulances and drivers', async () => {
      const ambulances = await ambulanceOperationsService.listAmbulances(providerAId, { page: 1, limit: 10, sortOrder: 'desc' });
      const ambItems = ambulances.items as Array<{ id: string }>;
      assert.ok(ambItems.some((a) => a.id === ambulanceAId));
      assert.ok(!ambItems.some((a) => a.id === ambulanceBId), 'Provider A must not see Provider B ambulance in fleet list');

      const amb = await ambulanceOperationsService.getAmbulance(providerAId, ambulanceAId);
      assert.equal(amb.id, ambulanceAId);

      const drivers = await ambulanceOperationsService.listDrivers(providerAId, { page: 1, limit: 10, sortOrder: 'desc' });
      const drvItems = drivers.items as Array<{ id: string }>;
      assert.ok(drvItems.some((d) => d.id === driverAId));
      assert.ok(!drvItems.some((d) => d.id === driverBId), 'Provider A must not see Provider B driver in roster');
    });

    it('blocks Provider A from reading foreign Ambulance B (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await ambulanceOperationsService.getAmbulance(providerAId, ambulanceBId);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Provider A from updating foreign Ambulance B (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await ambulanceOperationsService.updateAmbulance(providerAId, ambulanceBId, {
            ambulanceType: 'MICU',
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Provider A from reading or updating foreign Driver B (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await ambulanceOperationsService.getDriver(providerAId, driverBId);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );

      await assert.rejects(
        async () => {
          await ambulanceOperationsService.updateDriver(providerAId, driverBId, {
            fullName: 'Malicious Driver Modification',
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Provider A from cross-tenant driver-to-ambulance assignment (foreign driver to own ambulance)', async () => {
      await assert.rejects(
        async () => {
          // Provider A tries to assign Driver B (belongs to Provider B) to Ambulance A
          await ambulanceOperationsService.assignDriver(providerAId, ambulanceAId, driverBId);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Provider A from cross-tenant driver-to-ambulance assignment (own driver to foreign ambulance)', async () => {
      await assert.rejects(
        async () => {
          // Provider A tries to assign Driver A to Ambulance B (belongs to Provider B)
          await ambulanceOperationsService.assignDriver(providerAId, ambulanceBId, driverAId);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Provider A from viewing Provider B trip records', async () => {
      await assert.rejects(
        async () => {
          await ambulanceOperationsService.getProviderTrip(providerAId, trip2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });
  });

  describe('3. Driver Operational Scope Isolation', () => {
    it('allows Driver A to access its own trip', async () => {
      const trip = await ambulanceOperationsService.getDriverTrip(driverAId, trip1Id);
      assert.equal(trip.id, trip1Id);
      assert.equal(trip.driverId, driverAId);
    });

    it('blocks Driver A from accessing Driver B trip (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await ambulanceOperationsService.getDriverTrip(driverAId, trip2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Driver A from modifying or transitioning Driver B trip status', async () => {
      await assert.rejects(
        async () => {
          await ambulanceOperationsService.arrivedPickup(driverAId, trip2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });
  });

  describe('4. Citizen Tenancy and Personal Record Isolation', () => {
    it('allows Citizen 1 to access their own emergency request', async () => {
      const emg = await emergencyService.getUserEmergencyRequest(user1Id, emergency1Id);
      assert.equal(emg.id, emergency1Id);
      assert.equal(emg.situationType, 'CARDIAC');
    });

    it('allows Citizen 1 to access their own appointments and care requests (positive)', async () => {
      const appt = await hospitalAppointmentService.getUserAppointmentById(user1Id, appointment1Id);
      assert.equal(String(appt._id), appointment1Id);

      const care = await hospitalCareRequestService.getUserCareRequestById(user1Id, careRequest1Id);
      assert.equal(String(care._id), careRequest1Id);
    });

    it('blocks Citizen 1 from viewing Citizen 2 emergency request (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await emergencyService.getUserEmergencyRequest(user1Id, emergency2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Citizen 1 from cancelling Citizen 2 emergency request (fails closed with 404)', async () => {
      await assert.rejects(
        async () => {
          await emergencyService.cancelUserEmergencyRequest(user1Id, emergency2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Citizen 1 from viewing or cancelling Citizen 2 appointment', async () => {
      await assert.rejects(
        async () => {
          await hospitalAppointmentService.getUserAppointmentById(user1Id, appointment2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );

      await assert.rejects(
        async () => {
          await hospitalAppointmentService.cancelUserAppointment(user1Id, appointment2Id, 'Attempted theft');
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });

    it('blocks Citizen 1 from viewing or cancelling Citizen 2 care request', async () => {
      await assert.rejects(
        async () => {
          await hospitalCareRequestService.getUserCareRequestById(user1Id, careRequest2Id);
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );

      await assert.rejects(
        async () => {
          await hospitalCareRequestService.cancelUserCareRequest(user1Id, careRequest2Id, 'Unauthorized cancel');
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'NOT_FOUND' && e.statusCode === 404;
        }
      );
    });
  });

  describe('5. Organization Membership Policy & Query Scoping Hierarchy', () => {
    it('allows Hospital 1 with ACTIVE membership to access organizational context', async () => {
      const principal: AuthenticatedIdentity = {
        id: hospital1Id,
        email: 'hosp1@test.local',
        name: 'Hospital 1',
        role: 'HOSPITAL',
        accountStatus: 'ACTIVE',
      };
      const membership = await requireOrganizationMembership({
        principal,
        organizationId: activeOrgId,
        permission: 'hospital:manage',
      });
      assert.equal(membership.principalType, 'HOSPITAL');
      assert.equal(membership.role, 'HOSPITAL_ADMIN');

      const orgIds = await getAuthorizedOrganizationIds(principal);
      assert.ok(orgIds.includes(activeOrgId.toString()));
    });

    it('denies access when organization is SUSPENDED (fails closed with 403 ORGANIZATION_SUSPENDED)', async () => {
      const principal: AuthenticatedIdentity = {
        id: hospital1Id,
        email: 'hosp1@test.local',
        name: 'Hospital 1',
        role: 'HOSPITAL',
        accountStatus: 'ACTIVE',
      };
      await assert.rejects(
        async () => {
          await requireOrganizationMembership({
            principal,
            organizationId: suspendedOrgId,
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'ORGANIZATION_SUSPENDED' && e.statusCode === 403;
        }
      );
    });

    it('denies access when principal has NO membership in organization (fails closed with 403 FORBIDDEN)', async () => {
      const principal: AuthenticatedIdentity = {
        id: hospital2Id, // Hospital 2 has no membership in activeOrg
        email: 'hosp2@test.local',
        name: 'Hospital 2',
        role: 'HOSPITAL',
        accountStatus: 'ACTIVE',
      };
      await assert.rejects(
        async () => {
          await requireOrganizationMembership({
            principal,
            organizationId: activeOrgId,
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'FORBIDDEN' && e.statusCode === 403;
        }
      );
    });

    it('denies access to citizens attempting organizational operations (fails closed with 403 FORBIDDEN)', async () => {
      const principal: AuthenticatedIdentity = {
        id: user1Id,
        email: 'citizen@test.local',
        name: 'Citizen 1',
        role: 'USER',
        accountStatus: 'ACTIVE',
      };
      await assert.rejects(
        async () => {
          await requireOrganizationMembership({
            principal,
            organizationId: activeOrgId,
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'FORBIDDEN' && e.statusCode === 403;
        }
      );
    });

    it('denies access when membership status is SUSPENDED or REVOKED', async () => {
      // Create suspended membership for Provider A
      const suspendedMem = await OrganizationMembershipModel.create({
        organizationId: activeOrgId,
        principalType: 'AMBULANCE_PROVIDER',
        principalId: new Types.ObjectId(providerAId),
        role: 'PROVIDER_ADMIN',
        permissions: ['dispatch:manage'],
        status: 'SUSPENDED',
      });
      createdMembershipIds.push(suspendedMem._id);

      const principal: AuthenticatedIdentity = {
        id: providerAId,
        email: 'prova@test.local',
        name: 'Provider A',
        role: 'AMBULANCE_PROVIDER',
        accountStatus: 'ACTIVE',
      };

      await assert.rejects(
        async () => {
          await requireOrganizationMembership({
            principal,
            organizationId: activeOrgId,
          });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'FORBIDDEN' && e.statusCode === 403;
        }
      );
    });

    it('enforces fail-closed query scoping (unmatchable query for principals without memberships)', async () => {
      const unassignedPrincipal: AuthenticatedIdentity = {
        id: hospital2Id,
        email: 'hosp2@test.local',
        name: 'Hospital 2',
        role: 'HOSPITAL',
        accountStatus: 'ACTIVE',
      };

      const scopedQuery = await scopeByOrganization(unassignedPrincipal, { status: 'ACTIVE' });
      assert.deepEqual(scopedQuery, {
        $and: [{ _id: { $in: [] } }, { status: 'ACTIVE' }],
      });
    });

    it('prevents caller-supplied filters from overriding tenant constraints using $and', async () => {
      const principal: AuthenticatedIdentity = {
        id: hospital1Id,
        email: 'hosp1@test.local',
        name: 'Hospital 1',
        role: 'HOSPITAL',
        accountStatus: 'ACTIVE',
      };

      const foreignOrgId = new Types.ObjectId().toString();
      await assert.rejects(
        async () => {
          await scopeByOrganization(principal, { organizationId: foreignOrgId });
        },
        (err: unknown) => {
          const e = err as { code?: string; statusCode?: number };
          return e.code === 'FORBIDDEN' && e.statusCode === 403;
        }
      );
    });

    it('assertResourceOrganization strictly fails closed on null or foreign org IDs', () => {
      assert.throws(
        () => {
          assertResourceOrganization({
            resourceOrganizationId: null,
            authorizedOrgIds: [activeOrgId.toString()],
          });
        },
        /Resource has no organization assignment/
      );

      assert.throws(
        () => {
          assertResourceOrganization({
            resourceOrganizationId: new Types.ObjectId().toString(),
            authorizedOrgIds: [activeOrgId.toString()],
          });
        },
        /Resource belongs to another organization/
      );
    });

    it('assertSameOrganization verifies that related entities share identical organization', () => {
      const commonOrg = new Types.ObjectId();
      assert.doesNotThrow(() => {
        assertSameOrganization(commonOrg, commonOrg);
      });

      assert.throws(
        () => {
          assertSameOrganization(commonOrg, new Types.ObjectId());
        },
        /Resources belong to different organizations/
      );

      assert.throws(
        () => {
          assertSameOrganization(commonOrg, null);
        },
        /Both resources must have valid organization assignments/
      );
    });
  });

  describe('6. Cross-Organization Emergency Workflows & Non-Forced Citizen Tenancy', () => {
    it('verifies that Citizen emergency requests are NOT forced into an organization', async () => {
      const emg = await EmergencyRequestModel.findById(emergency1Id).lean().exec();
      assert.ok(emg);
      assert.equal((emg as unknown as Record<string, unknown>).organizationId, undefined, 'EmergencyRequest must not be forced into an organization');
      assert.equal(String(emg.userId), user1Id, 'EmergencyRequest must remain strictly owned by the citizen');
    });

    it('validates explicit multi-participant authorization via assertEmergencyCoordinationAccess', () => {
      const emergencyContext = {
        patientId: user1Id,
        assignedHospitalId: hospital1Id,
        assignedProviderId: providerAId,
        assignedDriverId: driverAId,
      };

      // 1. Authorized Patient
      assert.doesNotThrow(() => {
        assertEmergencyCoordinationAccess(
          { id: user1Id, role: 'USER', email: 'u1@t.l', name: 'U1', accountStatus: 'ACTIVE' },
          emergencyContext
        );
      });

      // 2. Authorized Hospital
      assert.doesNotThrow(() => {
        assertEmergencyCoordinationAccess(
          { id: hospital1Id, role: 'HOSPITAL', email: 'h1@t.l', name: 'H1', accountStatus: 'ACTIVE' },
          emergencyContext
        );
      });

      // 3. Authorized Provider
      assert.doesNotThrow(() => {
        assertEmergencyCoordinationAccess(
          { id: providerAId, role: 'AMBULANCE_PROVIDER', email: 'pa@t.l', name: 'PA', accountStatus: 'ACTIVE' },
          emergencyContext
        );
      });

      // 4. Authorized Driver
      assert.doesNotThrow(() => {
        assertEmergencyCoordinationAccess(
          { id: driverAId, role: 'AMBULANCE_DRIVER', email: 'da@t.l', name: 'DA', accountStatus: 'ACTIVE' },
          emergencyContext
        );
      });

      // 5. System Administrator (explicit oversight)
      assert.doesNotThrow(() => {
        assertEmergencyCoordinationAccess(
          { id: new Types.ObjectId().toString(), role: 'ADMIN', email: 'admin@t.l', name: 'Admin', accountStatus: 'ACTIVE' },
          emergencyContext
        );
      });

      // 6. Unrelated Citizen (REJECTED)
      assert.throws(
        () => {
          assertEmergencyCoordinationAccess(
            { id: user2Id, role: 'USER', email: 'u2@t.l', name: 'U2', accountStatus: 'ACTIVE' },
            emergencyContext
          );
        },
        /Citizens can only access their own emergencies/
      );

      // 7. Unrelated Hospital (REJECTED)
      assert.throws(
        () => {
          assertEmergencyCoordinationAccess(
            { id: hospital2Id, role: 'HOSPITAL', email: 'h2@t.l', name: 'H2', accountStatus: 'ACTIVE' },
            emergencyContext
          );
        },
        /Hospital is not assigned to this emergency coordination/
      );

      // 8. Unrelated Provider (REJECTED)
      assert.throws(
        () => {
          assertEmergencyCoordinationAccess(
            { id: providerBId, role: 'AMBULANCE_PROVIDER', email: 'pb@t.l', name: 'PB', accountStatus: 'ACTIVE' },
            emergencyContext
          );
        },
        /Provider is not assigned to this emergency dispatch/
      );

      // 9. Unrelated Driver (REJECTED)
      assert.throws(
        () => {
          assertEmergencyCoordinationAccess(
            { id: driverBId, role: 'AMBULANCE_DRIVER', email: 'db@t.l', name: 'DB', accountStatus: 'ACTIVE' },
            emergencyContext
          );
        },
        /Driver is not assigned to this emergency dispatch/
      );
    });

    it('validates real-time tracking snapshot authorization via canAccessTrackingSnapshot', () => {
      const emergency = {
        _id: new Types.ObjectId(emergency1Id),
        userId: new Types.ObjectId(user1Id),
        hospitalId: new Types.ObjectId(hospital1Id),
        ambulanceProviderId: new Types.ObjectId(providerAId),
      };

      const trip = {
        driverId: new Types.ObjectId(driverAId),
        providerId: new Types.ObjectId(providerAId),
        destinationHospitalId: new Types.ObjectId(hospital1Id),
      };

      // Authorized actors
      assert.equal(canAccessTrackingSnapshot({ id: user1Id, role: 'USER', email: 'u1@t.l', name: 'U1', accountStatus: 'ACTIVE' }, emergency, trip), true);
      assert.equal(canAccessTrackingSnapshot({ id: hospital1Id, role: 'HOSPITAL', email: 'h1@t.l', name: 'H1', accountStatus: 'ACTIVE' }, emergency, trip), true);
      assert.equal(canAccessTrackingSnapshot({ id: providerAId, role: 'AMBULANCE_PROVIDER', email: 'pa@t.l', name: 'PA', accountStatus: 'ACTIVE' }, emergency, trip), true);
      assert.equal(canAccessTrackingSnapshot({ id: driverAId, role: 'AMBULANCE_DRIVER', email: 'da@t.l', name: 'DA', accountStatus: 'ACTIVE' }, emergency, trip), true);
      assert.equal(canAccessTrackingSnapshot({ id: new Types.ObjectId().toString(), role: 'ADMIN', email: 'ad@t.l', name: 'Admin', accountStatus: 'ACTIVE' }, emergency, trip), true);

      // Unauthorized actors
      assert.equal(canAccessTrackingSnapshot({ id: user2Id, role: 'USER', email: 'u2@t.l', name: 'U2', accountStatus: 'ACTIVE' }, emergency, trip), false);
      assert.equal(canAccessTrackingSnapshot({ id: hospital2Id, role: 'HOSPITAL', email: 'h2@t.l', name: 'H2', accountStatus: 'ACTIVE' }, emergency, trip), false);
      assert.equal(canAccessTrackingSnapshot({ id: providerBId, role: 'AMBULANCE_PROVIDER', email: 'pb@t.l', name: 'PB', accountStatus: 'ACTIVE' }, emergency, trip), false);
      assert.equal(canAccessTrackingSnapshot({ id: driverBId, role: 'AMBULANCE_DRIVER', email: 'db@t.l', name: 'DB', accountStatus: 'ACTIVE' }, emergency, trip), false);
    });
  });

  describe('7. Architecture Finding Audit: Hospital Ambulance Directory PII Exposure', () => {
    it('audits that hospitalService.listAmbulances currently returns cross-provider fleet without assignment scoping', async () => {
      // Calling listAmbulances as Hospital 1 returns ALL active ambulances in the database
      const result = await hospitalService.listAmbulances(hospital1Id, { page: 1, limit: 10, sortOrder: 'desc' });

      // Verifies that both Ambulance A (Provider A) and Ambulance B (Provider B) are visible to Hospital 1
      const foundA = result.items.find((a: { id: string }) => a.id === ambulanceAId);
      const foundB = result.items.find((a: { id: string }) => a.id === ambulanceBId);

      assert.ok(foundA, 'Ambulance A is returned');
      assert.ok(foundB, 'Ambulance B is also returned even though it belongs to Provider B without coordination linkage');

      // Verifies that driver personal information is exposed
      const ambDetail = await hospitalService.getAmbulance(hospital1Id, ambulanceBId);
      assert.equal(ambDetail.id, ambulanceBId);
      assert.ok(ambDetail.assignedDriverName?.startsWith('Driver Beta'), 'Driver name is exposed');
      assert.ok(ambDetail.assignedDriverPhone, 'Driver phone number is exposed in hospital directory');
      assert.equal(typeof ambDetail.currentLatitude, 'number', 'Real-time GPS coordinates are exposed in hospital directory');
    });
  });
});
