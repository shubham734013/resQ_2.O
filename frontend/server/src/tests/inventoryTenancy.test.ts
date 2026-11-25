import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { Types } from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { OrganizationModel } from '../models/Organization.js';
import { OrganizationMembershipModel } from '../models/OrganizationMembership.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';
import { UserModel } from '../models/User.js';
import {
  runTenancyInventory,
  saveReportToFile,
  InventoryThresholdExceededError,
  type TenancyInventoryReport,
} from '../scripts/inventoryTenancy.js';

class FixtureRegistry {
  public orgIds: Types.ObjectId[] = [];
  public membershipIds: Types.ObjectId[] = [];
  public hospitalIds: Types.ObjectId[] = [];
  public providerIds: Types.ObjectId[] = [];
  public ambulanceIds: Types.ObjectId[] = [];
  public driverIds: Types.ObjectId[] = [];
  public userIds: Types.ObjectId[] = [];
  public emergencyIds: Types.ObjectId[] = [];
  public tripIds: Types.ObjectId[] = [];
  public patientIds: Types.ObjectId[] = [];

  public async cleanup(): Promise<void> {
    const deletions: Promise<unknown>[] = [];

    if (this.membershipIds.length > 0) {
      deletions.push(OrganizationMembershipModel.deleteMany({ _id: { $in: this.membershipIds } }).exec());
    }
    if (this.tripIds.length > 0) {
      deletions.push(TripModel.deleteMany({ _id: { $in: this.tripIds } }).exec());
    }
    if (this.patientIds.length > 0) {
      deletions.push(HospitalPatientModel.deleteMany({ _id: { $in: this.patientIds } }).exec());
    }
    if (this.emergencyIds.length > 0) {
      deletions.push(EmergencyRequestModel.deleteMany({ _id: { $in: this.emergencyIds } }).exec());
    }
    if (this.driverIds.length > 0) {
      deletions.push(AmbulanceDriverModel.deleteMany({ _id: { $in: this.driverIds } }).exec());
    }
    if (this.ambulanceIds.length > 0) {
      deletions.push(AmbulanceModel.deleteMany({ _id: { $in: this.ambulanceIds } }).exec());
    }
    if (this.providerIds.length > 0) {
      deletions.push(AmbulanceProviderModel.deleteMany({ _id: { $in: this.providerIds } }).exec());
    }
    if (this.hospitalIds.length > 0) {
      deletions.push(HospitalModel.deleteMany({ _id: { $in: this.hospitalIds } }).exec());
    }
    if (this.orgIds.length > 0) {
      deletions.push(OrganizationModel.deleteMany({ _id: { $in: this.orgIds } }).exec());
    }
    if (this.userIds.length > 0) {
      deletions.push(UserModel.deleteMany({ _id: { $in: this.userIds } }).exec());
    }

    await Promise.allSettled(deletions);
  }
}

