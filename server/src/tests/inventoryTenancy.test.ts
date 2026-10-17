import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
  type TenancyInventoryReport,
} from '../scripts/inventoryTenancy.js';

describe('DATA-01 Multi-Tenancy Read-Only Inventory Audit', () => {
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
  let conflictingEmergencyId: Types.ObjectId;
  let validTripId: Types.ObjectId;
  let invalidTripId: Types.ObjectId;

  before(async () => {
    await connectTestDatabase();

    // Clean up test collections
    await Promise.all([
      OrganizationModel.deleteMany({ name: { $regex: /^TEST_/ } }).exec(),
      OrganizationMembershipModel.deleteMany({}).exec(),
      HospitalModel.deleteMany({ registrationNumber: { $regex: /^TEST_HOSP_/ } }).exec(),
      AmbulanceProviderModel.deleteMany({ registrationNumber: { $regex: /^TEST_PROV_/ } }).exec(),
      AmbulanceModel.deleteMany({ vehicleNumber: { $regex: /^TEST_AMB_/ } }).exec(),
      AmbulanceDriverModel.deleteMany({ licenseNumber: { $regex: /^TEST_DRV_/ } }).exec(),
      EmergencyRequestModel.deleteMany({ requestCode: { $regex: /^TEST_REQ_/ } }).exec(),
      TripModel.deleteMany({}).exec(),
      HospitalPatientModel.deleteMany({ caseId: { $regex: /^TEST_CASE_/ } }).exec(),
      UserModel.deleteMany({ email: { $regex: /^test_inventory_/ } }).exec(),
    ]);

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

    // 4. Create Memberships
    await Promise.all([
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
      // Membership with incompatible principal type (Anomaly 6)
      OrganizationMembershipModel.collection.insertOne({
        organizationId: validHospitalOrgId,
        principalType: 'UNKNOWN_TYPE',
        principalId: new Types.ObjectId(),
        role: 'ORG_MEMBER',
        status: 'ACTIVE',
        permissions: [],
        createdAt: new Date(),
        updatedAt: new Date(),
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

    // 7. Create User
    const user = await UserModel.create({
      name: 'TEST_Citizen User',
      email: 'test_inventory_citizen@example.com',
      passwordHash: 'secret_user',
      role: 'USER',
    });
    citizenUserId = user._id;

    // 8. Create Emergency Requests
    const [em1, em2] = await Promise.all([
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
    conflictingEmergencyId = em2._id;

    // 9. Create Trips
    const [tr1, tr2] = await Promise.all([
      TripModel.create({
        emergencyRequestId: validEmergencyId,
        providerId: validProviderId,
        ambulanceId: validAmbulanceId,
        driverId: validDriverId,
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
    invalidTripId = tr2._id;

    // 10. Create Hospital Patient
    await HospitalPatientModel.create({
      caseId: 'TEST_CASE_001',
      hospitalId: validHospitalId,
      emergencyId: validEmergencyId,
      ambulanceId: validAmbulanceId,
      emergencyType: 'Trauma',
    });
  });

  after(async () => {
    // Clean up
    await Promise.all([
      OrganizationModel.deleteMany({ name: { $regex: /^TEST_/ } }).exec(),
      OrganizationMembershipModel.deleteMany({}).exec(),
      HospitalModel.deleteMany({ registrationNumber: { $regex: /^TEST_HOSP_/ } }).exec(),
      AmbulanceProviderModel.deleteMany({ registrationNumber: { $regex: /^TEST_PROV_/ } }).exec(),
      AmbulanceModel.deleteMany({ vehicleNumber: { $regex: /^TEST_AMB_/ } }).exec(),
      AmbulanceDriverModel.deleteMany({ licenseNumber: { $regex: /^TEST_DRV_/ } }).exec(),
      EmergencyRequestModel.deleteMany({ requestCode: { $regex: /^TEST_REQ_/ } }).exec(),
      TripModel.deleteMany({}).exec(),
      HospitalPatientModel.deleteMany({ caseId: { $regex: /^TEST_CASE_/ } }).exec(),
      UserModel.deleteMany({ email: { $regex: /^test_inventory_/ } }).exec(),
    ]);

    await mongoose.disconnect();
  });

  it('1. inventories aggregate counts accurately for all entities and relationships', async () => {
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
    assert.ok(report.counts.trips.total >= 2);
    assert.ok(report.counts.emergencyRequests.total >= 2);
    assert.ok(report.counts.hospitalPatients.total >= 1);
  });

  it('2. detects missing organization assignments on hospitals and providers', async () => {
    const report = await runTenancyInventory();

    const hospAnomalies = report.anomalies.filter((a) => a.category === 'HOSPITALS_WITHOUT_ORGANIZATION');
    const provAnomalies = report.anomalies.filter((a) => a.category === 'PROVIDERS_WITHOUT_ORGANIZATION');

    assert.ok(hospAnomalies.some((a) => a.documentId === String(hospitalWithoutOrgId)));
    assert.ok(provAnomalies.some((a) => a.documentId === String(providerWithoutOrgId)));
  });

  it('3. detects organizations with no active memberships', async () => {
    const report = await runTenancyInventory();

    const emptyOrgAnomalies = report.anomalies.filter((a) => a.category === 'ORGANIZATIONS_WITHOUT_MEMBERSHIPS');
    assert.ok(emptyOrgAnomalies.some((a) => a.documentId === String(orphanOrgId)));
  });

  it('4. detects invalid foreign references in memberships and models', async () => {
    const report = await runTenancyInventory();

    const nonExistentOrg = report.anomalies.filter((a) => a.category === 'MEMBERSHIPS_WITH_NONEXISTENT_ORGANIZATION');
    const nonExistentPrincipal = report.anomalies.filter((a) => a.category === 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL');
    const incompatiblePrincipal = report.anomalies.filter((a) => a.category === 'MEMBERSHIPS_WITH_INCOMPATIBLE_PRINCIPAL_TYPE');

    assert.ok(nonExistentOrg.length >= 1);
    assert.ok(nonExistentPrincipal.length >= 1);
    assert.ok(incompatiblePrincipal.length >= 1);
  });

  it('5. detects entities linked to the wrong organization type', async () => {
    const report = await runTenancyInventory();

    const wrongTypeAnomalies = report.anomalies.filter((a) => a.category === 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE');
    assert.ok(wrongTypeAnomalies.some((a) => a.documentId === String(hospitalWrongOrgId)));
    assert.ok(wrongTypeAnomalies.some((a) => a.documentId === String(providerWrongOrgId)));
  });

  it('6. detects orphaned drivers, ambulances, and mismatched ambulance-driver relationships', async () => {
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

  it('7. detects trips with invalid provider or ambulance relationships', async () => {
    const report = await runTenancyInventory();

    const tripAnomalies = report.anomalies.filter((a) => a.category === 'TRIPS_WITH_INVALID_REFERENCES');
    assert.ok(tripAnomalies.some((a) => a.documentId === String(invalidTripId)));
    assert.ok(!tripAnomalies.some((a) => a.documentId === String(validTripId)));
  });

  it('8. detects emergency request assignments conflicting with authoritative relationships', async () => {
    const report = await runTenancyInventory();

    const emergencyAnomalies = report.anomalies.filter((a) => a.category === 'EMERGENCY_ASSIGNMENT_CONFLICTS');
    assert.ok(emergencyAnomalies.some((a) => a.documentId === String(conflictingEmergencyId)));
  });

  it('9. detects ambiguous or conflicting multiple memberships', async () => {
    const report = await runTenancyInventory();

    const ambigAnomalies = report.anomalies.filter((a) => a.category === 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS');
    assert.ok(ambigAnomalies.some((a) => a.documentId === String(validHospitalId)));
  });

  it('10. classifies proposed mappings into deterministic vs manual review', async () => {
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

  it('11. verifies zero database writes: collection counts unchanged and explicit statement present', async () => {
    const countBefore = await Promise.all([
      OrganizationModel.countDocuments(),
      OrganizationMembershipModel.countDocuments(),
      HospitalModel.countDocuments(),
      AmbulanceProviderModel.countDocuments(),
      AmbulanceModel.countDocuments(),
      AmbulanceDriverModel.countDocuments(),
      EmergencyRequestModel.countDocuments(),
      TripModel.countDocuments(),
      HospitalPatientModel.countDocuments(),
    ]);

    const report = await runTenancyInventory();

    const countAfter = await Promise.all([
      OrganizationModel.countDocuments(),
      OrganizationMembershipModel.countDocuments(),
      HospitalModel.countDocuments(),
      AmbulanceProviderModel.countDocuments(),
      AmbulanceModel.countDocuments(),
      AmbulanceDriverModel.countDocuments(),
      EmergencyRequestModel.countDocuments(),
      TripModel.countDocuments(),
      HospitalPatientModel.countDocuments(),
    ]);

    assert.deepEqual(countAfter, countBefore, 'Document counts must be strictly identical before and after inventory');
    assert.equal(report.zeroWritesConfirmed, true);
    assert.equal(report.verificationStatement, 'Verification confirmed: 0 database writes performed.');
  });

  it('12. produces stable, deterministic results across repeated runs on unchanged data', async () => {
    const report1 = await runTenancyInventory();
    const report2 = await runTenancyInventory();

    assert.equal(report1.anomalies.length, report2.anomalies.length);
    assert.equal(report1.proposedMappings.length, report2.proposedMappings.length);
    assert.deepEqual(report1.anomalySummary, report2.anomalySummary);
    assert.deepEqual(report1.mappingSummary, report2.mappingSummary);
  });

  it('13. exports machine-readable JSON without exposing sensitive data (PII or credentials)', async () => {
    const report = await runTenancyInventory();
    const tempReportPath = path.resolve(process.cwd(), 'reports', 'test-tenancy-inventory.report.json');

    const savedPath = saveReportToFile(report, tempReportPath);
    assert.ok(fs.existsSync(savedPath));

    const content = fs.readFileSync(savedPath, 'utf-8');
    const parsed = JSON.parse(content) as TenancyInventoryReport;

    assert.ok(parsed.counts);
    assert.ok(parsed.anomalies);
    assert.equal(parsed.zeroWritesConfirmed, true);

    // Verify sensitive data is NOT present in output
    assert.ok(!content.includes('passwordHash'));
    assert.ok(!content.includes('hashed_secret_hosp_1'));
    assert.ok(!content.includes('secret_driver_1'));
    assert.ok(!content.includes('secret_user'));
    assert.ok(!content.includes('mfaSecret'));

    // Clean up temporary test report file
    fs.unlinkSync(savedPath);
  });
});
