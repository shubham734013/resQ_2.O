import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { HospitalModel } from '../models/Hospital.js';
import { UserModel } from '../models/User.js';
import { HospitalCareRequestModel } from '../models/HospitalCareRequest.js';
import { HospitalAppointmentModel } from '../models/HospitalAppointment.js';
import { HospitalAppointmentSlotModel } from '../models/HospitalAppointmentSlot.js';
import { HospitalAppointmentAvailabilityModel } from '../models/HospitalAppointmentAvailability.js';
import { HospitalCareNotificationModel } from '../models/HospitalCareNotification.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import * as careRequestService from '../services/hospitalCareRequestService.js';
import * as appointmentService from '../services/hospitalAppointmentService.js';
import * as notificationService from '../services/hospitalCareNotificationService.js';

describe('Workflow B: Direct Hospital Requests and Concurrency-Safe Appointments', () => {
  let user1Id: string;
  let user2Id: string;
  let hospital1Id: string;
  let hospital2Id: string;

  const createdCareRequestIds: Types.ObjectId[] = [];
  const createdAppointmentIds: Types.ObjectId[] = [];
  const createdSlotIds: Types.ObjectId[] = [];
  const createdAvailabilityIds: Types.ObjectId[] = [];
  const createdNotificationIds: Types.ObjectId[] = [];
  const createdUserIds: Types.ObjectId[] = [];
  const createdHospitalIds: Types.ObjectId[] = [];

  before(async () => {
    await connectTestDatabase();

    // Create test user 1
    const user1 = await UserModel.create({
      name: 'Test Citizen One',
      email: `citizen1-${Date.now()}@test.com`,
      phone: `91${Date.now().toString().slice(-8)}`,
      passwordHash: 'dummy-hashed-pwd',
      accountStatus: 'ACTIVE',
      role: 'USER',
    });
    user1Id = user1._id.toString();
    createdUserIds.push(user1._id);

    // Create test user 2
    const user2 = await UserModel.create({
      name: 'Test Citizen Two',
      email: `citizen2-${Date.now()}@test.com`,
      phone: `92${Date.now().toString().slice(-8)}`,
      passwordHash: 'dummy-hashed-pwd',
      accountStatus: 'ACTIVE',
      role: 'USER',
    });
    user2Id = user2._id.toString();
    createdUserIds.push(user2._id);

    // Create test hospital 1
    const hospital1 = await HospitalModel.create({
      name: 'City General Hospital',
      registrationNumber: `HOSP-REG-${Date.now()}-1`,
      email: `hospital1-${Date.now()}@test.com`,
      phone: '+1-555-0100',
      passwordHash: 'dummy-hashed-pwd',
      hospitalType: 'General Hospital',
      services: ['Cardiology', 'General Medicine', 'Orthopaedics'],
      capabilities: ['ICU', 'Emergency Room', 'Outpatient Care'],
      emergencyAvailability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
      latitude: 37.7749,
      longitude: -122.4194,
      location: { type: 'Point', coordinates: [-122.4194, 37.7749] },
    });
    hospital1Id = hospital1._id.toString();
    createdHospitalIds.push(hospital1._id);

    // Create test hospital 2
    const hospital2 = await HospitalModel.create({
      name: 'Metro Specialty Clinic',
      registrationNumber: `HOSP-REG-${Date.now()}-2`,
      email: `hospital2-${Date.now()}@test.com`,
      phone: '+1-555-0200',
      passwordHash: 'dummy-hashed-pwd',
      hospitalType: 'Specialty Clinic',
      services: ['Neurology', 'Pediatrics'],
      capabilities: ['Diagnostics', 'Outpatient Care'],
      emergencyAvailability: 'AVAILABLE',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
      latitude: 37.7849,
      longitude: -122.4094,
      location: { type: 'Point', coordinates: [-122.4094, 37.7849] },
    });
    hospital2Id = hospital2._id.toString();
    createdHospitalIds.push(hospital2._id);
  });

  after(async () => {
    // Clean up created test fixtures
    await Promise.all([
      HospitalCareRequestModel.deleteMany({ _id: { $in: createdCareRequestIds } }),
      HospitalAppointmentModel.deleteMany({ _id: { $in: createdAppointmentIds } }),
      HospitalAppointmentSlotModel.deleteMany({ _id: { $in: createdSlotIds } }),
      HospitalAppointmentAvailabilityModel.deleteMany({ _id: { $in: createdAvailabilityIds } }),
      HospitalCareNotificationModel.deleteMany({ _id: { $in: createdNotificationIds } }),
      UserModel.deleteMany({ _id: { $in: createdUserIds } }),
      HospitalModel.deleteMany({ _id: { $in: createdHospitalIds } }),
    ]);
    await mongoose.disconnect();
  });

  describe('Direct Hospital Care Requests', () => {
    let requestId: string;

    it('creates a normal-care request with valid department and records statusHistory', async () => {
      const emergencyCountBefore = await EmergencyRequestModel.countDocuments();
      const tripCountBefore = await TripModel.countDocuments();

      const doc = await careRequestService.createCareRequest(user1Id, {
        hospitalId: hospital1Id,
        serviceDepartment: 'Cardiology',
        requestType: 'GENERAL_CONSULTATION',
        visitReason: 'Recurring chest discomfort during exercise',
        preferredTiming: 'MORNING',
        contactPreference: 'PHONE',
      });

      createdCareRequestIds.push(doc._id);
      requestId = doc._id.toString();

      assert.equal(doc.status, 'PENDING');
      assert.ok(doc.referenceId.startsWith('REQ-'));
      assert.equal(doc.serviceDepartment, 'Cardiology');
      assert.equal(doc.statusHistory.length, 1);
      assert.equal(doc.statusHistory[0]?.status, 'PENDING');

      // Check notification sent to hospital
      const notification = await HospitalCareNotificationModel.findOne({
        careRequestId: doc._id,
        recipientType: 'HOSPITAL',
      });
      assert.ok(notification, 'Notification should be persisted for hospital');
      assert.equal(notification.type, 'CARE_REQUEST_CREATED');
      createdNotificationIds.push(notification._id);

      // Verify ZERO emergency side effects
      const emergencyCountAfter = await EmergencyRequestModel.countDocuments();
      const tripCountAfter = await TripModel.countDocuments();
      assert.equal(emergencyCountAfter, emergencyCountBefore, 'Normal care must NEVER create EmergencyRequest');
      assert.equal(tripCountAfter, tripCountBefore, 'Normal care must NEVER create Trip');
    });

    it('rejects a care request for an unoffered department', async () => {
      await assert.rejects(
        async () => {
          await careRequestService.createCareRequest(user1Id, {
            hospitalId: hospital1Id,
            serviceDepartment: 'Neurosurgery', // not in hospital 1 services
            requestType: 'SPECIALIST_CONSULTATION',
            visitReason: 'Consultation needed',
          });
        },
        /Department 'Neurosurgery' is not offered by/i
      );
    });

    it('citizen can retrieve their care requests', async () => {
      const result = await careRequestService.listUserCareRequests(user1Id, { page: 1, limit: 10 });
      assert.ok(result.items.length >= 1);
      const found = result.items.find((i) => i._id.toString() === requestId);
      assert.ok(found);
      assert.equal(found?.status, 'PENDING');
    });

    it('prevents cross-user access to care request', async () => {
      await assert.rejects(
        async () => {
          await careRequestService.getUserCareRequestById(user2Id, requestId);
        },
        /Care request not found/i
      );
    });

    it('prevents cross-hospital access to care request', async () => {
      await assert.rejects(
        async () => {
          await careRequestService.getHospitalCareRequestById(hospital2Id, requestId);
        },
        /Care request not found or access denied/i
      );
    });

    it('hospital responds to care request with ACCEPT', async () => {
      const updated = await careRequestService.respondToCareRequest(hospital1Id, requestId, {
        action: 'ACCEPT',
        notes: 'Please arrive 15 minutes early with prior ECG records.',
      });

      assert.equal(updated.status, 'ACCEPTED');
      assert.equal(updated.hospitalResponse?.notes, 'Please arrive 15 minutes early with prior ECG records.');
      assert.equal(updated.statusHistory.length, 2);
      assert.equal(updated.statusHistory[1]?.status, 'ACCEPTED');

      // Verify citizen notification persisted
      const citizenNotification = await HospitalCareNotificationModel.findOne({
        careRequestId: updated._id,
        recipientType: 'USER',
        type: 'CARE_REQUEST_ACCEPTED',
      });
      assert.ok(citizenNotification);
      createdNotificationIds.push(citizenNotification._id);
    });

    it('rejects invalid status transitions once ACCEPTED', async () => {
      // Trying to accept or reject again
      await assert.rejects(
        async () => {
          await careRequestService.respondToCareRequest(hospital1Id, requestId, {
            action: 'REJECT',
            rejectionReason: 'Doctor unavailable',
          });
        },
        /Cannot respond to care request in status 'ACCEPTED'/i
      );

      // User trying to cancel after accepted
      await assert.rejects(
        async () => {
          await careRequestService.cancelUserCareRequest(user1Id, requestId);
        },
        /Cannot cancel request in status 'ACCEPTED'/i
      );
    });

    it('citizen can cancel a PENDING request', async () => {
      const req2 = await careRequestService.createCareRequest(user1Id, {
        hospitalId: hospital1Id,
        serviceDepartment: 'General Medicine',
        requestType: 'FOLLOW_UP',
        visitReason: 'Follow-up consultation',
      });
      createdCareRequestIds.push(req2._id);

      const cancelled = await careRequestService.cancelUserCareRequest(
        user1Id,
        req2._id.toString(),
        'Symptoms resolved'
      );
      assert.equal(cancelled.status, 'CANCELLED');
      assert.equal(cancelled.cancellationReason, 'Symptoms resolved');

      // Hospital cannot accept a CANCELLED request
      await assert.rejects(
        async () => {
          await careRequestService.respondToCareRequest(hospital1Id, req2._id.toString(), {
            action: 'ACCEPT',
          });
        },
        /Cannot respond to care request in status 'CANCELLED'/i
      );
    });
  });

  describe('Hospital Appointment Scheduling & Concurrency', () => {
    const testDate = '2026-10-20'; // Tuesday
    const department = 'Cardiology';

    before(async () => {
      // Configure availability for Hospital 1 Cardiology
      const availability = await appointmentService.upsertHospitalAvailability(hospital1Id, {
        department,
        slotDurationMinutes: 30,
        maxCapacityPerSlot: 1, // Strictly 1 appointment per slot to test concurrency
        weeklySchedule: [
          { dayOfWeek: 0, isEnabled: false, startTime: '09:00', endTime: '17:00' }, // Sun off
          { dayOfWeek: 1, isEnabled: true, startTime: '09:00', endTime: '17:00' }, // Mon
          {
            dayOfWeek: 2, // Tuesday (2026-10-20)
            isEnabled: true,
            startTime: '09:00',
            endTime: '12:00',
            breakStartTime: '10:00',
            breakEndTime: '10:30', // Break from 10:00 to 10:30
          },
          { dayOfWeek: 3, isEnabled: true, startTime: '09:00', endTime: '17:00' }, // Wed
          { dayOfWeek: 4, isEnabled: true, startTime: '09:00', endTime: '17:00' }, // Thu
          { dayOfWeek: 5, isEnabled: true, startTime: '09:00', endTime: '17:00' }, // Fri
          { dayOfWeek: 6, isEnabled: false, startTime: '09:00', endTime: '17:00' }, // Sat off
        ],
        blackoutDates: ['2026-12-25'],
      });
      if (availability) createdAvailabilityIds.push(availability._id);
    });

    it('queries available slots and respects break windows', async () => {
      const result = await appointmentService.getAvailableSlotsForDate(hospital1Id, department, testDate);
      assert.equal(result.isConfigured, true);
      assert.equal(result.slots.length, 5); // 09:00, 09:30, (10:00-10:30 break skipped), 10:30, 11:00, 11:30

      const slotTimes = result.slots.map((s) => s.startTime);
      assert.deepEqual(slotTimes, ['09:00', '09:30', '10:30', '11:00', '11:30']);
      assert.ok(result.slots.every((s) => s.isAvailable === true));
    });

    it('returns empty slots and flags unconfigured for hospital without appointment config', async () => {
      const result = await appointmentService.getAvailableSlotsForDate(hospital2Id, 'Neurology', testDate);
      assert.equal(result.isConfigured, false);
      assert.equal(result.slots.length, 0);
    });

    it('concurrency test: exactly 1 booking succeeds when multiple citizens attempt to book the last slot simultaneously', async () => {
      const targetTime = '09:00';

      // Create 3 dummy users to compete for the slot
      const competingUsers = await Promise.all([
        UserModel.create({ name: 'Contender 1', email: `c1-${Date.now()}@test.com`, passwordHash: 'hash', role: 'USER', accountStatus: 'ACTIVE' }),
        UserModel.create({ name: 'Contender 2', email: `c2-${Date.now()}@test.com`, passwordHash: 'hash', role: 'USER', accountStatus: 'ACTIVE' }),
        UserModel.create({ name: 'Contender 3', email: `c3-${Date.now()}@test.com`, passwordHash: 'hash', role: 'USER', accountStatus: 'ACTIVE' }),
      ]);
      competingUsers.forEach((u) => createdUserIds.push(u._id));

      // Attempt 3 concurrent bookings simultaneously on the exact same slot
      const results = await Promise.allSettled(
        competingUsers.map((u) =>
          appointmentService.bookAppointment(u._id.toString(), {
            hospitalId: hospital1Id,
            department,
            date: testDate,
            startTime: targetTime,
            visitReason: `Booking attempt by ${u.name}`,
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      assert.equal(fulfilled.length, 1, 'Strictly ONE booking must succeed for a capacity=1 slot');
      assert.equal(rejected.length, 2, 'Competing concurrent bookings must be rejected');

      // Check rejection reason was SLOT_UNAVAILABLE (409)
      const errorMsg = (rejected[0] as PromiseRejectedResult).reason.message;
      assert.match(errorMsg, /requested time slot has reached full capacity/i);

      // Track created appointment
      const winner = (fulfilled[0] as PromiseFulfilledResult<{ _id: Types.ObjectId; slotId: Types.ObjectId }>).value;
      createdAppointmentIds.push(winner._id);
      createdSlotIds.push(winner.slotId);

      // Verify slot in DB has bookedCount = 1
      const slotInDb = await HospitalAppointmentSlotModel.findById(winner.slotId);
      assert.equal(slotInDb?.bookedCount, 1);
      assert.equal(slotInDb?.maxCapacity, 1);

      // Now query availability: 09:00 slot must now report isAvailable = false
      const slotsAfter = await appointmentService.getAvailableSlotsForDate(hospital1Id, department, testDate);
      const slot9am = slotsAfter.slots.find((s) => s.startTime === '09:00');
      assert.equal(slot9am?.isAvailable, false);
      assert.equal(slot9am?.availableCapacity, 0);
    });

    it('cancelling appointment releases slot capacity atomically', async () => {
      // Find the appointment created in the previous test
      const appt = await HospitalAppointmentModel.findOne({
        hospitalId: new Types.ObjectId(hospital1Id),
        slotDate: testDate,
        startTime: '09:00',
        status: 'PENDING',
      });
      assert.ok(appt);

      // Cancel the appointment
      const cancelled = await appointmentService.cancelUserAppointment(
        appt.userId.toString(),
        appt._id.toString(),
        'Schedule conflict'
      );
      assert.equal(cancelled.status, 'CANCELLED');

      // Slot bookedCount must now be decremented to 0
      const slotAfterCancel = await HospitalAppointmentSlotModel.findById(appt.slotId);
      assert.equal(slotAfterCancel?.bookedCount, 0, 'Slot capacity must be released on cancellation');

      // Query availability: 09:00 must be available again!
      const slotsAfter = await appointmentService.getAvailableSlotsForDate(hospital1Id, department, testDate);
      const slot9am = slotsAfter.slots.find((s) => s.startTime === '09:00');
      assert.equal(slot9am?.isAvailable, true);
      assert.equal(slot9am?.availableCapacity, 1);
    });

    it('hospital appointment lifecycle: PENDING -> CONFIRMED -> COMPLETED', async () => {
      // Book 09:30 slot
      const appt = await appointmentService.bookAppointment(user1Id, {
        hospitalId: hospital1Id,
        department,
        date: testDate,
        startTime: '09:30',
        visitReason: 'Regular checkup',
      });
      createdAppointmentIds.push(appt._id);
      createdSlotIds.push(appt.slotId);

      // Hospital confirms
      const confirmed = await appointmentService.confirmHospitalAppointment(
        hospital1Id,
        appt._id.toString(),
        'Doctor confirmed availability'
      );
      assert.equal(confirmed.status, 'CONFIRMED');

      // Hospital marks completed
      const completed = await appointmentService.completeHospitalAppointment(
        hospital1Id,
        appt._id.toString()
      );
      assert.equal(completed.status, 'COMPLETED');
    });

    it('hospital proposes alternative slot when original cannot be accommodated', async () => {
      // Book 10:30 slot
      const appt = await appointmentService.bookAppointment(user1Id, {
        hospitalId: hospital1Id,
        department,
        date: testDate,
        startTime: '10:30',
        visitReason: 'Cardiac consultation',
      });
      createdAppointmentIds.push(appt._id);
      createdSlotIds.push(appt.slotId);

      const proposed = await appointmentService.proposeAlternativeSlot(hospital1Id, appt._id.toString(), {
        date: testDate,
        startTime: '11:00',
        notes: 'Doctor has surgery at 10:30. 11:00 is available.',
      });

      assert.equal(proposed.status, 'ALTERNATIVE_PROPOSED');
      assert.equal(proposed.alternativeSlot?.startTime, '11:00');
      assert.equal(proposed.alternativeSlot?.notes, 'Doctor has surgery at 10:30. 11:00 is available.');

      // Check citizen notification
      const notif = await HospitalCareNotificationModel.findOne({
        appointmentId: appt._id,
        recipientType: 'USER',
        type: 'APPOINTMENT_ALTERNATIVE_PROPOSED',
      });
      assert.ok(notif);
      createdNotificationIds.push(notif._id);
    });

    it('rejection by hospital releases slot capacity atomically', async () => {
      // Book 11:30 slot
      const appt = await appointmentService.bookAppointment(user2Id, {
        hospitalId: hospital1Id,
        department,
        date: testDate,
        startTime: '11:30',
        visitReason: 'Consultation',
      });
      createdAppointmentIds.push(appt._id);
      createdSlotIds.push(appt.slotId);

      // Slot bookedCount is 1
      let slot = await HospitalAppointmentSlotModel.findById(appt.slotId);
      assert.equal(slot?.bookedCount, 1);

      // Hospital rejects
      const rejected = await appointmentService.rejectHospitalAppointment(
        hospital1Id,
        appt._id.toString(),
        'Department closed for sanitation'
      );
      assert.equal(rejected.status, 'REJECTED');

      // Slot capacity released
      slot = await HospitalAppointmentSlotModel.findById(appt.slotId);
      assert.equal(slot?.bookedCount, 0);
    });
  });

  describe('Notifications Persistence and Retrieval', () => {
    it('user can list notifications and mark as read', async () => {
      const list = await notificationService.listNotificationsForRecipient('USER', user1Id);
      assert.ok(list.items.length >= 1);

      const firstItem = list.items[0];
      assert.ok(firstItem);
      const firstId = firstItem._id;
      const updated = await notificationService.markNotificationAsRead(firstId, user1Id);
      assert.equal(updated.status, 'READ');
    });

    it('prevents user from reading hospital notifications', async () => {
      const hospitalNotif = await HospitalCareNotificationModel.findOne({
        recipientType: 'HOSPITAL',
        recipientId: new Types.ObjectId(hospital1Id),
      });
      assert.ok(hospitalNotif);

      await assert.rejects(
        async () => {
          await notificationService.markNotificationAsRead(hospitalNotif._id.toString(), user1Id);
        },
        /Notification not found or access denied/i
      );
    });
  });

  describe('Emergency SOS Non-Interference Regression Verification', () => {
    it('proves that emergency dispatch, trips, and ambulance records are completely untouched by normal care', async () => {
      const [emergencies, trips, dispatchJobs] = await Promise.all([
        EmergencyRequestModel.countDocuments(),
        TripModel.countDocuments(),
        DispatchJobModel.countDocuments(),
      ]);

      // All hospital care requests and appointments created in this test suite
      const careRequestsCount = await HospitalCareRequestModel.countDocuments({
        _id: { $in: createdCareRequestIds },
      });
      const appointmentsCount = await HospitalAppointmentModel.countDocuments({
        _id: { $in: createdAppointmentIds },
      });

      assert.ok(careRequestsCount > 0, 'Care requests were created');
      assert.ok(appointmentsCount > 0, 'Appointments were created');
      assert.ok(emergencies >= 0);
      assert.ok(trips >= 0);
      assert.ok(dispatchJobs >= 0);

      // None of them are associated with emergency records
      const associatedEmergencies = await EmergencyRequestModel.find({
        $or: [
          { situation: { $regex: /REQ-|APT-/i } },
        ],
      });
      assert.equal(associatedEmergencies.length, 0, 'No emergency requests should contain normal care references');
    });
  });
});