describe('DATA-01 Multi-Tenancy Read-Only Inventory Audit (TASK 02A)', () => {
  const registry = new FixtureRegistry();

  let validHospitalOrgId: Types.ObjectId;
  let validProviderOrgId: Types.ObjectId;
  let orphanOrgId: Types.ObjectId;

  let validHospitalId: Types.ObjectId;
  let hospitalWithoutOrgId: Types.ObjectId;
  let hospitalWrongOrgId: Types.ObjectId;

  let validProviderId: Types.ObjectId;
  let otherProviderId: Types.ObjectId;
  let providerWithoutOrgId: Types.ObjectId;
  let providerWrongOrgId: Types.ObjectId;

  let validAmbulanceId: Types.ObjectId;
  let otherAmbulanceId: Types.ObjectId;
  let orphanedAmbulanceId: Types.ObjectId;

  let validDriverId: Types.ObjectId;
  let orphanedDriverId: Types.ObjectId;
  let driverFakeAmbulanceId: Types.ObjectId;
  let mismatchedDriverId: Types.ObjectId;

  let citizenUserId: Types.ObjectId;
  let validEmergencyId: Types.ObjectId;
  let inProgressEmergencyId: Types.ObjectId;
  let conflictingEmergencyId: Types.ObjectId;
  let validTripId: Types.ObjectId;
  let tripWithoutDriverId: Types.ObjectId;
  let invalidTripId: Types.ObjectId;

  before(async () => {
    await connectTestDatabase();

    try {
      // 1. Create Organizations
      const [hospOrg, provOrg, orphanOrg] = await Promise.all([
        OrganizationModel.create({
          name: 'TEST_Metro Health Network',
          type: 'HOSPITAL_NETWORK',
          status: 'ACTIVE',
        }),
        OrganizationModel.create({
          name: 'TEST_City Ambulance Fleet',
          type: 'AMBULANCE_OPERATOR',
          status: 'ACTIVE',
        }),
        OrganizationModel.create({
          name: 'TEST_Orphan Network',
          type: 'HOSPITAL_NETWORK',
          status: 'ACTIVE',
        }),
      ]);
      validHospitalOrgId = hospOrg._id;
      validProviderOrgId = provOrg._id;
      orphanOrgId = orphanOrg._id;
      registry.orgIds.push(hospOrg._id, provOrg._id, orphanOrg._id);

      // 2. Create Hospitals
      const [hosp1, hosp2, hosp3] = await Promise.all([
        HospitalModel.create({
          name: 'TEST_Metro Central Hospital',
          registrationNumber: 'TEST_HOSP_001',
          email: 'test_hosp_001@example.com',
          phone: '1234567890',
          passwordHash: 'hashed_secret_hosp_1',
          hospitalType: 'General',
          organizationId: validHospitalOrgId,
        }),
        HospitalModel.create({
          name: 'TEST_Suburban Clinic Standalone',
          registrationNumber: 'TEST_HOSP_002',
          email: 'test_hosp_002@example.com',
          phone: '1234567891',
          passwordHash: 'hashed_secret_hosp_2',
          hospitalType: 'Clinic',
          // No organizationId (Anomaly 1)
        }),
        HospitalModel.create({
          name: 'TEST_Cross Type Hospital',
          registrationNumber: 'TEST_HOSP_003',
          email: 'test_hosp_003@example.com',
          phone: '1234567892',
          passwordHash: 'hashed_secret_hosp_3',
          hospitalType: 'Specialty',
          organizationId: validProviderOrgId, // Wrong org type (Anomaly 7)
        }),
      ]);
      validHospitalId = hosp1._id;
      hospitalWithoutOrgId = hosp2._id;
      hospitalWrongOrgId = hosp3._id;
      registry.hospitalIds.push(hosp1._id, hosp2._id, hosp3._id);

      // 3. Create Providers
      const [prov1, prov2, prov3, prov4] = await Promise.all([
        AmbulanceProviderModel.create({
          name: 'TEST_City Ambulance Corp',
          registrationNumber: 'TEST_PROV_001',
          email: 'test_prov_001@example.com',
          phone: '1234567893',
          serviceType: 'Emergency',
          organizationId: validProviderOrgId,
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Other Ambulance Corp',
          registrationNumber: 'TEST_PROV_002',
          email: 'test_prov_002@example.com',
          phone: '1234567894',
          serviceType: 'Emergency',
          organizationId: validProviderOrgId,
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Independent Operator',
          registrationNumber: 'TEST_PROV_003',
          email: 'test_prov_003@example.com',
          phone: '1234567895',
          serviceType: 'Emergency',
          // No organizationId (Anomaly 2)
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Cross Type Provider',
          registrationNumber: 'TEST_PROV_004',
          email: 'test_prov_004@example.com',
          phone: '1234567896',
          serviceType: 'Emergency',
          organizationId: validHospitalOrgId, // Wrong org type (Anomaly 7)
        }),
      ]);
      validProviderId = prov1._id;
      otherProviderId = prov2._id;
      providerWithoutOrgId = prov3._id;
      providerWrongOrgId = prov4._id;
      registry.providerIds.push(prov1._id, prov2._id, prov3._id, prov4._id);

      // 4. Create Memberships
      const [mem1, mem2, mem3, mem4, mem5] = await Promise.all([
        // Valid memberships
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: validHospitalId,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
        }),
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: validProviderId,
          role: 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        }),
        // Membership with nonexistent org (Anomaly 4)
        OrganizationMembershipModel.create({
          organizationId: new Types.ObjectId(),
          principalType: 'HOSPITAL',
          principalId: validHospitalId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // Membership with nonexistent principal (Anomaly 5)
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: new Types.ObjectId(),
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // Ambiguous multiple active memberships for validHospitalId (Anomaly 14)
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'HOSPITAL',
          principalId: validHospitalId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
      ]);
      registry.membershipIds.push(mem1._id, mem2._id, mem3._id, mem4._id, mem5._id);

      // Incompatible principal type fixture (Anomaly 6)
      const rawIncompatible = await OrganizationMembershipModel.collection.insertOne({
        organizationId: validHospitalOrgId,
        principalType: 'UNKNOWN_TYPE',
        principalId: new Types.ObjectId(),
        role: 'ORG_MEMBER',
        status: 'ACTIVE',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      registry.membershipIds.push(rawIncompatible.insertedId as unknown as Types.ObjectId);

      // 5. Create Ambulances
      const [amb1, amb2, amb3] = await Promise.all([
        AmbulanceModel.create({
          registrationNumber: 'TEST_AMB_REG_001',
          vehicleNumber: 'TEST_AMB_001',
          providerId: validProviderId,
          ambulanceType: 'ALS',
          currentStatus: 'AVAILABLE',
        }),
        AmbulanceModel.create({
          registrationNumber: 'TEST_AMB_REG_002',
          vehicleNumber: 'TEST_AMB_002',
          providerId: otherProviderId,
          ambulanceType: 'BLS',
          currentStatus: 'AVAILABLE',
        }),
        AmbulanceModel.create({
          registrationNumber: 'TEST_AMB_REG_003',
          vehicleNumber: 'TEST_AMB_003',
          providerId: new Types.ObjectId(), // Nonexistent provider (Anomaly 11)
          ambulanceType: 'ALS',
          currentStatus: 'OFFLINE',
        }),
      ]);
      validAmbulanceId = amb1._id;
      otherAmbulanceId = amb2._id;
      orphanedAmbulanceId = amb3._id;
      registry.ambulanceIds.push(amb1._id, amb2._id, amb3._id);

      // 6. Create Drivers
      const [drv1, drv2, drv3, drv4] = await Promise.all([
        AmbulanceDriverModel.create({
          fullName: 'TEST_John Doe',
          email: 'test_inventory_driver1@example.com',
          phone: '1234567897',
          passwordHash: 'secret_driver_1',
          licenseNumber: 'TEST_DRV_001',
          providerId: validProviderId,
          assignedAmbulanceId: validAmbulanceId,
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Orphaned Driver',
          email: 'test_inventory_driver2@example.com',
          phone: '1234567898',
          passwordHash: 'secret_driver_2',
          licenseNumber: 'TEST_DRV_002',
          providerId: new Types.ObjectId(), // Nonexistent provider (Anomaly 8)
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Fake Ambulance',
          email: 'test_inventory_driver3@example.com',
          phone: '1234567899',
          passwordHash: 'secret_driver_3',
          licenseNumber: 'TEST_DRV_003',
          providerId: validProviderId,
          assignedAmbulanceId: new Types.ObjectId(), // Nonexistent ambulance (Anomaly 9)
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Mismatched Provider Driver',
          email: 'test_inventory_driver4@example.com',
          phone: '1234567800',
          passwordHash: 'secret_driver_4',
          licenseNumber: 'TEST_DRV_004',
          providerId: validProviderId,
          assignedAmbulanceId: otherAmbulanceId, // Belonging to otherProviderId (Anomaly 10)
        }),
      ]);
      validDriverId = drv1._id;
      orphanedDriverId = drv2._id;
      driverFakeAmbulanceId = drv3._id;
      mismatchedDriverId = drv4._id;
      registry.driverIds.push(drv1._id, drv2._id, drv3._id, drv4._id);

      // 7. Create User
      const user = await UserModel.create({
        name: 'TEST_Citizen User',
        email: 'test_inventory_citizen@example.com',
        passwordHash: 'secret_user',
        role: 'USER',
      });
      citizenUserId = user._id;
      registry.userIds.push(user._id);

      // 8. Create Emergency Requests
      const [em1, em2, em3] = await Promise.all([
        EmergencyRequestModel.create({
          requestCode: 'TEST_REQ_001',
          userId: citizenUserId,
          hospitalId: validHospitalId,
          situationType: 'Critical',
          reportedAt: new Date(),
          ambulanceId: validAmbulanceId,
          ambulanceProviderId: validProviderId,
          driverId: validDriverId,
        }),
        // Normal in-progress emergency (unassigned ambulance/driver is NOT an anomaly)
        EmergencyRequestModel.create({
          requestCode: 'TEST_REQ_IN_PROGRESS',
          userId: citizenUserId,
          hospitalId: validHospitalId,
          situationType: 'Reviewing',
          reportedAt: new Date(),
        }),
        EmergencyRequestModel.create({
          requestCode: 'TEST_REQ_CONFLICT',
          userId: citizenUserId,
          hospitalId: validHospitalId,
          situationType: 'Critical',
          reportedAt: new Date(),
          ambulanceId: validAmbulanceId, // Belongs to validProviderId
          ambulanceProviderId: otherProviderId, // Conflicts with ambulance provider! (Anomaly 13)
        }),
      ]);
      validEmergencyId = em1._id;
      inProgressEmergencyId = em2._id;
      conflictingEmergencyId = em3._id;
      registry.emergencyIds.push(em1._id, em2._id, em3._id);

      // 9. Create Trips
      const [tr1, tr2, tr3] = await Promise.all([
        TripModel.create({
          emergencyRequestId: validEmergencyId,
          providerId: validProviderId,
          ambulanceId: validAmbulanceId,
          driverId: validDriverId,
          destinationHospitalId: validHospitalId,
          status: 'ASSIGNED',
        }),
        // Valid trip without driver (driverId is optional in Trip schema)
        TripModel.create({
          emergencyRequestId: inProgressEmergencyId,
          providerId: validProviderId,
          ambulanceId: validAmbulanceId,
          destinationHospitalId: validHospitalId,
          status: 'ASSIGNED',
        }),
        TripModel.create({
          emergencyRequestId: validEmergencyId,
          providerId: validProviderId,
          ambulanceId: otherAmbulanceId, // Mismatched ambulance provider (Anomaly 12)
          destinationHospitalId: validHospitalId,
          status: 'ASSIGNED',
        }),
      ]);
      validTripId = tr1._id;
      tripWithoutDriverId = tr2._id;
      invalidTripId = tr3._id;
      registry.tripIds.push(tr1._id, tr2._id, tr3._id);

      // 10. Create Hospital Patient
      const patient = await HospitalPatientModel.create({
        caseId: 'TEST_CASE_001',
        hospitalId: validHospitalId,
        emergencyId: validEmergencyId,
        ambulanceId: validAmbulanceId,
        emergencyType: 'Trauma',
      });
      registry.patientIds.push(patient._id);
    } catch (err) {
      await registry.cleanup();
      throw err;
    }
  });

  after(async () => {
    try {
      await registry.cleanup();
    } finally {
      await mongoose.disconnect();
    }
  });

  it('1. static guard: asserts integration test file contains no unfiltered destructive deletes', () => {
    const currentFilePath = fileURLToPath(import.meta.url);
    const testCode = fs.readFileSync(currentFilePath, 'utf-8');

    // Strip this guard test block itself so string literals inside the test do not trigger the check
    const codeToInspect = testCode.replace(/static guard:[\s\S]*?\}\);/, '');

    const unfilteredDeleteRegex = /deleteMany\(\s*\{\s*\}\s*\)/g;
    const matches = codeToInspect.match(unfilteredDeleteRegex);
    assert.equal(matches, null, 'Integration test suite must NEVER use unfiltered deleteMany');
  });

  it('2. inventories aggregate counts accurately for all entities and relationships', async () => {
    const report = await runTenancyInventory();

    assert.equal(report.connected, true);
    assert.ok(report.counts.organizations.total >= 3);
    assert.ok(report.counts.memberships.total >= 6);
    assert.ok(report.counts.hospitals.total >= 3);
    assert.ok(report.counts.hospitals.withoutOrganization >= 1);
    assert.ok(report.counts.providers.total >= 4);
    assert.ok(report.counts.providers.withoutOrganization >= 1);
    assert.ok(report.counts.ambulances.total >= 3);
    assert.ok(report.counts.drivers.total >= 4);
    assert.ok(report.counts.trips.total >= 3);
    assert.ok(report.counts.emergencyRequests.total >= 3);
    assert.ok(report.counts.hospitalPatients.total >= 1);
  });

  it('3. detects missing organization assignments on hospitals and providers', async () => {
    const report = await runTenancyInventory();

    const hospAnomalies = report.anomalies.filter((a) => a.category === 'HOSPITALS_WITHOUT_ORGANIZATION');
    const provAnomalies = report.anomalies.filter((a) => a.category === 'PROVIDERS_WITHOUT_ORGANIZATION');

    assert.ok(hospAnomalies.some((a) => a.documentId === String(hospitalWithoutOrgId)));
    assert.ok(provAnomalies.some((a) => a.documentId === String(providerWithoutOrgId)));
  });

  it('4. detects organizations with no active memberships', async () => {
    const report = await runTenancyInventory();

    const emptyOrgAnomalies = report.anomalies.filter((a) => a.category === 'ORGANIZATIONS_WITHOUT_MEMBERSHIPS');
    assert.ok(emptyOrgAnomalies.some((a) => a.documentId === String(orphanOrgId)));
  });

  it('5. detects invalid foreign references in memberships and models', async () => {
    const report = await runTenancyInventory();

    const nonExistentOrg = report.anomalies.filter((a) => a.category === 'MEMBERSHIPS_WITH_NONEXISTENT_ORGANIZATION');
    const nonExistentPrincipal = report.anomalies.filter((a) => a.category === 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL');
    const incompatiblePrincipal = report.anomalies.filter((a) => a.category === 'MEMBERSHIPS_WITH_INCOMPATIBLE_PRINCIPAL_TYPE');

    assert.ok(nonExistentOrg.length >= 1);
    assert.ok(nonExistentPrincipal.length >= 1);
    assert.ok(incompatiblePrincipal.length >= 1);
  });

  it('6. detects entities linked to the wrong organization type', async () => {
    const report = await runTenancyInventory();

    const wrongTypeAnomalies = report.anomalies.filter((a) => a.category === 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE');
    assert.ok(wrongTypeAnomalies.some((a) => a.documentId === String(hospitalWrongOrgId)));
    assert.ok(wrongTypeAnomalies.some((a) => a.documentId === String(providerWrongOrgId)));
  });

  it('7. detects orphaned drivers, ambulances, and mismatched ambulance-driver relationships', async () => {
    const report = await runTenancyInventory();

    const drvNoProv = report.anomalies.filter((a) => a.category === 'DRIVERS_WITH_NONEXISTENT_PROVIDER');
    const drvNoAmb = report.anomalies.filter((a) => a.category === 'DRIVERS_WITH_NONEXISTENT_ASSIGNED_AMBULANCE');
    const drvMismatch = report.anomalies.filter((a) => a.category === 'DRIVERS_ASSIGNED_AMBULANCE_PROVIDER_MISMATCH');
    const ambNoProv = report.anomalies.filter((a) => a.category === 'AMBULANCES_WITH_NONEXISTENT_PROVIDER');

    assert.ok(drvNoProv.some((a) => a.documentId === String(orphanedDriverId)));
    assert.ok(drvNoAmb.some((a) => a.documentId === String(driverFakeAmbulanceId)));
    assert.ok(drvMismatch.some((a) => a.documentId === String(mismatchedDriverId)));
    assert.ok(ambNoProv.some((a) => a.documentId === String(orphanedAmbulanceId)));
  });

  it('8. detects trips with invalid provider or ambulance relationships while respecting optional driverId', async () => {
    const report = await runTenancyInventory();

    const tripAnomalies = report.anomalies.filter((a) => a.category === 'TRIPS_WITH_INVALID_REFERENCES');
    assert.ok(tripAnomalies.some((a) => a.documentId === String(invalidTripId)));
    // Trip without driver must NOT be flagged as an anomaly
    assert.ok(!tripAnomalies.some((a) => a.documentId === String(tripWithoutDriverId)));
    assert.ok(!tripAnomalies.some((a) => a.documentId === String(validTripId)));
  });

  it('9. detects emergency conflicts while respecting normal in-progress unassigned state', async () => {
    const report = await runTenancyInventory();

    const emergencyAnomalies = report.anomalies.filter((a) => a.category === 'EMERGENCY_ASSIGNMENT_CONFLICTS');
    assert.ok(emergencyAnomalies.some((a) => a.documentId === String(conflictingEmergencyId)));
    // Unassigned in-progress emergency must NOT be flagged as an anomaly
    assert.ok(!emergencyAnomalies.some((a) => a.documentId === String(inProgressEmergencyId)));
    assert.ok(!emergencyAnomalies.some((a) => a.documentId === String(validEmergencyId)));
  });

  it('10. detects ambiguous or conflicting multiple memberships', async () => {
    const report = await runTenancyInventory();

    const ambigAnomalies = report.anomalies.filter((a) => a.category === 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS');
    assert.ok(ambigAnomalies.some((a) => a.documentId === String(validHospitalId)));
  });

  it('11. classifies proposed mappings into deterministic vs manual review', async () => {
    const report = await runTenancyInventory();

    // Standalone hospital without org should deterministically propose CREATE_ORGANIZATION
    const hospMapping = report.proposedMappings.find((m) => m.sourceId === String(hospitalWithoutOrgId));
    assert.ok(hospMapping);
    assert.equal(hospMapping.proposedAction, 'CREATE_ORGANIZATION');
    assert.equal(hospMapping.proposedOrganizationType, 'HOSPITAL_NETWORK');
    assert.equal(hospMapping.confidence, 'DETERMINISTIC');
    assert.equal(hospMapping.requiresManualReview, false);

    // Ambulance with valid provider should inherit provider org deterministically
    const ambMapping = report.proposedMappings.find((m) => m.sourceId === String(validAmbulanceId));
    assert.ok(ambMapping);
    assert.equal(ambMapping.proposedAction, 'INHERIT_PROVIDER_ORGANIZATION');
    assert.equal(ambMapping.confidence, 'DETERMINISTIC');
    assert.equal(ambMapping.requiresManualReview, false);

    // Orphaned driver must require manual review
    const drvMapping = report.proposedMappings.find((m) => m.sourceId === String(orphanedDriverId));
    assert.ok(drvMapping);
    assert.equal(drvMapping.proposedAction, 'MANUAL_REVIEW_REQUIRED');
    assert.equal(drvMapping.confidence, 'INVALID');
    assert.equal(drvMapping.requiresManualReview, true);

    // Mismatched driver must require manual review
    const mismatchMapping = report.proposedMappings.find((m) => m.sourceId === String(mismatchedDriverId));
    assert.ok(mismatchMapping);
    assert.equal(mismatchMapping.proposedAction, 'MANUAL_REVIEW_REQUIRED');
    assert.equal(mismatchMapping.confidence, 'AMBIGUOUS');
    assert.equal(mismatchMapping.requiresManualReview, true);
  });

  it('12. read-only guarantee: zero write operations invoked on models during inventory', async () => {
    let writeCalls = 0;
    const writeMethods = ['create', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany', 'bulkWrite'];

    type GenericFn = (...args: unknown[]) => unknown;
    const originalMethods = new Map<string, GenericFn>();
    const models = [
      OrganizationModel,
      OrganizationMembershipModel,
      HospitalModel,
      AmbulanceProviderModel,
      AmbulanceModel,
      AmbulanceDriverModel,
      EmergencyRequestModel,
      TripModel,
      HospitalPatientModel,
      UserModel,
    ];

    for (const model of models) {
      for (const method of writeMethods) {
        const key = `${model.modelName}.${method}`;
        const orig = (model as unknown as Record<string, GenericFn>)[method];
        if (typeof orig === 'function') {
          originalMethods.set(key, orig);
          (model as unknown as Record<string, GenericFn>)[method] = (...args: unknown[]) => {
            writeCalls++;
            return orig.apply(model, args);
          };
        }
      }
    }

    let report: TenancyInventoryReport;
    try {
      report = await runTenancyInventory();
    } finally {
      // Restore original methods
      for (const model of models) {
        for (const method of writeMethods) {
          const key = `${model.modelName}.${method}`;
          const orig = originalMethods.get(key);
          if (orig) {
            (model as unknown as Record<string, GenericFn>)[method] = orig;
          }
        }
      }
    }

    assert.equal(writeCalls, 0, 'Zero write methods must be called on models during inventory execution');
    assert.equal(report.readOnlyAudit.readOnlyImplementation, true);
    assert.equal(report.readOnlyAudit.executionPathAudited, true);
    assert.ok(report.readOnlyAudit.operationsAudited.length >= 3);
    assert.ok(report.readOnlyAudit.databaseLevelEnforcementRecommendation.includes('least-privilege "read"'));
    assert.ok(report.readOnlyAudit.auditLimitations.includes('Application-level code path verification'));
  });

  it('13. multi-batch streaming: processes all records across multiple chunked pages without duplicates or skips', async () => {
    // Run with batchSize: 2 on fixtures containing > 3 records per collection
    const chunkedReport = await runTenancyInventory({ batchSize: 2 });
    const standardReport = await runTenancyInventory({ batchSize: 500 });

    assert.equal(chunkedReport.mappingSummary.total, standardReport.mappingSummary.total);
    assert.equal(chunkedReport.mappingSummary.deterministic, standardReport.mappingSummary.deterministic);
    assert.equal(chunkedReport.mappingSummary.ambiguous, standardReport.mappingSummary.ambiguous);
    assert.equal(chunkedReport.mappingSummary.invalid, standardReport.mappingSummary.invalid);

    // Verify all source IDs in mappings are unique (no duplicates across batches)
    const sourceIds = chunkedReport.proposedMappings.map((m) => `${m.sourceEntity}:${m.sourceId}`);
    const uniqueSourceIds = new Set(sourceIds);
    assert.equal(sourceIds.length, uniqueSourceIds.size, 'No records must be processed twice across batches');
  });

  it('14. threshold guard: throws InventoryThresholdExceededError when limits are exceeded', async () => {
    await assert.rejects(
      async () => {
        await runTenancyInventory({ maxMappings: 1 });
      },
      (err: unknown) => {
        assert.ok(err instanceof InventoryThresholdExceededError);
        assert.equal(err.thresholdType, 'MAPPINGS');
        assert.equal(err.limit, 1);
        return true;
      }
    );
  });

  it('15. data confidentiality: default report contains no PII, secrets, or unallowlisted fields', async () => {
    const report = await runTenancyInventory();
    const tempReportPath = path.resolve(process.cwd(), 'reports', 'test-confidentiality-inventory.report.json');

    try {
      const savedPath = saveReportToFile(report, tempReportPath);
      assert.ok(fs.existsSync(savedPath));

      const content = fs.readFileSync(savedPath, 'utf-8');
      const parsed = JSON.parse(content) as Record<string, unknown>;

      // 1. Check top-level allowlisted keys
      const allowlistedTopLevelKeys = new Set([
        'timestamp',
        'databaseName',
        'connected',
        'counts',
        'anomalies',
        'anomalySummary',
        'proposedMappings',
        'mappingSummary',
        'ambiguousRecords',
        'readOnlyAudit',
      ]);
      for (const key of Object.keys(parsed)) {
        assert.ok(allowlistedTopLevelKeys.has(key), `Unallowlisted top-level key found in report: '${key}'`);
      }

      // 2. Assert personal data and secret patterns are ABSENT from default output
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      assert.ok(!emailPattern.test(content), 'Report must not contain email addresses');

      const phonePattern = /\b12345678\d{2}\b/;
      assert.ok(!phonePattern.test(content), 'Report must not contain telephone numbers');

      assert.ok(!content.includes('TEST_John Doe'), 'Report must not contain personal names');
      assert.ok(!content.includes('TEST_Citizen User'), 'Report must not contain citizen patient names');
      assert.ok(!content.includes('hashed_secret_hosp_1'), 'Report must not contain password hashes');
      assert.ok(!content.includes('secret_driver_1'), 'Report must not contain secrets');
      assert.ok(!content.includes('passwordHash'), 'Report must not contain passwordHash fields');

      // 3. Verify restrictive file permissions (0o600: read/write by owner only) on POSIX
      const stat = fs.statSync(savedPath);
      const fileMode = stat.mode & 0o777;
      assert.equal(fileMode, 0o600, 'Report file must be created with restrictive 0o600 permissions');
    } finally {
      if (fs.existsSync(tempReportPath)) {
        fs.unlinkSync(tempReportPath);
      }
    }
  });

  it('16. restricted mode: includes safe operational identifiers only when explicitly requested', async () => {
    const reportWithIdentifiers = await runTenancyInventory({ includeDetailedIdentifiers: true });

    const hospWithOrgAnomaly = reportWithIdentifiers.anomalies.find(
      (a) => a.documentId === String(hospitalWithoutOrgId)
    );
    assert.ok(hospWithOrgAnomaly);
    assert.ok(hospWithOrgAnomaly.identifier);
    assert.equal(hospWithOrgAnomaly.identifier, 'TEST_HOSP_002');

    const ambMapping = reportWithIdentifiers.proposedMappings.find(
      (m) => m.sourceId === String(validAmbulanceId)
    );
    assert.ok(ambMapping);
    assert.ok(ambMapping.identifier);
    assert.equal(ambMapping.identifier, 'TEST_AMB_001');
  });
});
