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
  PlannerThresholdExceededError,
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

describe('DATA-01C Organization Backfill Planning and Dry-Run (TASK 03)', () => {
  const registry = new FixtureRegistry();

  let validHospitalOrgId: Types.ObjectId;
  let validProviderOrgId: Types.ObjectId;

  let configuredHospitalId: Types.ObjectId;
  let standaloneHospitalId: Types.ObjectId;
  let wrongTypeHospitalId: Types.ObjectId;
  let missingOrgHospitalId: Types.ObjectId;
  let conflictingHospitalId: Types.ObjectId;

  let configuredProviderId: Types.ObjectId;
  let standaloneProviderId: Types.ObjectId;
  let wrongTypeProviderId: Types.ObjectId;

  let ambulanceForConfiguredProvId: Types.ObjectId;
  let ambulanceForStandaloneProvId: Types.ObjectId;
  let orphanedAmbulanceId: Types.ObjectId;

  let driverForConfiguredProvId: Types.ObjectId;
  let mismatchedDriverId: Types.ObjectId;
  let orphanedDriverId: Types.ObjectId;

  let citizenUserId: Types.ObjectId;
  let citizenEmergencyId: Types.ObjectId;

  before(async () => {
    await connectTestDatabase();

    try {
      // 1. Create Organizations
      const [hospOrg, provOrg] = await Promise.all([
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
      ]);
      validHospitalOrgId = hospOrg._id;
      validProviderOrgId = provOrg._id;
      registry.orgIds.push(hospOrg._id, provOrg._id);

      // 2. Create Hospitals
      const [hosp1, hosp2, hosp3, hosp4, hosp5] = await Promise.all([
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
          // No organizationId
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
      ]);
      configuredHospitalId = hosp1._id;
      standaloneHospitalId = hosp2._id;
      wrongTypeHospitalId = hosp3._id;
      missingOrgHospitalId = hosp4._id;
      conflictingHospitalId = hosp5._id;
      registry.hospitalIds.push(hosp1._id, hosp2._id, hosp3._id, hosp4._id, hosp5._id);

      // 3. Create Providers
      const [prov1, prov2, prov3] = await Promise.all([
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
          // No organizationId
        }),
        AmbulanceProviderModel.create({
          name: 'TEST_Wrong Org Type Provider',
          registrationNumber: 'TEST_PLAN_PROV_003',
          email: 'test_plan_prov_003@example.com',
          phone: '1112223337',
          serviceType: 'Emergency',
          organizationId: validHospitalOrgId, // Wrong org type
        }),
      ]);
      configuredProviderId = prov1._id;
      standaloneProviderId = prov2._id;
      wrongTypeProviderId = prov3._id;
      registry.providerIds.push(prov1._id, prov2._id, prov3._id);

      // 4. Create Memberships
      const [mem1, mem2, mem3] = await Promise.all([
        OrganizationMembershipModel.create({
          organizationId: validHospitalOrgId,
          principalType: 'HOSPITAL',
          principalId: configuredHospitalId,
          role: 'HOSPITAL_ADMIN',
          status: 'ACTIVE',
        }),
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: configuredProviderId,
          role: 'PROVIDER_ADMIN',
          status: 'ACTIVE',
        }),
        // Conflicting membership for conflictingHospitalId
        OrganizationMembershipModel.create({
          organizationId: validProviderOrgId, // Different org
          principalType: 'HOSPITAL',
          principalId: conflictingHospitalId,
          role: 'ORG_MEMBER',
          status: 'ACTIVE',
        }),
      ]);
      registry.membershipIds.push(mem1._id, mem2._id, mem3._id);

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
      const [drv1, drv2, drv3] = await Promise.all([
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
      ]);
      driverForConfiguredProvId = drv1._id;
      mismatchedDriverId = drv2._id;
      orphanedDriverId = drv3._id;
      registry.driverIds.push(drv1._id, drv2._id, drv3._id);

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
});
