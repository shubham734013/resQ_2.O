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
import { UserModel } from '../models/User.js';
import {
  planOrganizationBackfill,
  savePlanToFile,
  generateDeterministicId,
  parseCliOptions,
  validateIntegerArg,
  PlannerThresholdExceededError,
  PlannerLedgerLimitExceededError,
  PlannerConfigurationError,
  type BackfillPlanReport,
} from '../scripts/planOrganizationBackfill.js';

class FixtureRegistry {
  public orgIds: Types.ObjectId[] = [];
  public membershipIds: Types.ObjectId[] = [];
  public hospitalIds: Types.ObjectId[] = [];
  public providerIds: Types.ObjectId[] = [];
  public ambulanceIds: Types.ObjectId[] = [];
  public driverIds: Types.ObjectId[] = [];
  public userIds: Types.ObjectId[] = [];
  public emergencyIds: Types.ObjectId[] = [];

  public async cleanup(): Promise<void> {
    const deletions: Promise<unknown>[] = [];

    if (this.membershipIds.length > 0) {
      deletions.push(OrganizationMembershipModel.deleteMany({ _id: { $in: this.membershipIds } }).exec());
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

describe('DATA-01C Organization Backfill Planning and Dry-Run (TASK 03 & HARDENING)', () => {
  const registry = new FixtureRegistry();

  let validHospitalOrgId: Types.ObjectId;
  let validProviderOrgId: Types.ObjectId;
  let suspendedHospitalOrgId: Types.ObjectId;
  let suspendedProviderOrgId: Types.ObjectId;

  // Hospital fixtures
  let configuredHospitalId: Types.ObjectId;
  let standaloneHospitalId: Types.ObjectId;
  let wrongTypeHospitalId: Types.ObjectId;
  let missingOrgHospitalId: Types.ObjectId;
  let conflictingHospitalId: Types.ObjectId;
  let hospSuspendedDirectId: Types.ObjectId;
  let hospMemMissingOrgId: Types.ObjectId;
  let hospMemWrongTypeId: Types.ObjectId;
  let hospMemSuspendedId: Types.ObjectId;
  let hospMemInactiveEvidenceId: Types.ObjectId;
  let hospIndexConflictId: Types.ObjectId;
  let hospMixedMembershipsId: Types.ObjectId;

  // Provider fixtures
  let configuredProviderId: Types.ObjectId;
  let standaloneProviderId: Types.ObjectId;
  let wrongTypeProviderId: Types.ObjectId;
  let provSuspendedDirectId: Types.ObjectId;
  let provMemMissingOrgId: Types.ObjectId;
  let provMemWrongTypeId: Types.ObjectId;
  let provMemSuspendedId: Types.ObjectId;
  let provMemInactiveEvidenceId: Types.ObjectId;
  let provIndexConflictId: Types.ObjectId;
  let provMixedMembershipsId: Types.ObjectId;

  // Ambulance fixtures
  let ambulanceForConfiguredProvId: Types.ObjectId;
  let ambulanceForStandaloneProvId: Types.ObjectId;
  let orphanedAmbulanceId: Types.ObjectId;

  // Driver fixtures
  let driverForConfiguredProvId: Types.ObjectId;
  let mismatchedDriverId: Types.ObjectId;
  let orphanedDriverId: Types.ObjectId;
  let multiOrgDriverId: Types.ObjectId;
  let conflictingOrgDriverId: Types.ObjectId;
  let driverIndexConflictId: Types.ObjectId;
  let driverMixedMembershipsId: Types.ObjectId;

  // User & Emergency fixtures
  let citizenUserId: Types.ObjectId;
  let citizenEmergencyId: Types.ObjectId;

  before(async () => {
    await connectTestDatabase();

    try {
      // 1. Create Organizations
      const [hospOrg, provOrg, suspHospOrg, suspProvOrg] = await Promise.all([
        OrganizationModel.create({
          name: 'TEST_Metro Hospital System',
          type: 'HOSPITAL_NETWORK',
          status: 'ACTIVE',
        }),
        OrganizationModel.create({
          name: 'TEST_City Ambulance Fleet',
          type: 'AMBULANCE_OPERATOR',
          status: 'ACTIVE',
        }),
        OrganizationModel.create({
          name: 'TEST_Suspended Hospital System',
          type: 'HOSPITAL_NETWORK',
          status: 'SUSPENDED',
        }),
        OrganizationModel.create({
          name: 'TEST_Suspended Ambulance Fleet',
          type: 'AMBULANCE_OPERATOR',
          status: 'SUSPENDED',
        }),
      ]);
      validHospitalOrgId = hospOrg._id;
      validProviderOrgId = provOrg._id;
      suspendedHospitalOrgId = suspHospOrg._id;
      suspendedProviderOrgId = suspProvOrg._id;
      registry.orgIds.push(hospOrg._id, provOrg._id, suspHospOrg._id, suspProvOrg._id);

      // 2. Create Hospitals
      const [hosp1, hosp2, hosp3, hosp4, hosp5, hosp6, hosp7, hosp8, hosp9, hosp10, hosp11, hosp12] = await Promise.all([
        HospitalModel.create({
          name: 'TEST_Configured General Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_001',
          email: 'test_plan_hosp_001@example.com',
          phone: '1112223330',
          passwordHash: 'secret_hosp_plan_1',
          hospitalType: 'General',
          organizationId: validHospitalOrgId,
        }),
        HospitalModel.create({
          name: 'TEST_Standalone Community Clinic',
          registrationNumber: 'TEST_PLAN_HOSP_002',
          email: 'test_plan_hosp_002@example.com',
          phone: '1112223331',
          passwordHash: 'secret_hosp_plan_2',
          hospitalType: 'Clinic',
        }),
        HospitalModel.create({
          name: 'TEST_Wrong Org Type Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_003',
          email: 'test_plan_hosp_003@example.com',
          phone: '1112223332',
          passwordHash: 'secret_hosp_plan_3',
          hospitalType: 'Specialty',
          organizationId: validProviderOrgId, // Wrong org type
        }),
        HospitalModel.create({
          name: 'TEST_Missing Org Ref Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_004',
          email: 'test_plan_hosp_004@example.com',
          phone: '1112223333',
          passwordHash: 'secret_hosp_plan_4',
          hospitalType: 'General',
          organizationId: new Types.ObjectId(), // Non-existent org
        }),
        HospitalModel.create({
          name: 'TEST_Conflicting Memberships Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_005',
          email: 'test_plan_hosp_005@example.com',
          phone: '1112223334',
          passwordHash: 'secret_hosp_plan_5',
          hospitalType: 'General',
          organizationId: validHospitalOrgId,
        }),
        HospitalModel.create({
          name: 'TEST_Direct Suspended Org Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_006',
          email: 'test_plan_hosp_006@example.com',
          phone: '1112223341',
          passwordHash: 'secret_hosp_plan_6',
          hospitalType: 'General',
          organizationId: suspendedHospitalOrgId, // Points to suspended org
        }),
        HospitalModel.create({
          name: 'TEST_Mem Missing Org Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_007',
          email: 'test_plan_hosp_007@example.com',
          phone: '1112223342',
          passwordHash: 'secret_hosp_plan_7',
          hospitalType: 'Clinic',
          // No direct org
        }),
        HospitalModel.create({
          name: 'TEST_Mem Wrong Type Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_008',
          email: 'test_plan_hosp_008@example.com',
          phone: '1112223343',
          passwordHash: 'secret_hosp_plan_8',
          hospitalType: 'Clinic',
          // No direct org
        }),
        HospitalModel.create({
          name: 'TEST_Mem Suspended Org Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_009',
          email: 'test_plan_hosp_009@example.com',
          phone: '1112223344',
          passwordHash: 'secret_hosp_plan_9',
          hospitalType: 'Clinic',
          // No direct org
        }),
        HospitalModel.create({
          name: 'TEST_Inactive Evidence Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_010',
          email: 'test_plan_hosp_010@example.com',
          phone: '1112223345',
          passwordHash: 'secret_hosp_plan_10',
          hospitalType: 'Clinic',
          // No direct org
        }),
        HospitalModel.create({
          name: 'TEST_Index Conflict Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_011',
          email: 'test_plan_hosp_011@example.com',
          phone: '1112223346',
          passwordHash: 'secret_hosp_plan_11',
          hospitalType: 'General',
          organizationId: validHospitalOrgId,
        }),
        HospitalModel.create({
          name: 'TEST_Mixed Memberships Hospital',
          registrationNumber: 'TEST_PLAN_HOSP_012',
          email: 'test_plan_hosp_012@example.com',
          phone: '1112223356',
          passwordHash: 'secret_hosp_plan_12',
          hospitalType: 'General',
          organizationId: validHospitalOrgId,
        }),
      ]);
      configuredHospitalId = hosp1._id;
      standaloneHospitalId = hosp2._id;
      wrongTypeHospitalId = hosp3._id;
      missingOrgHospitalId = hosp4._id;
      conflictingHospitalId = hosp5._id;
      hospSuspendedDirectId = hosp6._id;
      hospMemMissingOrgId = hosp7._id;
      hospMemWrongTypeId = hosp8._id;
      hospMemSuspendedId = hosp9._id;
      hospMemInactiveEvidenceId = hosp10._id;
      hospIndexConflictId = hosp11._id;
      hospMixedMembershipsId = hosp12._id;
      registry.hospitalIds.push(
        hosp1._id,
        hosp2._id,
        hosp3._id,
        hosp4._id,
        hosp5._id,
        hosp6._id,
        hosp7._id,
        hosp8._id,
        hosp9._id,
        hosp10._id,
        hosp11._id,
        hosp12._id
      );

      // 3. Create Providers
      const [prov1, prov2, prov3, prov4, prov5, prov6, prov7, prov8, prov9, prov10] = await Promise.all([
        AmbulanceProviderModel.create({
          name: 'TEST_Configured Ambulance Corp',
          registrationNumber: 'TEST_PLAN_PROV_001',
          email: 'test_plan_prov_001@example.com',
          phone: '1112223335',
          serviceType: 'Emergency',
          organizationId: validProviderOrgId,
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Standalone Ambulance Fleet',
          registrationNumber: 'TEST_PLAN_PROV_002',
          email: 'test_plan_prov_002@example.com',
          phone: '1112223336',
          serviceType: 'Emergency',
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Wrong Org Type Provider',
          registrationNumber: 'TEST_PLAN_PROV_003',
          email: 'test_plan_prov_003@example.com',
          phone: '1112223337',
          serviceType: 'Emergency',
          organizationId: validHospitalOrgId, // Wrong org type
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Direct Suspended Provider',
          registrationNumber: 'TEST_PLAN_PROV_004',
          email: 'test_plan_prov_004@example.com',
          phone: '1112223347',
          serviceType: 'Emergency',
          organizationId: suspendedProviderOrgId, // Suspended direct org
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Mem Missing Org Provider',
          registrationNumber: 'TEST_PLAN_PROV_005',
          email: 'test_plan_prov_005@example.com',
          phone: '1112223348',
          serviceType: 'Emergency',
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Mem Wrong Type Provider',
          registrationNumber: 'TEST_PLAN_PROV_006',
          email: 'test_plan_prov_006@example.com',
          phone: '1112223349',
          serviceType: 'Emergency',
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Mem Suspended Org Provider',
          registrationNumber: 'TEST_PLAN_PROV_007',
          email: 'test_plan_prov_007@example.com',
          phone: '1112223350',
          serviceType: 'Emergency',
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Inactive Evidence Provider',
          registrationNumber: 'TEST_PLAN_PROV_008',
          email: 'test_plan_prov_008@example.com',
          phone: '1112223351',
          serviceType: 'Emergency',
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Index Conflict Provider',
          registrationNumber: 'TEST_PLAN_PROV_009',
          email: 'test_plan_prov_009@example.com',
          phone: '1112223352',
          serviceType: 'Emergency',
          organizationId: validProviderOrgId,
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Mixed Memberships Provider',
          registrationNumber: 'TEST_PLAN_PROV_010',
          email: 'test_plan_prov_010@example.com',
          phone: '1112223357',
          serviceType: 'Emergency',
          organizationId: validProviderOrgId,
        }),
      ]);
      configuredProviderId = prov1._id;
      standaloneProviderId = prov2._id;
      wrongTypeProviderId = prov3._id;
      provSuspendedDirectId = prov4._id;
      provMemMissingOrgId = prov5._id;
      provMemWrongTypeId = prov6._id;
      provMemSuspendedId = prov7._id;
      provMemInactiveEvidenceId = prov8._id;
      provIndexConflictId = prov9._id;
      provMixedMembershipsId = prov10._id;
      registry.providerIds.push(
        prov1._id,
        prov2._id,
        prov3._id,
        prov4._id,
        prov5._id,
        prov6._id,
        prov7._id,
        prov8._id,
        prov9._id,
        prov10._id
      );

      // 4. Create Memberships
      const createdMemberships = await Promise.all([
        // Configured hospital membership
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: configuredHospitalId,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
        }),
        // Configured provider membership
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: configuredProviderId,
          role: 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        }),
        // Conflicting membership for conflictingHospitalId
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'HOSPITAL',
          principalId: conflictingHospitalId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // hospMemMissingOrgId -> active membership to nonexistent org
        OrganizationMembershipModel.create({
          organizationId: new Types.ObjectId(),
          principalType: 'HOSPITAL',
          principalId: hospMemMissingOrgId,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
        }),
        // hospMemWrongTypeId -> active membership to wrong org type (AMBULANCE_OPERATOR)
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'HOSPITAL',
          principalId: hospMemWrongTypeId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // hospMemSuspendedId -> active membership to suspended org
        OrganizationMembershipModel.create({
          organizationId: suspendedHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: hospMemSuspendedId,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
        }),
        // hospMemInactiveEvidenceId -> suspended membership in valid org
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: hospMemInactiveEvidenceId,
          role: 'HOSPITAL_ADMIN',
          status: 'SUSPENDED',
        }),
        // hospIndexConflictId -> existing ORG_MEMBER membership in target org (prevents duplicate CREATE_MEMBERSHIP)
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: hospIndexConflictId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // hospMixedMembershipsId -> 1 active membership in validHospitalOrgId, 1 suspended in suspendedHospitalOrgId
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: hospMixedMembershipsId,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
        }),
        OrganizationMembershipModel.create({
          organizationId: suspendedHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: hospMixedMembershipsId,
          role: 'HOSPITAL_ADMIN',
          status: 'SUSPENDED',
        }),
        // provMemMissingOrgId -> active membership to nonexistent org
        OrganizationMembershipModel.create({
          organizationId: new Types.ObjectId(),
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provMemMissingOrgId,
          role: 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        }),
        // provMemWrongTypeId -> active membership to wrong org type (HOSPITAL_NETWORK)
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provMemWrongTypeId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // provMemSuspendedId -> active membership to suspended org
        OrganizationMembershipModel.create({
          organizationId: suspendedProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provMemSuspendedId,
          role: 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        }),
        // provMemInactiveEvidenceId -> suspended membership
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provMemInactiveEvidenceId,
          role: 'PROVIDER_ADMIN',
          status: 'SUSPENDED',
        }),
        // provIndexConflictId -> existing ORG_MEMBER membership in target org
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provIndexConflictId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // provMixedMembershipsId -> 1 active in validProviderOrgId, 1 suspended in suspendedProviderOrgId
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provMixedMembershipsId,
          role: 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        }),
        OrganizationMembershipModel.create({
          organizationId: suspendedProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: provMixedMembershipsId,
          role: 'PROVIDER_ADMIN',
          status: 'SUSPENDED',
        }),
      ]);
      for (const m of createdMemberships) {
        registry.membershipIds.push(m._id);
      }

      // 5. Create Ambulances
      const [amb1, amb2, amb3] = await Promise.all([
        AmbulanceModel.create({
          registrationNumber: 'TEST_PLAN_AMB_001',
          vehicleNumber: 'PLAN_AMB_001',
          providerId: configuredProviderId,
          ambulanceType: 'ALS',
          currentStatus: 'AVAILABLE',
        }),
        AmbulanceModel.create({
          registrationNumber: 'TEST_PLAN_AMB_002',
          vehicleNumber: 'PLAN_AMB_002',
          providerId: standaloneProviderId,
          ambulanceType: 'BLS',
          currentStatus: 'AVAILABLE',
        }),
        AmbulanceModel.create({
          registrationNumber: 'TEST_PLAN_AMB_003',
          vehicleNumber: 'PLAN_AMB_003',
          providerId: new Types.ObjectId(), // Non-existent provider
          ambulanceType: 'ALS',
          currentStatus: 'OFFLINE',
        }),
      ]);
      ambulanceForConfiguredProvId = amb1._id;
      ambulanceForStandaloneProvId = amb2._id;
      orphanedAmbulanceId = amb3._id;
      registry.ambulanceIds.push(amb1._id, amb2._id, amb3._id);

      // 6. Create Drivers
      const [drv1, drv2, drv3, drv4, drv5, drv6, drv7] = await Promise.all([
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Alpha',
          email: 'test_plan_drv1@example.com',
          phone: '1112223338',
          passwordHash: 'secret_drv_plan_1',
          licenseNumber: 'TEST_PLAN_DRV_001',
          providerId: configuredProviderId,
          assignedAmbulanceId: ambulanceForConfiguredProvId,
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Mismatched',
          email: 'test_plan_drv2@example.com',
          phone: '1112223339',
          passwordHash: 'secret_drv_plan_2',
          licenseNumber: 'TEST_PLAN_DRV_002',
          providerId: configuredProviderId,
          assignedAmbulanceId: ambulanceForStandaloneProvId, // BELONGS TO DIFFERENT PROVIDER (RULE 5)
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Orphan',
          email: 'test_plan_drv3@example.com',
          phone: '1112223340',
          passwordHash: 'secret_drv_plan_3',
          licenseNumber: 'TEST_PLAN_DRV_003',
          providerId: new Types.ObjectId(), // Non-existent provider
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Multi Org',
          email: 'test_plan_drv4@example.com',
          phone: '1112223353',
          passwordHash: 'secret_drv_plan_4',
          licenseNumber: 'TEST_PLAN_DRV_004',
          providerId: configuredProviderId,
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Conflicting Org',
          email: 'test_plan_drv5@example.com',
          phone: '1112223354',
          passwordHash: 'secret_drv_plan_5',
          licenseNumber: 'TEST_PLAN_DRV_005',
          providerId: configuredProviderId,
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Index Conflict',
          email: 'test_plan_drv6@example.com',
          phone: '1112223355',
          passwordHash: 'secret_drv_plan_6',
          licenseNumber: 'TEST_PLAN_DRV_006',
          providerId: configuredProviderId,
        }),
        AmbulanceDriverModel.create({
          fullName: 'TEST_Driver Mixed Memberships',
          email: 'test_plan_drv7@example.com',
          phone: '1112223358',
          passwordHash: 'secret_drv_plan_7',
          licenseNumber: 'TEST_PLAN_DRV_007',
          providerId: configuredProviderId,
        }),
      ]);
      driverForConfiguredProvId = drv1._id;
      mismatchedDriverId = drv2._id;
      orphanedDriverId = drv3._id;
      multiOrgDriverId = drv4._id;
      conflictingOrgDriverId = drv5._id;
      driverIndexConflictId = drv6._id;
      driverMixedMembershipsId = drv7._id;
      registry.driverIds.push(drv1._id, drv2._id, drv3._id, drv4._id, drv5._id, drv6._id, drv7._id);

      // Create Driver memberships
      const driverMemberships = await Promise.all([
        // Multi-org driver: membership in validProviderOrgId AND validHospitalOrgId
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_DRIVER',
          principalId: multiOrgDriverId,
          role: 'DRIVER',
          status: 'ACTIVE',
        }),
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'AMBULANCE_DRIVER',
          principalId: multiOrgDriverId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
        // Conflicting org driver: membership ONLY in validHospitalOrgId (different from parent provider)
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'AMBULANCE_DRIVER',
          principalId: conflictingOrgDriverId,
          role: 'DRIVER',
          status: 'ACTIVE',
        }),
        // Driver index conflict: already has DISPATCHER membership in validProviderOrgId
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_DRIVER',
          principalId: driverIndexConflictId,
          role: 'DISPATCHER',
          status: 'ACTIVE',
        }),
        // Driver mixed memberships: 1 active in validProviderOrgId, 1 suspended in suspendedProviderOrgId
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_DRIVER',
          principalId: driverMixedMembershipsId,
          role: 'DRIVER',
          status: 'ACTIVE',
        }),
        OrganizationMembershipModel.create({
          organizationId: suspendedProviderOrgId,
          principalType: 'AMBULANCE_DRIVER',
          principalId: driverMixedMembershipsId,
          role: 'DRIVER',
          status: 'SUSPENDED',
        }),
      ]);
      for (const dm of driverMemberships) {
        registry.membershipIds.push(dm._id);
      }

      // 7. Create Citizen User and Emergency Request
      const user = await UserModel.create({
        name: 'TEST_Citizen Caller',
        email: 'test_plan_citizen@example.com',
        passwordHash: 'secret_user_plan',
        role: 'USER',
      });
      citizenUserId = user._id;
      registry.userIds.push(user._id);

      const emergency = await EmergencyRequestModel.create({
        requestCode: 'TEST_PLAN_EMERGENCY_001',
        userId: citizenUserId,
        hospitalId: configuredHospitalId,
        situationType: 'Emergency SOS',
        reportedAt: new Date(),
      });
      citizenEmergencyId = emergency._id;
      registry.emergencyIds.push(emergency._id);
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

  it('2. determinism: repeated dry runs produce identical plans and deterministic ObjectIds', async () => {
    const plan1 = await planOrganizationBackfill();
    const plan2 = await planOrganizationBackfill();

    assert.equal(plan1.dryRun, true);
    assert.equal(plan2.dryRun, true);
    assert.deepEqual(plan1.summary, plan2.summary);
    assert.equal(plan1.ledger.length, plan2.ledger.length);

    // Verify every single ledger entry matches exactly across repeated executions
    for (let i = 0; i < plan1.ledger.length; i++) {
      const e1 = plan1.ledger[i];
      const e2 = plan2.ledger[i];
      assert.deepEqual(e1, e2, `Ledger entry ${i} must be strictly identical across dry runs`);
    }

    // Verify deterministic ObjectIds are valid 24-character hex strings
    const deterministicId = generateDeterministicId('test:seed:123');
    assert.equal(deterministicId.length, 24);
    assert.ok(Types.ObjectId.isValid(deterministicId));
  });

  it('3. preservation: existing valid organization assignments are preserved without mutation', async () => {
    const plan = await planOrganizationBackfill();

    const hospSkip = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(configuredHospitalId)
    );
    assert.ok(hospSkip);
    assert.equal(hospSkip.action, 'SKIP_ALREADY_CONFIGURED');
    assert.equal(hospSkip.status, 'SKIPPED');
    assert.equal(hospSkip.proposedOrganizationId, String(validHospitalOrgId));
    assert.equal(hospSkip.mappingRule, 'RULE_6_PRESERVE_VALID_ASSIGNMENTS');

    const provSkip = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(configuredProviderId)
    );
    assert.ok(provSkip);
    assert.equal(provSkip.action, 'SKIP_ALREADY_CONFIGURED');
    assert.equal(provSkip.status, 'SKIPPED');
    assert.equal(provSkip.proposedOrganizationId, String(validProviderOrgId));
  });

  it('4. deterministic parent-child mappings: standalone hospitals and providers plan creates; ambulances inherit', async () => {
    const plan = await planOrganizationBackfill();

    // Standalone hospital: plans CREATE_ORGANIZATION, CREATE_MEMBERSHIP, UPDATE_ENTITY_ORGANIZATION
    const hospEntries = plan.ledger.filter(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(standaloneHospitalId)
    );
    assert.equal(hospEntries.length, 3);
    const createOrgEntry = hospEntries.find((e) => e.action === 'CREATE_ORGANIZATION');
    assert.ok(createOrgEntry);
    assert.equal(createOrgEntry.proposedOrganizationType, 'HOSPITAL_NETWORK');
    assert.ok(Types.ObjectId.isValid(createOrgEntry.proposedOrganizationId!));

    const createMemEntry = hospEntries.find((e) => e.action === 'CREATE_MEMBERSHIP');
    assert.ok(createMemEntry);
    assert.equal(createMemEntry.proposedMembershipRole, 'HOSPITAL_ADMIN');

    const updateOrgEntry = hospEntries.find((e) => e.action === 'UPDATE_ENTITY_ORGANIZATION');
    assert.ok(updateOrgEntry);
    assert.equal(updateOrgEntry.proposedOrganizationId, createOrgEntry.proposedOrganizationId);

    // Ambulance belonging to configured provider inherits provider's org
    const amb1Inherit = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE' && e.sourceId === String(ambulanceForConfiguredProvId)
    );
    assert.ok(amb1Inherit);
    assert.equal(amb1Inherit.action, 'INHERIT_PROVIDER_ORGANIZATION');
    assert.equal(amb1Inherit.proposedOrganizationId, String(validProviderOrgId));
    assert.equal(amb1Inherit.confidence, 'DETERMINISTIC');

    // Ambulance belonging to standalone provider inherits planned provider's org
    const amb2Inherit = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE' && e.sourceId === String(ambulanceForStandaloneProvId)
    );
    assert.ok(amb2Inherit);
    assert.equal(amb2Inherit.action, 'INHERIT_PROVIDER_ORGANIZATION');
    assert.equal(amb2Inherit.proposedOrganizationId, generateDeterministicId(`org:provider:${standaloneProviderId}`));

    // Driver belonging to configured provider inherits provider's org and plans DRIVER membership
    const drv1Plan = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(driverForConfiguredProvId)
    );
    assert.ok(drv1Plan);
    assert.equal(drv1Plan.action, 'CREATE_MEMBERSHIP');
    assert.equal(drv1Plan.proposedMembershipRole, 'DRIVER');
    assert.equal(drv1Plan.proposedOrganizationId, String(validProviderOrgId));
  });

  it('5. conflict detection (Rule 5): driver assigned to ambulance of different provider requires manual review', async () => {
    const plan = await planOrganizationBackfill();

    const mismatchEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(mismatchedDriverId)
    );
    assert.ok(mismatchEntry, 'Mismatched driver must be recorded in ledger');
    assert.equal(mismatchEntry.action, 'MANUAL_REVIEW');
    assert.equal(mismatchEntry.status, 'MANUAL_REVIEW');
    assert.equal(mismatchEntry.confidence, 'AMBIGUOUS');
    assert.equal(mismatchEntry.requiresManualReview, true);
    assert.equal(mismatchEntry.mappingRule, 'RULE_5_DRIVER_AMBULANCE_PROVIDER_MISMATCH');
    assert.ok(mismatchEntry.reason.includes('Conflict: Driver belongs to provider'));
  });

  it('6. invalid references: missing or wrong-type references require manual review and halt backfill', async () => {
    const plan = await planOrganizationBackfill();

    // Hospital with wrong org type
    const wrongTypeHosp = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(wrongTypeHospitalId)
    );
    assert.ok(wrongTypeHosp);
    assert.equal(wrongTypeHosp.action, 'MANUAL_REVIEW');
    assert.equal(wrongTypeHosp.confidence, 'INVALID');

    // Hospital with non-existent org
    const missingOrgHosp = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(missingOrgHospitalId)
    );
    assert.ok(missingOrgHosp);
    assert.equal(missingOrgHosp.action, 'MANUAL_REVIEW');
    assert.equal(missingOrgHosp.confidence, 'INVALID');

    // Hospital with conflicting memberships
    const conflictHosp = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(conflictingHospitalId)
    );
    assert.ok(conflictHosp);
    assert.equal(conflictHosp.action, 'MANUAL_REVIEW');
    assert.equal(conflictHosp.confidence, 'AMBIGUOUS');

    // Orphaned ambulance
    const orphanedAmb = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE' && e.sourceId === String(orphanedAmbulanceId)
    );
    assert.ok(orphanedAmb);
    assert.equal(orphanedAmb.action, 'MANUAL_REVIEW');
    assert.equal(orphanedAmb.confidence, 'INVALID');

    // Orphaned driver
    const orphanedDrv = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(orphanedDriverId)
    );
    assert.ok(orphanedDrv);
    assert.equal(orphanedDrv.action, 'MANUAL_REVIEW');
    assert.equal(orphanedDrv.confidence, 'INVALID');

    // Provider with wrong org type
    const wrongTypeProv = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(wrongTypeProviderId)
    );
    assert.ok(wrongTypeProv);
    assert.equal(wrongTypeProv.action, 'MANUAL_REVIEW');
    assert.equal(wrongTypeProv.confidence, 'INVALID');
  });

  it('7. citizen tenancy preservation (Rule 8 & 9): citizen emergency requests are never assigned an organization', async () => {
    const plan = await planOrganizationBackfill();

    assert.ok(plan.countsByEntity.citizenEmergenciesPreserved >= 1);

    // Verify no emergency request document is targeted for organization assignment in the ledger
    const emergencyUpdateEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'EMERGENCY_REQUEST'
    );
    assert.equal(emergencyUpdateEntry, undefined, 'Emergency requests must never be assigned an organization');

    // Verify existing emergency record in database still has only userId and hospitalId, untouched
    const freshEmergency = await EmergencyRequestModel.findById(citizenEmergencyId).lean().exec();
    assert.ok(freshEmergency);
    assert.equal(String(freshEmergency.userId), String(citizenUserId));
  });

  it('8. idempotency key uniqueness: all ledger idempotency keys are strictly unique', async () => {
    const plan = await planOrganizationBackfill();

    const keys = plan.ledger.map((e) => e.idempotencyKey);
    const uniqueKeys = new Set(keys);
    assert.equal(keys.length, uniqueKeys.size, 'All migration ledger idempotency keys must be unique');
  });

  it('9. threshold enforcement: setting maxEntities limits explicitly throws PlannerThresholdExceededError', async () => {
    await assert.rejects(
      async () => {
        await planOrganizationBackfill({ maxEntities: 1 });
      },
      (err: unknown) => {
        assert.ok(err instanceof PlannerThresholdExceededError);
        assert.equal(err.limit, 1);
        return true;
      }
    );
  });

  it('10. read-only guarantee: zero write operations invoked on models during planner execution', async () => {
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

    let plan: BackfillPlanReport;
    try {
      plan = await planOrganizationBackfill();
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

    assert.equal(writeCalls, 0, 'Zero write methods must be called on models during planner execution');
    assert.equal(plan.dryRun, true);
    assert.equal(plan.readOnlyAudit.executionPathAudited, true);
    assert.equal(plan.readOnlyAudit.writeOperationsCalled, 0);
  });

  it('11. data confidentiality: default plan output contains no PII, credentials, or telephone numbers', async () => {
    const plan = await planOrganizationBackfill();
    const tempPlanPath = path.resolve(process.cwd(), 'reports', 'test-backfill-plan.report.json');

    try {
      const savedPath = savePlanToFile(plan, tempPlanPath);
      assert.ok(fs.existsSync(savedPath));

      const content = fs.readFileSync(savedPath, 'utf-8');

      // Assert personal data and secret patterns are ABSENT from default output
      const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      assert.ok(!emailPattern.test(content), 'Plan must not contain email addresses');

      const phonePattern = /\b11122233\d{2}\b/;
      assert.ok(!phonePattern.test(content), 'Plan must not contain telephone numbers');

      assert.ok(!content.includes('TEST_Driver Alpha'), 'Plan must not contain personal names');
      assert.ok(!content.includes('TEST_Citizen Caller'), 'Plan must not contain citizen caller names');
      assert.ok(!content.includes('secret_hosp_plan_1'), 'Plan must not contain password hashes');
      assert.ok(!content.includes('passwordHash'), 'Plan must not contain passwordHash fields');

      // Verify restrictive file permissions (0o600: read/write by owner only) on POSIX
      const stat = fs.statSync(savedPath);
      const fileMode = stat.mode & 0o777;
      assert.equal(fileMode, 0o600, 'Plan file must be created with restrictive 0o600 permissions');
    } finally {
      if (fs.existsSync(tempPlanPath)) {
        fs.unlinkSync(tempPlanPath);
      }
    }
  });

  it('12. rollback specification: defines idempotent ledger reversal strategy and database requirements', async () => {
    const plan = await planOrganizationBackfill();

    assert.equal(plan.rollbackSpecification.strategy, 'IDEMPOTENT_LEDGER_REVERSAL');
    assert.ok(plan.rollbackSpecification.reversalInstructions.length >= 4);
    assert.ok(plan.rollbackSpecification.databaseRequirements.includes('replica set'));
    assert.ok(plan.rollbackSpecification.safetyRules.length >= 3);
  });

  it('13. membership conflict & inactive status handling for hospitals: halts for manual review', async () => {
    const plan = await planOrganizationBackfill();

    // 1. Hospital with direct org pointing to suspended org -> MANUAL_REVIEW
    const suspDirectEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospSuspendedDirectId)
    );
    assert.ok(suspDirectEntry, 'Hospital pointing to suspended org must be recorded');
    assert.equal(suspDirectEntry.action, 'MANUAL_REVIEW');
    assert.equal(suspDirectEntry.confidence, 'INVALID');
    assert.ok(suspDirectEntry.reason.includes('has status \'SUSPENDED\''));

    // 2. Hospital without direct org, but active membership in missing org -> MANUAL_REVIEW (never standalone create!)
    const memMissingEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospMemMissingOrgId)
    );
    assert.ok(memMissingEntry);
    assert.equal(memMissingEntry.action, 'MANUAL_REVIEW');
    assert.equal(memMissingEntry.confidence, 'INVALID');
    assert.ok(memMissingEntry.reason.includes('does not exist in Organizations collection'));

    // 3. Hospital without direct org, but active membership in wrong org type -> MANUAL_REVIEW
    const memWrongTypeEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospMemWrongTypeId)
    );
    assert.ok(memWrongTypeEntry);
    assert.equal(memWrongTypeEntry.action, 'MANUAL_REVIEW');
    assert.equal(memWrongTypeEntry.confidence, 'INVALID');
    assert.ok(memWrongTypeEntry.reason.includes('expected HOSPITAL_NETWORK'));

    // 4. Hospital without direct org, but active membership in suspended org -> MANUAL_REVIEW
    const memSuspEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospMemSuspendedId)
    );
    assert.ok(memSuspEntry);
    assert.equal(memSuspEntry.action, 'MANUAL_REVIEW');
    assert.equal(memSuspEntry.confidence, 'INVALID');
    assert.ok(memSuspEntry.reason.includes('has status \'SUSPENDED\''));

    // 5. Hospital without direct org, but inactive/suspended membership evidence -> MANUAL_REVIEW
    const inactiveEvidenceEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospMemInactiveEvidenceId)
    );
    assert.ok(inactiveEvidenceEntry);
    assert.equal(inactiveEvidenceEntry.action, 'MANUAL_REVIEW');
    assert.equal(inactiveEvidenceEntry.confidence, 'AMBIGUOUS');
    assert.ok(inactiveEvidenceEntry.reason.includes('non-active membership evidence'));
  });

  it('14. membership conflict & inactive status handling for providers: halts for manual review', async () => {
    const plan = await planOrganizationBackfill();

    // 1. Provider with direct org pointing to suspended org -> MANUAL_REVIEW
    const suspDirectEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provSuspendedDirectId)
    );
    assert.ok(suspDirectEntry, 'Provider pointing to suspended org must be recorded');
    assert.equal(suspDirectEntry.action, 'MANUAL_REVIEW');
    assert.equal(suspDirectEntry.confidence, 'INVALID');
    assert.ok(suspDirectEntry.reason.includes('has status \'SUSPENDED\''));

    // 2. Provider without direct org, but active membership in missing org -> MANUAL_REVIEW
    const memMissingEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provMemMissingOrgId)
    );
    assert.ok(memMissingEntry);
    assert.equal(memMissingEntry.action, 'MANUAL_REVIEW');
    assert.equal(memMissingEntry.confidence, 'INVALID');
    assert.ok(memMissingEntry.reason.includes('does not exist in Organizations collection'));

    // 3. Provider without direct org, but active membership in wrong org type -> MANUAL_REVIEW
    const memWrongTypeEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provMemWrongTypeId)
    );
    assert.ok(memWrongTypeEntry);
    assert.equal(memWrongTypeEntry.action, 'MANUAL_REVIEW');
    assert.equal(memWrongTypeEntry.confidence, 'INVALID');
    assert.ok(memWrongTypeEntry.reason.includes('expected AMBULANCE_OPERATOR'));

    // 4. Provider without direct org, but active membership in suspended org -> MANUAL_REVIEW
    const memSuspEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provMemSuspendedId)
    );
    assert.ok(memSuspEntry);
    assert.equal(memSuspEntry.action, 'MANUAL_REVIEW');
    assert.equal(memSuspEntry.confidence, 'INVALID');
    assert.ok(memSuspEntry.reason.includes('has status \'SUSPENDED\''));

    // 5. Provider without direct org, but inactive/suspended membership evidence -> MANUAL_REVIEW
    const inactiveEvidenceEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provMemInactiveEvidenceId)
    );
    assert.ok(inactiveEvidenceEntry);
    assert.equal(inactiveEvidenceEntry.action, 'MANUAL_REVIEW');
    assert.equal(inactiveEvidenceEntry.confidence, 'AMBIGUOUS');
    assert.ok(inactiveEvidenceEntry.reason.includes('non-active membership evidence'));
  });

  it('15. compound unique index protection: prevents proposing duplicate membership when record exists', async () => {
    const plan = await planOrganizationBackfill();

    // Hospital that has organizationId set, but already has ORG_MEMBER membership in that org
    const hospIndexConflict = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospIndexConflictId)
    );
    assert.ok(hospIndexConflict);
    assert.equal(hospIndexConflict.action, 'MANUAL_REVIEW');
    assert.equal(hospIndexConflict.confidence, 'AMBIGUOUS');
    assert.ok(hospIndexConflict.reason.includes('violating unique compound index') || hospIndexConflict.reason.includes('violate unique compound index'));

    // Provider that has organizationId set, but already has ORG_MEMBER membership in that org
    const provIndexConflict = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provIndexConflictId)
    );
    assert.ok(provIndexConflict);
    assert.equal(provIndexConflict.action, 'MANUAL_REVIEW');
    assert.equal(provIndexConflict.confidence, 'AMBIGUOUS');
    assert.ok(provIndexConflict.reason.includes('violating unique compound index') || provIndexConflict.reason.includes('violate unique compound index'));

    // Driver that belongs to configured provider, but already has DISPATCHER membership in that provider org
    const driverIndexConflict = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(driverIndexConflictId)
    );
    assert.ok(driverIndexConflict);
    assert.equal(driverIndexConflict.action, 'MANUAL_REVIEW');
    assert.equal(driverIndexConflict.confidence, 'AMBIGUOUS');
    assert.ok(driverIndexConflict.reason.includes('violating unique compound index') || driverIndexConflict.reason.includes('violate unique compound index'));
  });

  it('16. driver membership conflict handling: detects multi-org memberships and org mismatches', async () => {
    const plan = await planOrganizationBackfill();

    // Driver with memberships across multiple orgs -> MANUAL_REVIEW
    const multiOrgEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(multiOrgDriverId)
    );
    assert.ok(multiOrgEntry);
    assert.equal(multiOrgEntry.action, 'MANUAL_REVIEW');
    assert.equal(multiOrgEntry.confidence, 'AMBIGUOUS');
    assert.ok(multiOrgEntry.reason.includes('across multiple organizations'));

    // Driver with membership in org different from parent provider -> MANUAL_REVIEW
    const conflictingOrgEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(conflictingOrgDriverId)
    );
    assert.ok(conflictingOrgEntry);
    assert.equal(conflictingOrgEntry.action, 'MANUAL_REVIEW');
    assert.equal(conflictingOrgEntry.confidence, 'AMBIGUOUS');
    assert.ok(conflictingOrgEntry.reason.includes('conflicting organization'));
  });

  it('17. report file permission hardening: chmodSync restricts pre-existing 0o644 files to 0o600 upon overwrite', async () => {
    const plan = await planOrganizationBackfill();
    const tempPlanPath = path.resolve(process.cwd(), 'reports', 'test-backfill-plan-overwrite.json');

    try {
      // Step 1: Pre-create file with permissive 0o644 permissions
      fs.writeFileSync(tempPlanPath, '{"initial": true}', { encoding: 'utf-8', mode: 0o644 });
      fs.chmodSync(tempPlanPath, 0o644);
      const initialMode = fs.statSync(tempPlanPath).mode & 0o777;
      assert.equal(initialMode, 0o644, 'Initial file must have 0o644 mode for the test');

      // Step 2: Overwrite using savePlanToFile
      savePlanToFile(plan, tempPlanPath);

      // Step 3: Verify chmodSync strictly restricted permissions to 0o600
      const finalMode = fs.statSync(tempPlanPath).mode & 0o777;
      assert.equal(finalMode, 0o600, 'savePlanToFile must restrict pre-existing files to 0o600');
    } finally {
      if (fs.existsSync(tempPlanPath)) {
        fs.unlinkSync(tempPlanPath);
      }
    }
  });

  it('18. keyset pagination equivalence: batchSize=1 produces identical deterministic ledger as default batchSize', async () => {
    const defaultBatchPlan = await planOrganizationBackfill();
    const smallBatchPlan = await planOrganizationBackfill({ batchSize: 1 });

    assert.equal(smallBatchPlan.summary.totalEntitiesScanned, defaultBatchPlan.summary.totalEntitiesScanned);
    assert.equal(smallBatchPlan.ledger.length, defaultBatchPlan.ledger.length);
    assert.deepEqual(smallBatchPlan.summary, defaultBatchPlan.summary);

    for (let i = 0; i < defaultBatchPlan.ledger.length; i++) {
      assert.deepEqual(
        smallBatchPlan.ledger[i],
        defaultBatchPlan.ledger[i],
        `Ledger entry ${i} must be identical between batchSize=1 and default batchSize`
      );
    }
  });

  it('19. mixed active and inactive membership states: halts for manual review', async () => {
    const plan = await planOrganizationBackfill();

    // 1. Hospital with 1 active and 1 suspended membership
    const mixedHospEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'HOSPITAL' && e.sourceId === String(hospMixedMembershipsId)
    );
    assert.ok(mixedHospEntry, 'Mixed-membership hospital must be recorded');
    assert.equal(mixedHospEntry.action, 'MANUAL_REVIEW');
    assert.equal(mixedHospEntry.confidence, 'AMBIGUOUS');
    assert.ok(mixedHospEntry.reason.includes('mixed membership states'));

    // 2. Provider with 1 active and 1 suspended membership
    const mixedProvEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_PROVIDER' && e.sourceId === String(provMixedMembershipsId)
    );
    assert.ok(mixedProvEntry, 'Mixed-membership provider must be recorded');
    assert.equal(mixedProvEntry.action, 'MANUAL_REVIEW');
    assert.equal(mixedProvEntry.confidence, 'AMBIGUOUS');
    assert.ok(mixedProvEntry.reason.includes('mixed membership states'));

    // 3. Driver with 1 active and 1 suspended membership
    const mixedDriverEntry = plan.ledger.find(
      (e) => e.sourceEntity === 'AMBULANCE_DRIVER' && e.sourceId === String(driverMixedMembershipsId)
    );
    assert.ok(mixedDriverEntry, 'Mixed-membership driver must be recorded');
    assert.equal(mixedDriverEntry.action, 'MANUAL_REVIEW');
    assert.equal(mixedDriverEntry.confidence, 'AMBIGUOUS');
    assert.ok(mixedDriverEntry.reason.includes('mixed membership states'));
  });

  it('20. CLI configuration validation: strictly rejects non-integer, negative, zero, and out-of-range parameters', () => {
    // Direct validator assertions
    assert.equal(validateIntegerArg('--batch-size', '50', 1, 100), 50);

    // Valid options parsing
    const valid = parseCliOptions([
      '--batch-size=250',
      '--max-entities=5000',
      '--max-ledger-entries=8000',
      '--output=/tmp/valid-plan.json',
      '--json',
      '--include-identifiers',
    ]);
    assert.equal(valid.batchSize, 250);
    assert.equal(valid.maxEntities, 5000);
    assert.equal(valid.maxLedgerEntries, 8000);
    assert.equal(valid.outputPath, '/tmp/valid-plan.json');
    assert.equal(valid.isJson, true);
    assert.equal(valid.includeDetailedIdentifiers, true);

    // Reject non-integer batch size
    assert.throws(
      () => parseCliOptions(['--batch-size=abc']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --batch-size'));
        return true;
      }
    );

    // Reject zero batch size
    assert.throws(
      () => parseCliOptions(['--batch-size=0']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --batch-size'));
        return true;
      }
    );

    // Reject negative batch size
    assert.throws(
      () => parseCliOptions(['--batch-size=-100']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --batch-size'));
        return true;
      }
    );

    // Reject batch size exceeding max limit (10000)
    assert.throws(
      () => parseCliOptions(['--batch-size=50000']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --batch-size'));
        return true;
      }
    );

    // Reject invalid max-entities
    assert.throws(
      () => parseCliOptions(['--max-entities=invalid']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --max-entities'));
        return true;
      }
    );

    // Reject invalid max-ledger-entries
    assert.throws(
      () => parseCliOptions(['--max-ledger-entries=0']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --max-ledger-entries'));
        return true;
      }
    );

    // Reject empty output path
    assert.throws(
      () => parseCliOptions(['--output=']),
      (err: unknown) => {
        assert.ok(err instanceof PlannerConfigurationError);
        assert.ok(err.message.includes('Invalid --output'));
        return true;
      }
    );
  });

  it('21. ledger limit enforcement: maxLedgerEntries limit throws PlannerLedgerLimitExceededError', async () => {
    await assert.rejects(
      async () => {
        await planOrganizationBackfill({ maxLedgerEntries: 1 });
      },
      (err: unknown) => {
        assert.ok(err instanceof PlannerLedgerLimitExceededError);
        assert.equal(err.limit, 1);
        return true;
      }
    );
  });

  it('22. fail-closed file security: rejects symlink targets and invalid paths, cleans up temporary files', async () => {
    const plan = await planOrganizationBackfill();

    // 1. Rejects path containing null byte
    assert.throws(
      () => savePlanToFile(plan, '/tmp/test\0plan.json'),
      /contains null byte/
    );

    // 2. Rejects writing to an existing symlink
    const tempDir = path.resolve(process.cwd(), 'reports', 'test-symlink-dir');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
    }

    const realTarget = path.join(tempDir, 'real-target.json');
    const symlinkTarget = path.join(tempDir, 'symlink-target.json');

    try {
      fs.writeFileSync(realTarget, '{}', { mode: 0o600 });
      if (fs.existsSync(symlinkTarget)) fs.unlinkSync(symlinkTarget);
      fs.symlinkSync(realTarget, symlinkTarget);

      assert.throws(
        () => savePlanToFile(plan, symlinkTarget),
        /Refusing to write to symlink target/
      );
    } finally {
      if (fs.existsSync(symlinkTarget)) fs.unlinkSync(symlinkTarget);
      if (fs.existsSync(realTarget)) fs.unlinkSync(realTarget);
      if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
    }
  });
});
