import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { type Types } from 'mongoose';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { env } from '../config/env.js';
import {
  OrganizationModel,
  type OrganizationType,
  type OrganizationStatus,
} from '../models/Organization.js';
import {
  OrganizationMembershipModel,
  type MembershipRole,
} from '../models/OrganizationMembership.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';

export type MigrationLedgerAction =
  | 'CREATE_ORGANIZATION'
  | 'CREATE_MEMBERSHIP'
  | 'UPDATE_ENTITY_ORGANIZATION'
  | 'INHERIT_PROVIDER_ORGANIZATION'
  | 'SKIP_ALREADY_CONFIGURED'
  | 'MANUAL_REVIEW';

export interface MigrationLedgerEntry {
  migrationVersion: string;
  idempotencyKey: string;
  sourceEntity: 'HOSPITAL' | 'AMBULANCE_PROVIDER' | 'AMBULANCE' | 'AMBULANCE_DRIVER' | 'EMERGENCY_REQUEST';
  sourceId: string;
  action: MigrationLedgerAction;
  proposedOrganizationId?: string;
  proposedOrganizationName?: string;
  proposedOrganizationType?: OrganizationType;
  proposedMembershipId?: string;
  proposedMembershipRole?: MembershipRole;
  mappingRule: string;
  confidence: 'DETERMINISTIC' | 'AMBIGUOUS' | 'INVALID';
  status: 'PLANNED' | 'MANUAL_REVIEW' | 'SKIPPED';
  reason: string;
  requiresManualReview: boolean;
  identifier?: string;
}

export interface EntityPlanCounts {
  total: number;
  plannedCreates: number;
  plannedUpdates: number;
  plannedInherits?: number;
  plannedMemberships?: number;
  skips: number;
  manualReview: number;
}

export interface BackfillPlanSummary {
  totalEntitiesScanned: number;
  proposedOrganizationCreates: number;
  proposedMembershipCreates: number;
  proposedEntityUpdates: number;
  proposedInheritances: number;
  alreadyConfiguredSkips: number;
  recordsRequiringManualReview: number;
}

export interface RollbackSpecification {
  strategy: 'IDEMPOTENT_LEDGER_REVERSAL';
  reversalInstructions: string[];
  databaseRequirements: string;
  safetyRules: string[];
}

export interface BackfillPlanReport {
  timestamp: string;
  databaseName: string;
  dryRun: true;
  readOnlyAudit: {
    executionPathAudited: true;
    writeOperationsCalled: 0;
    operationsAudited: string[];
    limitations: string;
    databaseLevelEnforcementRecommendation: string;
    memoryComplexity: string;
  };
  configuration: {
    batchSize: number;
    maxEntities: number;
    maxLedgerEntries: number;
    includeDetailedIdentifiers: boolean;
    migrationVersion: string;
  };
  summary: BackfillPlanSummary;
  countsByEntity: {
    hospitals: EntityPlanCounts;
    providers: EntityPlanCounts;
    ambulances: EntityPlanCounts;
    drivers: EntityPlanCounts;
    citizenEmergenciesPreserved: number;
  };
  ledger: MigrationLedgerEntry[];
  manualReviewRecords: MigrationLedgerEntry[];
  rollbackSpecification: RollbackSpecification;
}

export interface PlannerOptions {
  batchSize?: number;
  maxEntities?: number;
  maxLedgerEntries?: number;
  includeDetailedIdentifiers?: boolean;
  migrationVersion?: string;
}

export class PlannerThresholdExceededError extends Error {
  constructor(public readonly limit: number) {
    super(`Planner threshold exceeded: entity count exceeded configured limit of ${limit}. Aborting to avoid unbounded execution.`);
    this.name = 'PlannerThresholdExceededError';
  }
}

export class PlannerLedgerLimitExceededError extends Error {
  constructor(public readonly limit: number) {
    super(`Planner ledger limit exceeded: proposed action count exceeded configured limit of ${limit}. Aborting to avoid unbounded memory.`);
    this.name = 'PlannerLedgerLimitExceededError';
  }
}

export class PlannerConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlannerConfigurationError';
  }
}

export interface ParsedCliConfig {
  batchSize: number;
  maxEntities: number;
  maxLedgerEntries: number;
  outputPath?: string;
  isJson: boolean;
  includeDetailedIdentifiers: boolean;
}

export const validateIntegerArg = (flagName: string, rawVal: string, min: number, max: number): number => {
  const trimmed = rawVal.trim();
  if (!/^\d+$/.test(trimmed)) {
    throw new PlannerConfigurationError(
      `Invalid ${flagName}: expected a positive integer between ${min} and ${max}, received '${rawVal}'.`
    );
  }
  const val = Number.parseInt(trimmed, 10);
  if (!Number.isSafeInteger(val) || val < min || val > max) {
    throw new PlannerConfigurationError(
      `Invalid ${flagName}: expected a positive integer between ${min} and ${max}, received ${val}.`
    );
  }
  return val;
};

export const parseCliOptions = (args: string[]): ParsedCliConfig => {
  let batchSize = 500;
  let maxEntities = 100000;
  let maxLedgerEntries = 100000;
  let outputPath: string | undefined;
  const isJson = args.includes('--json');
  const includeDetailedIdentifiers = args.includes('--include-identifiers');

  for (const arg of args) {
    if (arg.startsWith('--batch-size=')) {
      const raw = arg.split('=')[1] ?? '';
      batchSize = validateIntegerArg('--batch-size', raw, 1, 10000);
    } else if (arg.startsWith('--max-entities=')) {
      const raw = arg.split('=')[1] ?? '';
      maxEntities = validateIntegerArg('--max-entities', raw, 1, 1000000);
    } else if (arg.startsWith('--max-ledger-entries=')) {
      const raw = arg.split('=')[1] ?? '';
      maxLedgerEntries = validateIntegerArg('--max-ledger-entries', raw, 1, 1000000);
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.split('=')[1];
      if (!outputPath || outputPath.trim() === '') {
        throw new PlannerConfigurationError('Invalid --output: expected a non-empty file path.');
      }
    }
  }

  return {
    batchSize,
    maxEntities,
    maxLedgerEntries,
    outputPath,
    isJson,
    includeDetailedIdentifiers,
  };
};

/**
 * Generate a deterministic 24-character hexadecimal ObjectId string from a seed.
 * Guarantees identical IDs across repeated planner dry runs on unchanged data.
 */
export const generateDeterministicId = (seed: string): string => {
  return crypto.createHash('sha256').update(seed).digest('hex').substring(0, 24);
};

export const planOrganizationBackfill = async (options: PlannerOptions = {}): Promise<BackfillPlanReport> => {
  const batchSize = Math.max(1, options.batchSize ?? 500);
  const maxEntities = options.maxEntities ?? 100000;
  const maxLedgerEntries = options.maxLedgerEntries ?? 100000;
  const includeDetailedIdentifiers = options.includeDetailedIdentifiers ?? false;
  const migrationVersion = options.migrationVersion ?? 'DATA-01C-V1';

  const timestamp = new Date().toISOString();
  const databaseName = mongoose.connection.name || 'unknown';
  const connected = mongoose.connection.readyState === 1;

  if (!connected) {
    throw new Error('Database connection is not ready. Cannot run organization backfill planner.');
  }

  const ledger: MigrationLedgerEntry[] = [];
  let totalEntitiesScanned = 0;

  const addEntry = (entry: MigrationLedgerEntry): void => {
    if (ledger.length >= maxLedgerEntries) {
      throw new PlannerLedgerLimitExceededError(maxLedgerEntries);
    }
    ledger.push(entry);
  };

  const checkThreshold = (): void => {
    totalEntitiesScanned++;
    if (totalEntitiesScanned > maxEntities) {
      throw new PlannerThresholdExceededError(maxEntities);
    }
  };

  // Track planned organizations so providers can register deterministic parent orgs for ambulances/drivers
  const plannedOrganizations = new Map<string, { orgId: string; type: OrganizationType; isDeterministic: boolean }>();

  // -------------------------------------------------------------
  // PHASE A: Plan Hospitals (Keyset pagination + batch-scoped lookups)
  // -------------------------------------------------------------
  const hospitalCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    skips: 0,
    manualReview: 0,
  };

  let lastHospitalId: Types.ObjectId | null = null;
  while (true) {
    const query = lastHospitalId ? { _id: { $gt: lastHospitalId } } : {};
    const hospitalBatch = await HospitalModel.find(
      query,
      {
        _id: 1,
        organizationId: 1,
        ...(includeDetailedIdentifiers ? { name: 1, registrationNumber: 1 } : {}),
      }
    )
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean()
      .exec();

    if (hospitalBatch.length === 0) break;
    lastHospitalId = hospitalBatch[hospitalBatch.length - 1]!._id as Types.ObjectId;

    const batchHospitalIds = hospitalBatch.map((h) => h._id);

    // Keyset batch-scoped membership query: load all memberships (all statuses) for this batch
    const batchMemberships = await OrganizationMembershipModel.find(
      { principalType: 'HOSPITAL', principalId: { $in: batchHospitalIds } },
      { organizationId: 1, principalType: 1, principalId: 1, role: 1, status: 1 }
    ).lean().exec();

    const membershipsByHospital = new Map<string, typeof batchMemberships>();
    for (const m of batchMemberships) {
      const key = String(m.principalId);
      const list = membershipsByHospital.get(key) || [];
      list.push(m);
      membershipsByHospital.set(key, list);
    }

    // Keyset batch-scoped organization query: load only organizations referenced in this batch
    const referencedOrgIds = new Set<string>();
    for (const h of hospitalBatch) {
      if (h.organizationId) referencedOrgIds.add(String(h.organizationId));
    }
    for (const m of batchMemberships) {
      if (m.organizationId) referencedOrgIds.add(String(m.organizationId));
    }

    const batchOrgs = referencedOrgIds.size > 0
      ? await OrganizationModel.find(
          { _id: { $in: Array.from(referencedOrgIds) } },
          { _id: 1, type: 1, status: 1 }
        ).lean().exec()
      : [];

    const batchOrgMap = new Map<string, { _id: Types.ObjectId; type: OrganizationType; status: OrganizationStatus }>();
    for (const org of batchOrgs) {
      batchOrgMap.set(String(org._id), org);
    }

    for (const hosp of hospitalBatch) {
      checkThreshold();
      hospitalCounts.total++;

      const hospId = String(hosp._id);
      const identifier = includeDetailedIdentifiers
        ? (hosp as { registrationNumber?: string; name?: string }).registrationNumber || (hosp as { name?: string }).name
        : undefined;

      const allMemberships = membershipsByHospital.get(hospId) || [];
      const activeMemberships = allMemberships.filter((m) => m.status === 'ACTIVE');
      const inactiveMemberships = allMemberships.filter((m) => m.status !== 'ACTIVE');

      // Check for duplicate membership conflict (multiple records for the same organization)
      const orgCounts = new Map<string, number>();
      for (const m of allMemberships) {
        const orgKey = String(m.organizationId);
        orgCounts.set(orgKey, (orgCounts.get(orgKey) || 0) + 1);
      }
      const hasDuplicateMembershipInSameOrg = Array.from(orgCounts.values()).some((count) => count > 1);

      if (hosp.organizationId) {
        const directOrgId = String(hosp.organizationId);
        const directOrg = batchOrgMap.get(directOrgId);

        if (!directOrg) {
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:org-missing:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'INVALID',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Hospital references organizationId '${directOrgId}' which does not exist in Organizations collection.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (directOrg.type !== 'HOSPITAL_NETWORK') {
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:wrong-org-type:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'INVALID',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Hospital references organization '${directOrgId}' of type '${directOrg.type}' (expected HOSPITAL_NETWORK).`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (directOrg.status !== 'ACTIVE') {
          // Explicit policy: suspended or archived organizations cannot receive automated assignment or skip
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:org-status-inactive:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'INVALID',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Hospital references organization '${directOrgId}' which has status '${directOrg.status}' (expected ACTIVE). Suspended/archived organizations cannot receive automated backfill.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (hasDuplicateMembershipInSameOrg) {
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:duplicate-membership-conflict:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Hospital has multiple duplicate memberships in the same organization. Data integrity violation requires manual review.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length > 0) {
          // Mixed active and inactive membership states
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:mixed-membership-states:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Hospital has mixed membership states: ${activeMemberships.length} active and ${inactiveMemberships.length} inactive (SUSPENDED/REVOKED) membership(s). Inactive membership history cannot be bypassed automatically. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length === 0) {
          // Only inactive memberships exist
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:unresolved-membership-evidence:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Hospital has non-active membership evidence in organization '${inactiveMemberships[0]!.organizationId}' (status: ${inactiveMemberships[0]!.status}). Inactive membership cannot be bypassed. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (allMemberships.some((m) => String(m.organizationId) !== directOrgId)) {
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:membership-conflict:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Hospital has conflicting organization assignments between direct organizationId and membership records.`,
            ...(identifier ? { identifier } : {}),
          });
        } else {
          // Valid existing assignment to active HOSPITAL_NETWORK with no inactive memberships
          const hasValidMembership = activeMemberships.some(
            (m) => String(m.organizationId) === directOrgId && m.role === 'HOSPITAL_ADMIN'
          );

          if (hasValidMembership) {
            hospitalCounts.skips++;
            addEntry({
              migrationVersion,
              idempotencyKey: `hosp:already-configured:${hospId}`,
              sourceEntity: 'HOSPITAL',
              sourceId: hospId,
              action: 'SKIP_ALREADY_CONFIGURED',
              proposedOrganizationId: directOrgId,
              proposedOrganizationType: 'HOSPITAL_NETWORK',
              confidence: 'DETERMINISTIC',
              status: 'SKIPPED',
              requiresManualReview: false,
              mappingRule: 'RULE_6_PRESERVE_VALID_ASSIGNMENTS',
              reason: `Hospital is already correctly configured with valid organization '${directOrgId}' and HOSPITAL_ADMIN membership.`,
              ...(identifier ? { identifier } : {}),
            });
          } else {
            // Check unique compound index protection on { organizationId, principalType, principalId }
            const existingMembershipInOrg = allMemberships.find(
              (m) => String(m.organizationId) === directOrgId
            );

            if (existingMembershipInOrg) {
              hospitalCounts.manualReview++;
              addEntry({
                migrationVersion,
                idempotencyKey: `hosp:membership-index-conflict:${hospId}`,
                sourceEntity: 'HOSPITAL',
                sourceId: hospId,
                action: 'MANUAL_REVIEW',
                confidence: 'AMBIGUOUS',
                status: 'MANUAL_REVIEW',
                requiresManualReview: true,
                mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
                reason: `Hospital has valid organizationId '${directOrgId}' but already has an existing membership with status '${existingMembershipInOrg.status}' and role '${existingMembershipInOrg.role}'. Proposing CREATE_MEMBERSHIP would violate unique compound index. Manual review required.`,
                ...(identifier ? { identifier } : {}),
              });
            } else {
              hospitalCounts.plannedCreates++;
              const proposedMemId = generateDeterministicId(`mem:${directOrgId}:HOSPITAL:${hospId}`);
              addEntry({
                migrationVersion,
                idempotencyKey: `hosp:create-mem:${hospId}`,
                sourceEntity: 'HOSPITAL',
                sourceId: hospId,
                action: 'CREATE_MEMBERSHIP',
                proposedOrganizationId: directOrgId,
                proposedOrganizationType: 'HOSPITAL_NETWORK',
                proposedMembershipId: proposedMemId,
                proposedMembershipRole: 'HOSPITAL_ADMIN',
                confidence: 'DETERMINISTIC',
                status: 'PLANNED',
                requiresManualReview: false,
                mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
                reason: `Hospital has valid organizationId '${directOrgId}' but is missing active HOSPITAL_ADMIN membership.`,
                ...(identifier ? { identifier } : {}),
              });
            }
          }
        }
      } else {
        // Hospital without organizationId
        if (hasDuplicateMembershipInSameOrg) {
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:duplicate-membership-conflict:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Hospital has multiple duplicate memberships in the same organization. Data integrity violation requires manual review.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length > 0) {
          // Mixed active and inactive membership states
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:mixed-membership-states:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Hospital has mixed membership states: ${activeMemberships.length} active and ${inactiveMemberships.length} inactive (SUSPENDED/REVOKED) membership(s). Inactive membership history cannot be bypassed automatically. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length === 0) {
          // Inactive/suspended memberships exist -> unresolved membership evidence requires manual review
          hospitalCounts.manualReview++;
          const inactiveMem = inactiveMemberships[0]!;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:unresolved-membership-evidence:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Hospital has non-active membership evidence in organization '${inactiveMem.organizationId}' (status: ${inactiveMem.status}). Never create a new organization while unresolved membership evidence exists.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (activeMemberships.length > 1) {
          hospitalCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:multi-membership-ambiguity:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Hospital has multiple active memberships across distinct organizations. Automatic assignment halted.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (activeMemberships.length === 1 && activeMemberships[0]) {
          const mem = activeMemberships[0];
          const memOrgId = String(mem.organizationId);
          const memOrg = batchOrgMap.get(memOrgId);

          if (!memOrg) {
            hospitalCounts.manualReview++;
            addEntry({
              migrationVersion,
              idempotencyKey: `hosp:mem-org-missing:${hospId}`,
              sourceEntity: 'HOSPITAL',
              sourceId: hospId,
              action: 'MANUAL_REVIEW',
              confidence: 'INVALID',
              status: 'MANUAL_REVIEW',
              requiresManualReview: true,
              mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
              reason: `Hospital has active membership in organization '${memOrgId}' which does not exist in Organizations collection. Automatic assignment halted.`,
              ...(identifier ? { identifier } : {}),
            });
          } else if (memOrg.type !== 'HOSPITAL_NETWORK') {
            hospitalCounts.manualReview++;
            addEntry({
              migrationVersion,
              idempotencyKey: `hosp:mem-wrong-org-type:${hospId}`,
              sourceEntity: 'HOSPITAL',
              sourceId: hospId,
              action: 'MANUAL_REVIEW',
              confidence: 'INVALID',
              status: 'MANUAL_REVIEW',
              requiresManualReview: true,
              mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
              reason: `Hospital has active membership in organization '${memOrgId}' of type '${memOrg.type}' (expected HOSPITAL_NETWORK). Automatic assignment halted.`,
              ...(identifier ? { identifier } : {}),
            });
          } else if (memOrg.status !== 'ACTIVE') {
            hospitalCounts.manualReview++;
            addEntry({
              migrationVersion,
              idempotencyKey: `hosp:mem-org-inactive:${hospId}`,
              sourceEntity: 'HOSPITAL',
              sourceId: hospId,
              action: 'MANUAL_REVIEW',
              confidence: 'INVALID',
              status: 'MANUAL_REVIEW',
              requiresManualReview: true,
              mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
              reason: `Hospital has active membership in organization '${memOrgId}' which has status '${memOrg.status}' (expected ACTIVE). Suspended/archived organizations cannot receive automated backfill.`,
              ...(identifier ? { identifier } : {}),
            });
          } else {
            // Verified active HOSPITAL_NETWORK organization
            hospitalCounts.plannedUpdates++;
            addEntry({
              migrationVersion,
              idempotencyKey: `hosp:update-from-mem:${hospId}`,
              sourceEntity: 'HOSPITAL',
              sourceId: hospId,
              action: 'UPDATE_ENTITY_ORGANIZATION',
              proposedOrganizationId: memOrgId,
              proposedOrganizationType: 'HOSPITAL_NETWORK',
              confidence: 'DETERMINISTIC',
              status: 'PLANNED',
              requiresManualReview: false,
              mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
              reason: `Inherit organization from verified existing active membership in '${memOrgId}'.`,
              ...(identifier ? { identifier } : {}),
            });
          }
        } else {
          // Zero memberships exist and no direct organizationId: pure standalone hospital
          hospitalCounts.plannedCreates++;
          hospitalCounts.plannedUpdates++;

          const proposedOrgId = generateDeterministicId(`org:hospital:${hospId}`);
          const proposedOrgName = includeDetailedIdentifiers
            ? `${(hosp as { name?: string }).name || 'Hospital'} Network`
            : `Hospital Network ${hospId.substring(18, 24).toUpperCase()}`;

          const proposedMemId = generateDeterministicId(`mem:${proposedOrgId}:HOSPITAL:${hospId}`);

          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:create-org:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'CREATE_ORGANIZATION',
            proposedOrganizationId: proposedOrgId,
            proposedOrganizationName: proposedOrgName,
            proposedOrganizationType: 'HOSPITAL_NETWORK',
            confidence: 'DETERMINISTIC',
            status: 'PLANNED',
            requiresManualReview: false,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Deterministic standalone hospital backfill: create dedicated HOSPITAL_NETWORK organization.`,
            ...(identifier ? { identifier } : {}),
          });

          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:create-org-mem:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'CREATE_MEMBERSHIP',
            proposedOrganizationId: proposedOrgId,
            proposedOrganizationType: 'HOSPITAL_NETWORK',
            proposedMembershipId: proposedMemId,
            proposedMembershipRole: 'HOSPITAL_ADMIN',
            confidence: 'DETERMINISTIC',
            status: 'PLANNED',
            requiresManualReview: false,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Create initial HOSPITAL_ADMIN membership in newly planned organization '${proposedOrgId}'.`,
            ...(identifier ? { identifier } : {}),
          });

          addEntry({
            migrationVersion,
            idempotencyKey: `hosp:set-org-ref:${hospId}`,
            sourceEntity: 'HOSPITAL',
            sourceId: hospId,
            action: 'UPDATE_ENTITY_ORGANIZATION',
            proposedOrganizationId: proposedOrgId,
            proposedOrganizationType: 'HOSPITAL_NETWORK',
            confidence: 'DETERMINISTIC',
            status: 'PLANNED',
            requiresManualReview: false,
            mappingRule: 'RULE_1_HOSPITAL_NETWORK_AUTHORITY',
            reason: `Set hospital organizationId to newly planned organization '${proposedOrgId}'.`,
            ...(identifier ? { identifier } : {}),
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE B: Plan Ambulance Providers (Keyset pagination + batch-scoped lookups)
  // -------------------------------------------------------------
  const providerCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    skips: 0,
    manualReview: 0,
  };

  let lastProviderId: Types.ObjectId | null = null;
  while (true) {
    const query = lastProviderId ? { _id: { $gt: lastProviderId } } : {};
    const providerBatch = await AmbulanceProviderModel.find(
      query,
      {
        _id: 1,
        organizationId: 1,
        ...(includeDetailedIdentifiers ? { name: 1, registrationNumber: 1 } : {}),
      }
    )
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean()
      .exec();

    if (providerBatch.length === 0) break;
    lastProviderId = providerBatch[providerBatch.length - 1]!._id as Types.ObjectId;

    const batchProviderIds = providerBatch.map((p) => p._id);

    // Keyset batch-scoped membership query: load all memberships (all statuses) for this batch
    const batchMemberships = await OrganizationMembershipModel.find(
      { principalType: 'AMBULANCE_PROVIDER', principalId: { $in: batchProviderIds } },
      { organizationId: 1, principalType: 1, principalId: 1, role: 1, status: 1 }
    ).lean().exec();

    const membershipsByProvider = new Map<string, typeof batchMemberships>();
    for (const m of batchMemberships) {
      const key = String(m.principalId);
      const list = membershipsByProvider.get(key) || [];
      list.push(m);
      membershipsByProvider.set(key, list);
    }

    // Keyset batch-scoped organization query: load only organizations referenced in this batch
    const referencedOrgIds = new Set<string>();
    for (const p of providerBatch) {
      if (p.organizationId) referencedOrgIds.add(String(p.organizationId));
    }
    for (const m of batchMemberships) {
      if (m.organizationId) referencedOrgIds.add(String(m.organizationId));
    }

    const batchOrgs = referencedOrgIds.size > 0
      ? await OrganizationModel.find(
          { _id: { $in: Array.from(referencedOrgIds) } },
          { _id: 1, type: 1, status: 1 }
        ).lean().exec()
      : [];

    const batchOrgMap = new Map<string, { _id: Types.ObjectId; type: OrganizationType; status: OrganizationStatus }>();
    for (const org of batchOrgs) {
      batchOrgMap.set(String(org._id), org);
    }

    for (const prov of providerBatch) {
      checkThreshold();
      providerCounts.total++;

      const provId = String(prov._id);
      const identifier = includeDetailedIdentifiers
        ? (prov as { registrationNumber?: string; name?: string }).registrationNumber || (prov as { name?: string }).name
        : undefined;

      const allMemberships = membershipsByProvider.get(provId) || [];
      const activeMemberships = allMemberships.filter((m) => m.status === 'ACTIVE');
      const inactiveMemberships = allMemberships.filter((m) => m.status !== 'ACTIVE');

      // Check for duplicate membership conflict (multiple records for the same organization)
      const orgCounts = new Map<string, number>();
      for (const m of allMemberships) {
        const orgKey = String(m.organizationId);
        orgCounts.set(orgKey, (orgCounts.get(orgKey) || 0) + 1);
      }
      const hasDuplicateMembershipInSameOrg = Array.from(orgCounts.values()).some((count) => count > 1);

      if (prov.organizationId) {
        const directOrgId = String(prov.organizationId);
        const directOrg = batchOrgMap.get(directOrgId);

        if (!directOrg) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:org-missing:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'INVALID',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Provider references organizationId '${directOrgId}' which does not exist in Organizations collection.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (directOrg.type !== 'AMBULANCE_OPERATOR') {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: directOrg.type, isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:wrong-org-type:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'INVALID',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Provider references organization '${directOrgId}' of type '${directOrg.type}' (expected AMBULANCE_OPERATOR).`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (directOrg.status !== 'ACTIVE') {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: directOrg.type, isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:org-status-inactive:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'INVALID',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Provider references organization '${directOrgId}' which has status '${directOrg.status}' (expected ACTIVE). Suspended/archived organizations cannot receive automated backfill.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (hasDuplicateMembershipInSameOrg) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:duplicate-membership-conflict:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Provider has multiple duplicate memberships in the same organization. Data integrity violation requires manual review.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length > 0) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:mixed-membership-states:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Provider has mixed membership states: ${activeMemberships.length} active and ${inactiveMemberships.length} inactive (SUSPENDED/REVOKED) membership(s). Inactive membership history cannot be bypassed automatically. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length === 0) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:unresolved-membership-evidence:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Provider has non-active membership evidence in organization '${inactiveMemberships[0]!.organizationId}' (status: ${inactiveMemberships[0]!.status}). Inactive membership cannot be bypassed. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (allMemberships.some((m) => String(m.organizationId) !== directOrgId)) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:membership-conflict:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Provider has conflicting organization assignments between direct organizationId and membership records.`,
            ...(identifier ? { identifier } : {}),
          });
        } else {
          // Valid existing provider assignment to active AMBULANCE_OPERATOR with no inactive memberships
          const hasValidMembership = activeMemberships.some(
            (m) => String(m.organizationId) === directOrgId && m.role === 'PROVIDER_ADMIN'
          );

          if (hasValidMembership) {
            plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: true });
            providerCounts.skips++;
            addEntry({
              migrationVersion,
              idempotencyKey: `prov:already-configured:${provId}`,
              sourceEntity: 'AMBULANCE_PROVIDER',
              sourceId: provId,
              action: 'SKIP_ALREADY_CONFIGURED',
              proposedOrganizationId: directOrgId,
              proposedOrganizationType: 'AMBULANCE_OPERATOR',
              confidence: 'DETERMINISTIC',
              status: 'SKIPPED',
              requiresManualReview: false,
              mappingRule: 'RULE_6_PRESERVE_VALID_ASSIGNMENTS',
              reason: `Provider is already correctly configured with valid organization '${directOrgId}' and PROVIDER_ADMIN membership.`,
              ...(identifier ? { identifier } : {}),
            });
          } else {
            // Check unique compound index protection on { organizationId, principalType, principalId }
            const existingMembershipInOrg = allMemberships.find(
              (m) => String(m.organizationId) === directOrgId
            );

            if (existingMembershipInOrg) {
              plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
              providerCounts.manualReview++;
              addEntry({
                migrationVersion,
                idempotencyKey: `prov:membership-index-conflict:${provId}`,
                sourceEntity: 'AMBULANCE_PROVIDER',
                sourceId: provId,
                action: 'MANUAL_REVIEW',
                confidence: 'AMBIGUOUS',
                status: 'MANUAL_REVIEW',
                requiresManualReview: true,
                mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
                reason: `Provider has valid organizationId '${directOrgId}' but already has an existing membership with status '${existingMembershipInOrg.status}' and role '${existingMembershipInOrg.role}'. Proposing CREATE_MEMBERSHIP would violate unique compound index. Manual review required.`,
                ...(identifier ? { identifier } : {}),
              });
            } else {
              plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: true });
              providerCounts.plannedCreates++;
              const proposedMemId = generateDeterministicId(`mem:${directOrgId}:AMBULANCE_PROVIDER:${provId}`);
              addEntry({
                migrationVersion,
                idempotencyKey: `prov:create-mem:${provId}`,
                sourceEntity: 'AMBULANCE_PROVIDER',
                sourceId: provId,
                action: 'CREATE_MEMBERSHIP',
                proposedOrganizationId: directOrgId,
                proposedOrganizationType: 'AMBULANCE_OPERATOR',
                proposedMembershipId: proposedMemId,
                proposedMembershipRole: 'PROVIDER_ADMIN',
                confidence: 'DETERMINISTIC',
                status: 'PLANNED',
                requiresManualReview: false,
                mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
                reason: `Provider has valid organizationId '${directOrgId}' but is missing active PROVIDER_ADMIN membership.`,
                ...(identifier ? { identifier } : {}),
              });
            }
          }
        }
      } else {
        // Provider without organizationId
        if (hasDuplicateMembershipInSameOrg) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: '', type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:duplicate-membership-conflict:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Provider has multiple duplicate memberships in the same organization. Data integrity violation requires manual review.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length > 0) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: '', type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:mixed-membership-states:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Provider has mixed membership states: ${activeMemberships.length} active and ${inactiveMemberships.length} inactive (SUSPENDED/REVOKED) membership(s). Inactive membership history cannot be bypassed automatically. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (inactiveMemberships.length > 0 && activeMemberships.length === 0) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: '', type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          const inactiveMem = inactiveMemberships[0]!;
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:unresolved-membership-evidence:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Provider has non-active membership evidence in organization '${inactiveMem.organizationId}' (status: ${inactiveMem.status}). Never create a new organization while unresolved membership evidence exists.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (activeMemberships.length > 1) {
          providerCounts.manualReview++;
          plannedOrganizations.set(provId, { orgId: '', type: 'AMBULANCE_OPERATOR', isDeterministic: false });
          addEntry({
            migrationVersion,
            idempotencyKey: `prov:multi-membership-ambiguity:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Provider has multiple active memberships across distinct organizations. Automatic assignment halted.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (activeMemberships.length === 1 && activeMemberships[0]) {
          const mem = activeMemberships[0];
          const memOrgId = String(mem.organizationId);
          const memOrg = batchOrgMap.get(memOrgId);

          if (!memOrg) {
            providerCounts.manualReview++;
            plannedOrganizations.set(provId, { orgId: memOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: false });
            addEntry({
              migrationVersion,
              idempotencyKey: `prov:mem-org-missing:${provId}`,
              sourceEntity: 'AMBULANCE_PROVIDER',
              sourceId: provId,
              action: 'MANUAL_REVIEW',
              confidence: 'INVALID',
              status: 'MANUAL_REVIEW',
              requiresManualReview: true,
              mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
              reason: `Provider has active membership in organization '${memOrgId}' which does not exist in Organizations collection. Automatic assignment halted.`,
              ...(identifier ? { identifier } : {}),
            });
          } else if (memOrg.type !== 'AMBULANCE_OPERATOR') {
            providerCounts.manualReview++;
            plannedOrganizations.set(provId, { orgId: memOrgId, type: memOrg.type, isDeterministic: false });
            addEntry({
              migrationVersion,
              idempotencyKey: `prov:mem-wrong-org-type:${provId}`,
              sourceEntity: 'AMBULANCE_PROVIDER',
              sourceId: provId,
              action: 'MANUAL_REVIEW',
              confidence: 'INVALID',
              status: 'MANUAL_REVIEW',
              requiresManualReview: true,
              mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
              reason: `Provider has active membership in organization '${memOrgId}' of type '${memOrg.type}' (expected AMBULANCE_OPERATOR). Automatic assignment halted.`,
              ...(identifier ? { identifier } : {}),
            });
          } else if (memOrg.status !== 'ACTIVE') {
            providerCounts.manualReview++;
            plannedOrganizations.set(provId, { orgId: memOrgId, type: memOrg.type, isDeterministic: false });
            addEntry({
              migrationVersion,
              idempotencyKey: `prov:mem-org-inactive:${provId}`,
              sourceEntity: 'AMBULANCE_PROVIDER',
              sourceId: provId,
              action: 'MANUAL_REVIEW',
              confidence: 'INVALID',
              status: 'MANUAL_REVIEW',
              requiresManualReview: true,
              mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
              reason: `Provider has active membership in organization '${memOrgId}' which has status '${memOrg.status}' (expected ACTIVE). Suspended/archived organizations cannot receive automated backfill.`,
              ...(identifier ? { identifier } : {}),
            });
          } else {
            // Verified active AMBULANCE_OPERATOR organization
            providerCounts.plannedUpdates++;
            plannedOrganizations.set(provId, { orgId: memOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: true });
            addEntry({
              migrationVersion,
              idempotencyKey: `prov:update-from-mem:${provId}`,
              sourceEntity: 'AMBULANCE_PROVIDER',
              sourceId: provId,
              action: 'UPDATE_ENTITY_ORGANIZATION',
              proposedOrganizationId: memOrgId,
              proposedOrganizationType: 'AMBULANCE_OPERATOR',
              confidence: 'DETERMINISTIC',
              status: 'PLANNED',
              requiresManualReview: false,
              mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
              reason: `Inherit organization from verified existing active membership in '${memOrgId}'.`,
              ...(identifier ? { identifier } : {}),
            });
          }
        } else {
          // Pure standalone provider: deterministically create dedicated AMBULANCE_OPERATOR
          providerCounts.plannedCreates++;
          providerCounts.plannedUpdates++;

          const proposedOrgId = generateDeterministicId(`org:provider:${provId}`);
          const proposedOrgName = includeDetailedIdentifiers
            ? `${(prov as { name?: string }).name || 'Fleet'} Operator`
            : `Ambulance Operator ${provId.substring(18, 24).toUpperCase()}`;

          const proposedMemId = generateDeterministicId(`mem:${proposedOrgId}:AMBULANCE_PROVIDER:${provId}`);
          plannedOrganizations.set(provId, { orgId: proposedOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: true });

          addEntry({
            migrationVersion,
            idempotencyKey: `prov:create-org:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'CREATE_ORGANIZATION',
            proposedOrganizationId: proposedOrgId,
            proposedOrganizationName: proposedOrgName,
            proposedOrganizationType: 'AMBULANCE_OPERATOR',
            confidence: 'DETERMINISTIC',
            status: 'PLANNED',
            requiresManualReview: false,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Deterministic standalone provider backfill: create dedicated AMBULANCE_OPERATOR organization.`,
            ...(identifier ? { identifier } : {}),
          });

          addEntry({
            migrationVersion,
            idempotencyKey: `prov:create-org-mem:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'CREATE_MEMBERSHIP',
            proposedOrganizationId: proposedOrgId,
            proposedOrganizationType: 'AMBULANCE_OPERATOR',
            proposedMembershipId: proposedMemId,
            proposedMembershipRole: 'PROVIDER_ADMIN',
            confidence: 'DETERMINISTIC',
            status: 'PLANNED',
            requiresManualReview: false,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Create initial PROVIDER_ADMIN membership in newly planned organization '${proposedOrgId}'.`,
            ...(identifier ? { identifier } : {}),
          });

          addEntry({
            migrationVersion,
            idempotencyKey: `prov:set-org-ref:${provId}`,
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: provId,
            action: 'UPDATE_ENTITY_ORGANIZATION',
            proposedOrganizationId: proposedOrgId,
            proposedOrganizationType: 'AMBULANCE_OPERATOR',
            confidence: 'DETERMINISTIC',
            status: 'PLANNED',
            requiresManualReview: false,
            mappingRule: 'RULE_2_AMBULANCE_OPERATOR_AUTHORITY',
            reason: `Set provider organizationId to newly planned organization '${proposedOrgId}'.`,
            ...(identifier ? { identifier } : {}),
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE C: Plan Ambulances (Keyset pagination)
  // -------------------------------------------------------------
  const ambulanceCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    plannedInherits: 0,
    skips: 0,
    manualReview: 0,
  };

  let lastAmbulanceId: Types.ObjectId | null = null;
  while (true) {
    const query = lastAmbulanceId ? { _id: { $gt: lastAmbulanceId } } : {};
    const ambulanceBatch = await AmbulanceModel.find(
      query,
      {
        _id: 1,
        providerId: 1,
        ...(includeDetailedIdentifiers ? { vehicleNumber: 1, registrationNumber: 1 } : {}),
      }
    )
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean()
      .exec();

    if (ambulanceBatch.length === 0) break;
    lastAmbulanceId = ambulanceBatch[ambulanceBatch.length - 1]!._id as Types.ObjectId;

    for (const amb of ambulanceBatch) {
      checkThreshold();
      ambulanceCounts.total++;

      const ambId = String(amb._id);
      const identifier = includeDetailedIdentifiers
        ? (amb as { vehicleNumber?: string; registrationNumber?: string }).vehicleNumber || (amb as { registrationNumber?: string }).registrationNumber
        : undefined;

      const parentProvider = plannedOrganizations.get(String(amb.providerId));

      if (!amb.providerId || !parentProvider) {
        ambulanceCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `amb:orphaned:${ambId}`,
          sourceEntity: 'AMBULANCE',
          sourceId: ambId,
          action: 'MANUAL_REVIEW',
          confidence: 'INVALID',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_3_AMBULANCE_PROVIDER_INHERITANCE',
          reason: `Ambulance references non-existent or unresolvable providerId '${amb.providerId}'.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (parentProvider.isDeterministic) {
        ambulanceCounts.plannedInherits!++;
        addEntry({
          migrationVersion,
          idempotencyKey: `amb:inherit-org:${ambId}`,
          sourceEntity: 'AMBULANCE',
          sourceId: ambId,
          action: 'INHERIT_PROVIDER_ORGANIZATION',
          proposedOrganizationId: parentProvider.orgId,
          proposedOrganizationType: 'AMBULANCE_OPERATOR',
          confidence: 'DETERMINISTIC',
          status: 'PLANNED',
          requiresManualReview: false,
          mappingRule: 'RULE_3_AMBULANCE_PROVIDER_INHERITANCE',
          reason: `Ambulance inherits organization '${parentProvider.orgId}' from authoritative parent provider '${amb.providerId}'.`,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        ambulanceCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `amb:parent-ambiguous:${ambId}`,
          sourceEntity: 'AMBULANCE',
          sourceId: ambId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_3_AMBULANCE_PROVIDER_INHERITANCE',
          reason: `Parent provider '${amb.providerId}' has ambiguous or invalid organization status.`,
          ...(identifier ? { identifier } : {}),
        });
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE D: Plan Ambulance Drivers (Keyset pagination + batch lookups)
  // -------------------------------------------------------------
  const driverCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    plannedInherits: 0,
    plannedMemberships: 0,
    skips: 0,
    manualReview: 0,
  };

  let lastDriverId: Types.ObjectId | null = null;
  while (true) {
    const query = lastDriverId ? { _id: { $gt: lastDriverId } } : {};
    const driverBatch = await AmbulanceDriverModel.find(
      query,
      {
        _id: 1,
        providerId: 1,
        assignedAmbulanceId: 1,
        ...(includeDetailedIdentifiers ? { licenseNumber: 1, fullName: 1 } : {}),
      }
    )
      .sort({ _id: 1 })
      .limit(batchSize)
      .lean()
      .exec();

    if (driverBatch.length === 0) break;
    lastDriverId = driverBatch[driverBatch.length - 1]!._id as Types.ObjectId;

    const batchDriverIds = driverBatch.map((d) => d._id);

    // Keyset batch-scoped membership query for drivers (all statuses)
    const batchDriverMemberships = await OrganizationMembershipModel.find(
      { principalType: 'AMBULANCE_DRIVER', principalId: { $in: batchDriverIds } },
      { organizationId: 1, principalType: 1, principalId: 1, role: 1, status: 1 }
    ).lean().exec();

    const membershipsByDriver = new Map<string, typeof batchDriverMemberships>();
    for (const m of batchDriverMemberships) {
      const key = String(m.principalId);
      const list = membershipsByDriver.get(key) || [];
      list.push(m);
      membershipsByDriver.set(key, list);
    }

    // Collect assignedAmbulanceIds only for this batch
    const batchAmbulanceIds = driverBatch
      .map((d) => d.assignedAmbulanceId)
      .filter((id): id is Types.ObjectId => Boolean(id));

    let batchAmbulanceMap = new Map<string, { providerId: Types.ObjectId }>();
    if (batchAmbulanceIds.length > 0) {
      const ambList = await AmbulanceModel.find(
        { _id: { $in: batchAmbulanceIds } },
        { _id: 1, providerId: 1 }
      ).lean().exec();

      batchAmbulanceMap = new Map(ambList.map((amb) => [String(amb._id), { providerId: amb.providerId }]));
    }

    for (const d of driverBatch) {
      checkThreshold();
      driverCounts.total++;

      const drvId = String(d._id);
      const identifier = includeDetailedIdentifiers
        ? (d as { licenseNumber?: string; fullName?: string }).licenseNumber || (d as { fullName?: string }).fullName
        : undefined;

      const parentProvider = plannedOrganizations.get(String(d.providerId));
      const assignedAmbulance = d.assignedAmbulanceId ? batchAmbulanceMap.get(String(d.assignedAmbulanceId)) : undefined;

      const allDriverMemberships = membershipsByDriver.get(drvId) || [];
      const activeDriverMemberships = allDriverMemberships.filter((m) => m.status === 'ACTIVE');
      const inactiveDriverMemberships = allDriverMemberships.filter((m) => m.status !== 'ACTIVE');

      // Check for duplicate membership conflict (multiple records for the same organization)
      const driverOrgCounts = new Map<string, number>();
      for (const m of allDriverMemberships) {
        const orgKey = String(m.organizationId);
        driverOrgCounts.set(orgKey, (driverOrgCounts.get(orgKey) || 0) + 1);
      }
      const hasDuplicateDriverMembership = Array.from(driverOrgCounts.values()).some((count) => count > 1);

      if (!d.providerId || !parentProvider) {
        driverCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:orphaned:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'INVALID',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_4_DRIVER_PROVIDER_INHERITANCE',
          reason: `Driver references non-existent or unresolvable providerId '${d.providerId}'.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (d.assignedAmbulanceId && !assignedAmbulance) {
        driverCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:ambulance-missing:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_4_DRIVER_PROVIDER_INHERITANCE',
          reason: `Driver assigned ambulance '${d.assignedAmbulanceId}' does not exist in Ambulance_Data.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (assignedAmbulance && String(assignedAmbulance.providerId) !== String(d.providerId)) {
        // RULE 5: Drivers assigned to ambulances belonging to a different provider must be marked as conflicts requiring manual review
        driverCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:provider-ambulance-mismatch:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_5_DRIVER_AMBULANCE_PROVIDER_MISMATCH',
          reason: `Conflict: Driver belongs to provider '${d.providerId}' but assigned ambulance belongs to provider '${assignedAmbulance.providerId}'. Manual review required.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (!parentProvider.isDeterministic) {
        driverCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:parent-ambiguous:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_4_DRIVER_PROVIDER_INHERITANCE',
          reason: `Parent provider '${d.providerId}' has ambiguous or invalid organization status.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (hasDuplicateDriverMembership) {
        driverCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:duplicate-membership-conflict:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
          reason: `Driver has multiple duplicate memberships in the same organization. Data integrity violation requires manual review.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (inactiveDriverMemberships.length > 0 && activeDriverMemberships.length > 0) {
        // Mixed active and inactive membership states
        driverCounts.manualReview++;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:mixed-membership-states:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
          reason: `Driver has mixed membership states: ${activeDriverMemberships.length} active and ${inactiveDriverMemberships.length} inactive (SUSPENDED/REVOKED) membership(s). Inactive membership history cannot be bypassed automatically. Manual review required.`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (inactiveDriverMemberships.length > 0 && activeDriverMemberships.length === 0) {
        driverCounts.manualReview++;
        const inactiveMem = inactiveDriverMemberships[0]!;
        addEntry({
          migrationVersion,
          idempotencyKey: `drv:unresolved-membership-evidence:${drvId}`,
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: drvId,
          action: 'MANUAL_REVIEW',
          confidence: 'AMBIGUOUS',
          status: 'MANUAL_REVIEW',
          requiresManualReview: true,
          mappingRule: 'RULE_4_DRIVER_PROVIDER_INHERITANCE',
          reason: `Driver has non-active membership evidence in organization '${inactiveMem.organizationId}' (status: ${inactiveMem.status}). Inactive membership cannot be bypassed. Manual review required.`,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        // Parent provider is deterministic, and driver has no inactive or duplicate memberships
        const activeOrgIds = new Set(activeDriverMemberships.map((m) => String(m.organizationId)));

        if (activeOrgIds.size > 1) {
          driverCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `drv:multi-org-membership:${drvId}`,
            sourceEntity: 'AMBULANCE_DRIVER',
            sourceId: drvId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Driver has active memberships across multiple organizations (${Array.from(activeOrgIds).join(', ')}). Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else if (activeDriverMemberships.some((m) => String(m.organizationId) !== parentProvider.orgId)) {
          const conflictingOrgId = String(activeDriverMemberships[0]!.organizationId);
          driverCounts.manualReview++;
          addEntry({
            migrationVersion,
            idempotencyKey: `drv:membership-org-mismatch:${drvId}`,
            sourceEntity: 'AMBULANCE_DRIVER',
            sourceId: drvId,
            action: 'MANUAL_REVIEW',
            confidence: 'AMBIGUOUS',
            status: 'MANUAL_REVIEW',
            requiresManualReview: true,
            mappingRule: 'RULE_7_PRESERVE_CONFLICTING_ASSIGNMENTS',
            reason: `Driver belongs to provider with organization '${parentProvider.orgId}', but has active membership in conflicting organization '${conflictingOrgId}'. Manual review required.`,
            ...(identifier ? { identifier } : {}),
          });
        } else {
          // No active memberships in other orgs. Check target provider org:
          const hasDriverMembership = activeDriverMemberships.some(
            (m) => String(m.organizationId) === parentProvider.orgId && m.role === 'DRIVER'
          );

          if (hasDriverMembership) {
            driverCounts.skips++;
            addEntry({
              migrationVersion,
              idempotencyKey: `drv:already-configured:${drvId}`,
              sourceEntity: 'AMBULANCE_DRIVER',
              sourceId: drvId,
              action: 'SKIP_ALREADY_CONFIGURED',
              proposedOrganizationId: parentProvider.orgId,
              proposedOrganizationType: 'AMBULANCE_OPERATOR',
              confidence: 'DETERMINISTIC',
              status: 'SKIPPED',
              requiresManualReview: false,
              mappingRule: 'RULE_6_PRESERVE_VALID_ASSIGNMENTS',
              reason: `Driver already has valid DRIVER membership in provider organization '${parentProvider.orgId}'.`,
              ...(identifier ? { identifier } : {}),
            });
          } else {
            // Check unique compound index protection on { organizationId, principalType, principalId }
            const existingMembershipInOrg = allDriverMemberships.find(
              (m) => String(m.organizationId) === parentProvider.orgId
            );

            if (existingMembershipInOrg) {
              driverCounts.manualReview++;
              addEntry({
                migrationVersion,
                idempotencyKey: `drv:membership-index-conflict:${drvId}`,
                sourceEntity: 'AMBULANCE_DRIVER',
                sourceId: drvId,
                action: 'MANUAL_REVIEW',
                confidence: 'AMBIGUOUS',
                status: 'MANUAL_REVIEW',
                requiresManualReview: true,
                mappingRule: 'RULE_4_DRIVER_PROVIDER_INHERITANCE',
                reason: `Driver belongs to provider organization '${parentProvider.orgId}' but already has a membership with status '${existingMembershipInOrg.status}' and role '${existingMembershipInOrg.role}'. Proposing CREATE_MEMBERSHIP would violate unique compound index. Manual review required.`,
                ...(identifier ? { identifier } : {}),
              });
            } else {
              driverCounts.plannedInherits!++;
              driverCounts.plannedMemberships!++;
              const proposedMemId = generateDeterministicId(`mem:${parentProvider.orgId}:AMBULANCE_DRIVER:${drvId}`);
              addEntry({
                migrationVersion,
                idempotencyKey: `drv:create-mem:${drvId}`,
                sourceEntity: 'AMBULANCE_DRIVER',
                sourceId: drvId,
                action: 'CREATE_MEMBERSHIP',
                proposedOrganizationId: parentProvider.orgId,
                proposedOrganizationType: 'AMBULANCE_OPERATOR',
                proposedMembershipId: proposedMemId,
                proposedMembershipRole: 'DRIVER',
                confidence: 'DETERMINISTIC',
                status: 'PLANNED',
                requiresManualReview: false,
                mappingRule: 'RULE_4_DRIVER_PROVIDER_INHERITANCE',
                reason: `Driver inherits organization '${parentProvider.orgId}' from parent provider '${d.providerId}'. Propose DRIVER membership.`,
                ...(identifier ? { identifier } : {}),
              });
            }
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // PHASE E: Preserve Citizen Emergency Requests (Rule 8 & 9)
  // -------------------------------------------------------------
  const citizenEmergenciesCount = await EmergencyRequestModel.countDocuments();

  // -------------------------------------------------------------
  // Summary calculations
  // -------------------------------------------------------------
  const proposedOrgCreates = ledger.filter((e) => e.action === 'CREATE_ORGANIZATION').length;
  const proposedMemCreates = ledger.filter((e) => e.action === 'CREATE_MEMBERSHIP').length;
  const proposedUpdates = ledger.filter((e) => e.action === 'UPDATE_ENTITY_ORGANIZATION').length;
  const proposedInherits = ledger.filter((e) => e.action === 'INHERIT_PROVIDER_ORGANIZATION').length;
  const skips = ledger.filter((e) => e.action === 'SKIP_ALREADY_CONFIGURED').length;
  const manualReviewEntries = ledger.filter((e) => e.requiresManualReview);

  const summary: BackfillPlanSummary = {
    totalEntitiesScanned,
    proposedOrganizationCreates: proposedOrgCreates,
    proposedMembershipCreates: proposedMemCreates,
    proposedEntityUpdates: proposedUpdates,
    proposedInheritances: proposedInherits,
    alreadyConfiguredSkips: skips,
    recordsRequiringManualReview: manualReviewEntries.length,
  };

  const rollbackSpecification: RollbackSpecification = {
    strategy: 'IDEMPOTENT_LEDGER_REVERSAL',
    reversalInstructions: [
      '1. Distinguish migrated entities: Only records created or modified by this migration (tracked by migrationVersion DATA-01C-V1 and ledger idempotency keys) may be modified or deleted.',
      '2. Revert Entity Updates: Clear organizationId on Hospital and AmbulanceProvider records where idempotencyKey matches hosp:set-org-ref:* or prov:set-org-ref:*.',
      '3. Delete Created Memberships: Delete OrganizationMembership records matching proposedMembershipId created in Phase A, B, or D.',
      '4. Delete Created Organizations: Delete Organization records matching proposedOrganizationId created in Phase A or B.',
      '5. SAFETY INVARIANT: Never delete or mutate pre-existing organizations or memberships that were marked as SKIP_ALREADY_CONFIGURED or existed prior to migration.',
    ],
    databaseRequirements:
      'Multi-document ACID transactions require a MongoDB replica set or mongos cluster (MongoDB 4.0+). In standalone environments, two-phase compensating rollback using the migration ledger must be used.',
    safetyRules: [
      'Never run writes without prior dry-run verification and stakeholder sign-off.',
      'Never overwrite conflicting records automatically.',
      'Citizen emergency requests must retain citizen-owned tenancy.',
    ],
  };

  return {
    timestamp,
    databaseName,
    dryRun: true,
    readOnlyAudit: {
      executionPathAudited: true,
      writeOperationsCalled: 0,
      operationsAudited: [
        'Model.find (keyset-paginated read-only queries with projected fields)',
        'Model.countDocuments (read-only count for emergency preservation check)',
      ],
      limitations:
        'Application-level code path verification guarantees that no Mongoose write APIs (save, create, insert, update, delete, bulkWrite) are called during dry-run planning. Database-level enforcement requires a user with "read" role.',
      databaseLevelEnforcementRecommendation:
        'Run planner using a dedicated MongoDB user configured with the least-privilege "read" role: db.createUser({ user: "resq_readonly", pwd: "<password>", roles: [{ role: "read", db: "resq" }] })',
      memoryComplexity:
        'Documented Complexity: Query working memory per batch is O(batchSize). Cumulative in-memory ledger is O(M) and provider mapping is O(P), where M <= maxLedgerEntries (default 100,000) and P <= maxEntities (default 100,000). Total memory is strictly bounded by explicit configuration limits and enforced via PlannerThresholdExceededError and PlannerLedgerLimitExceededError.',
    },
    configuration: {
      batchSize,
      maxEntities,
      maxLedgerEntries,
      includeDetailedIdentifiers,
      migrationVersion,
    },
    summary,
    countsByEntity: {
      hospitals: hospitalCounts,
      providers: providerCounts,
      ambulances: ambulanceCounts,
      drivers: driverCounts,
      citizenEmergenciesPreserved: citizenEmergenciesCount,
    },
    ledger,
    manualReviewRecords: manualReviewEntries,
    rollbackSpecification,
  };
};

export const printPlanSummary = (plan: BackfillPlanReport): void => {
  console.log('\n================================================================');
  console.log('    ResQ 2.0 — DATA-01C Organization Backfill Migration Plan    ');
  console.log('                       [DRY-RUN ONLY]                           ');
  console.log('================================================================');
  console.log(`Timestamp:         ${plan.timestamp}`);
  console.log(`Database:          ${plan.databaseName}`);
  console.log(`Migration Version: ${plan.configuration.migrationVersion}`);
  console.log('----------------------------------------------------------------\n');

  console.log('--- [1. MIGRATION PLAN SUMMARY] ---');
  console.log(`Total Entities Scanned:             ${plan.summary.totalEntitiesScanned}`);
  console.log(`Proposed Organization Creates:      ${plan.summary.proposedOrganizationCreates}`);
  console.log(`Proposed Membership Creates:        ${plan.summary.proposedMembershipCreates}`);
  console.log(`Proposed Entity Updates:            ${plan.summary.proposedEntityUpdates}`);
  console.log(`Proposed Resource Inheritances:     ${plan.summary.proposedInheritances}`);
  console.log(`Already-Configured Skips:           ${plan.summary.alreadyConfiguredSkips}`);
  console.log(`Records Requiring Manual Review:    ${plan.summary.recordsRequiringManualReview}`);
  console.log(`Citizen Emergency Requests Safe:    ${plan.countsByEntity.citizenEmergenciesPreserved} (ownership strictly preserved)`);

  console.log('\n--- [2. ENTITY BREAKDOWN] ---');
  console.log(`Hospitals:           ${plan.countsByEntity.hospitals.total} scanned (${plan.countsByEntity.hospitals.plannedCreates} creates, ${plan.countsByEntity.hospitals.plannedUpdates} updates, ${plan.countsByEntity.hospitals.skips} skips, ${plan.countsByEntity.hospitals.manualReview} review)`);
  console.log(`Ambulance Providers: ${plan.countsByEntity.providers.total} scanned (${plan.countsByEntity.providers.plannedCreates} creates, ${plan.countsByEntity.providers.plannedUpdates} updates, ${plan.countsByEntity.providers.skips} skips, ${plan.countsByEntity.providers.manualReview} review)`);
  console.log(`Ambulances:          ${plan.countsByEntity.ambulances.total} scanned (${plan.countsByEntity.ambulances.plannedInherits} inherits, ${plan.countsByEntity.ambulances.manualReview} review)`);
  console.log(`Ambulance Drivers:   ${plan.countsByEntity.drivers.total} scanned (${plan.countsByEntity.drivers.plannedMemberships} memberships, ${plan.countsByEntity.drivers.skips} skips, ${plan.countsByEntity.drivers.manualReview} review)`);

  if (plan.manualReviewRecords.length > 0) {
    console.log('\n--- [3. CONFLICTS & MANUAL REVIEW RECORDS] ---');
    for (const rec of plan.manualReviewRecords.slice(0, 10)) {
      console.log(`  [${rec.confidence}] ${rec.sourceEntity} (${rec.sourceId}): ${rec.reason}`);
    }
    if (plan.manualReviewRecords.length > 10) {
      console.log(`  ... and ${plan.manualReviewRecords.length - 10} more records requiring manual review.`);
    }
  }

  console.log('\n================================================================');
  console.log('>>> DRY-RUN ONLY: ZERO WRITES PERFORMED (0 write operations called) <<<');
  console.log('Rollback Strategy: IDEMPOTENT_LEDGER_REVERSAL documented.');
  console.log('================================================================\n');
};

export const savePlanToFile = (plan: BackfillPlanReport, outputPath?: string): string => {
  const defaultPath = path.resolve(process.cwd(), 'reports', 'organization-backfill-plan.json');
  const rawPath = outputPath || process.env.ORGANIZATION_BACKFILL_PLAN_PATH || defaultPath;

  // Prevent null-byte injection
  if (rawPath.includes('\0')) {
    throw new Error('Invalid output path: contains null byte');
  }

  const resolvedPath = path.resolve(rawPath);

  // Security check: Refuse to write to symbolic links
  if (fs.existsSync(resolvedPath)) {
    const stat = fs.lstatSync(resolvedPath);
    if (stat.isSymbolicLink()) {
      throw new Error(`Refusing to write to symlink target: '${resolvedPath}'`);
    }
  }

  // Ensure no directory component in path is a symlink
  let currentDir = path.dirname(resolvedPath);
  while (currentDir && currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(currentDir)) {
      const dirStat = fs.lstatSync(currentDir);
      if (dirStat.isSymbolicLink()) {
        throw new Error(`Refusing to write through symlink directory: '${currentDir}'`);
      }
    }
    currentDir = path.dirname(currentDir);
  }

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  // Write through a secure temporary file with restrictive permissions (0o600)
  const tempPath = path.join(dir, `.tmp-plan-${process.pid}-${crypto.randomBytes(8).toString('hex')}.json`);
  let fd: number | null = null;

  try {
    // Open exclusively with O_CREAT | O_EXCL to prevent symlink and race conditions
    fd = fs.openSync(tempPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY, 0o600);
    fs.writeFileSync(fd, JSON.stringify(plan, null, 2), { encoding: 'utf-8' });
    fs.closeSync(fd);
    fd = null;

    // Fail-closed permission enforcement
    fs.chmodSync(tempPath, 0o600);
    const tempStat = fs.statSync(tempPath);
    const tempMode = tempStat.mode & 0o777;
    if (process.platform !== 'win32' && tempMode !== 0o600) {
      throw new Error(`Failed to enforce restrictive 0o600 permissions on temporary plan file; got 0o${tempMode.toString(8)}. Failing closed.`);
    }

    // Atomically finalize report via rename
    fs.renameSync(tempPath, resolvedPath);

    // Fail-closed enforcement on target file
    fs.chmodSync(resolvedPath, 0o600);
    const finalStat = fs.statSync(resolvedPath);
    const finalMode = finalStat.mode & 0o777;
    if (process.platform !== 'win32' && finalMode !== 0o600) {
      throw new Error(`Failed to enforce restrictive 0o600 permissions on finalized plan file; got 0o${finalMode.toString(8)}. Failing closed.`);
    }

    return resolvedPath;
  } catch (err) {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // ignore
      }
    }
    // Clean up partial temp file on failure
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // ignore
      }
    }
    throw err;
  }
};

const isMainModule = (): boolean => {
  if (!process.argv[1]) return false;
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    return path.resolve(process.argv[1]) === path.resolve(currentFilePath);
  } catch {
    return false;
  }
};

export const execute = async (): Promise<void> => {
  let cliConfig: ParsedCliConfig;
  try {
    cliConfig = parseCliOptions(process.argv.slice(2));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n[CONFIGURATION ERROR] ${msg}\n`);
    process.exitCode = 1;
    return;
  }

  const { batchSize, maxEntities, maxLedgerEntries, outputPath, isJson, includeDetailedIdentifiers } = cliConfig;
  const sanitizedUri = sanitizeMongoUri(env.MONGODB_URI);

  if (!isJson) {
    console.log(`Connecting to database (${sanitizedUri})...`);
  }

  try {
    await connectDatabase();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? sanitizeMongoUri(err.message) : 'Unknown connection error';
    if (isJson) {
      console.error(JSON.stringify({ error: 'DATABASE_CONNECTION_ERROR', details: errorMsg }));
    } else {
      console.error('\n[DATABASE CONNECTION ERROR]');
      console.error(`Could not connect to MongoDB at: ${sanitizedUri}`);
      console.error(`Details: ${errorMsg}\n`);
    }
    process.exitCode = 1;
    return;
  }

  try {
    const plan = await planOrganizationBackfill({
      batchSize,
      maxEntities,
      maxLedgerEntries,
      includeDetailedIdentifiers,
    });
    const savedPath = savePlanToFile(plan, outputPath);

    if (isJson) {
      console.log(JSON.stringify(plan, null, 2));
    } else {
      printPlanSummary(plan);
      console.log(`Migration plan saved to: ${savedPath}\n`);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? sanitizeMongoUri(err.message) : 'Unknown planner execution error';
    if (isJson) {
      console.error(JSON.stringify({ error: 'PLANNER_EXECUTION_ERROR', details: errorMsg }));
    } else {
      console.error(`\n[PLANNER EXECUTION ERROR] Failed to generate organization backfill plan: ${errorMsg}\n`);
    }
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

if (isMainModule()) {
  void execute();
}
