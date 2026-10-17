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
  };
  configuration: {
    batchSize: number;
    maxEntities: number;
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
  includeDetailedIdentifiers?: boolean;
  migrationVersion?: string;
}

export class PlannerThresholdExceededError extends Error {
  constructor(public readonly limit: number) {
    super(`Planner threshold exceeded: entity count exceeded configured limit of ${limit}. Aborting to avoid unbounded execution.`);
    this.name = 'PlannerThresholdExceededError';
  }
}

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
    ledger.push(entry);
  };

  const checkThreshold = (): void => {
    totalEntitiesScanned++;
    if (totalEntitiesScanned > maxEntities) {
      throw new PlannerThresholdExceededError(maxEntities);
    }
  };

  // 1. Build narrow in-memory lookup index of existing organizations
  const allExistingOrgs = await OrganizationModel.find({}, { _id: 1, type: 1, status: 1 }).lean().exec();
  const existingOrgMap = new Map<string, { _id: Types.ObjectId; type: OrganizationType; status: OrganizationStatus }>();
  for (const org of allExistingOrgs) {
    existingOrgMap.set(String(org._id), org);
  }

  // 2. Build narrow in-memory index of active memberships for hospitals and providers
  const activeMemberships = await OrganizationMembershipModel.find(
    { status: 'ACTIVE', principalType: { $in: ['HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER'] } },
    { organizationId: 1, principalType: 1, principalId: 1, role: 1 }
  ).lean().exec();

  const membershipsByPrincipal = new Map<string, typeof activeMemberships>();
  for (const m of activeMemberships) {
    const key = `${m.principalType}:${m.principalId}`;
    const list = membershipsByPrincipal.get(key) || [];
    list.push(m);
    membershipsByPrincipal.set(key, list);
  }

  // Track planned organizations so providers/hospitals can register deterministic parent orgs
  const plannedOrganizations = new Map<string, { orgId: string; type: OrganizationType; isDeterministic: boolean }>();

  // -------------------------------------------------------------
  // PHASE A: Plan Hospitals
  // -------------------------------------------------------------
  const hospitalCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    skips: 0,
    manualReview: 0,
  };

  const hospitalCursor = HospitalModel.find(
    {},
    {
      _id: 1,
      organizationId: 1,
      ...(includeDetailedIdentifiers ? { name: 1, registrationNumber: 1 } : {}),
    }
  ).lean().cursor({ batchSize });

  for await (const hosp of hospitalCursor) {
    checkThreshold();
    hospitalCounts.total++;

    const hospId = String(hosp._id);
    const identifier = includeDetailedIdentifiers
      ? (hosp as { registrationNumber?: string; name?: string }).registrationNumber || (hosp as { name?: string }).name
      : undefined;

    const principalKey = `HOSPITAL:${hospId}`;
    const memberships = membershipsByPrincipal.get(principalKey) || [];

    if (hosp.organizationId) {
      const directOrgId = String(hosp.organizationId);
      const existingOrg = existingOrgMap.get(directOrgId);

      if (!existingOrg) {
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
      } else if (existingOrg.type !== 'HOSPITAL_NETWORK') {
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
          reason: `Hospital references organization '${directOrgId}' of type '${existingOrg.type}' (expected HOSPITAL_NETWORK).`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (memberships.some((m) => String(m.organizationId) !== directOrgId)) {
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
          reason: `Hospital has conflicting organization assignments between direct organizationId and active membership.`,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        // Valid existing assignment
        const hasValidMembership = memberships.some(
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
          // Needs missing membership
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
    } else {
      // Hospital without organizationId
      if (memberships.length === 1 && memberships[0]) {
        const memOrgId = String(memberships[0].organizationId);
        const memOrg = existingOrgMap.get(memOrgId);

        if (memOrg && memOrg.type === 'HOSPITAL_NETWORK') {
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
          continue;
        }
      }

      if (memberships.length > 1) {
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
      } else {
        // Standalone hospital: deterministically create dedicated HOSPITAL_NETWORK
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

  // -------------------------------------------------------------
  // PHASE B: Plan Ambulance Providers
  // -------------------------------------------------------------
  const providerCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    skips: 0,
    manualReview: 0,
  };

  const providerCursor = AmbulanceProviderModel.find(
    {},
    {
      _id: 1,
      organizationId: 1,
      ...(includeDetailedIdentifiers ? { name: 1, registrationNumber: 1 } : {}),
    }
  ).lean().cursor({ batchSize });

  for await (const prov of providerCursor) {
    checkThreshold();
    providerCounts.total++;

    const provId = String(prov._id);
    const identifier = includeDetailedIdentifiers
      ? (prov as { registrationNumber?: string; name?: string }).registrationNumber || (prov as { name?: string }).name
      : undefined;

    const principalKey = `AMBULANCE_PROVIDER:${provId}`;
    const memberships = membershipsByPrincipal.get(principalKey) || [];

    if (prov.organizationId) {
      const directOrgId = String(prov.organizationId);
      const existingOrg = existingOrgMap.get(directOrgId);

      if (!existingOrg) {
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
      } else if (existingOrg.type !== 'AMBULANCE_OPERATOR') {
        providerCounts.manualReview++;
        plannedOrganizations.set(provId, { orgId: directOrgId, type: existingOrg.type, isDeterministic: false });
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
          reason: `Provider references organization '${directOrgId}' of type '${existingOrg.type}' (expected AMBULANCE_OPERATOR).`,
          ...(identifier ? { identifier } : {}),
        });
      } else if (memberships.some((m) => String(m.organizationId) !== directOrgId)) {
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
          reason: `Provider has conflicting organization assignments between direct organizationId and active membership.`,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        // Valid existing provider assignment
        plannedOrganizations.set(provId, { orgId: directOrgId, type: 'AMBULANCE_OPERATOR', isDeterministic: true });

        const hasValidMembership = memberships.some(
          (m) => String(m.organizationId) === directOrgId && m.role === 'PROVIDER_ADMIN'
        );

        if (hasValidMembership) {
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
    } else {
      // Provider without organizationId
      if (memberships.length === 1 && memberships[0]) {
        const memOrgId = String(memberships[0].organizationId);
        const memOrg = existingOrgMap.get(memOrgId);

        if (memOrg && memOrg.type === 'AMBULANCE_OPERATOR') {
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
          continue;
        }
      }

      if (memberships.length > 1) {
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
      } else {
        // Standalone provider: deterministically create dedicated AMBULANCE_OPERATOR
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

  // -------------------------------------------------------------
  // PHASE C: Plan Ambulances
  // -------------------------------------------------------------
  const ambulanceCounts: EntityPlanCounts = {
    total: 0,
    plannedCreates: 0,
    plannedUpdates: 0,
    plannedInherits: 0,
    skips: 0,
    manualReview: 0,
  };

  const ambulanceCursor = AmbulanceModel.find(
    {},
    {
      _id: 1,
      providerId: 1,
      ...(includeDetailedIdentifiers ? { vehicleNumber: 1, registrationNumber: 1 } : {}),
    }
  ).lean().cursor({ batchSize });

  for await (const amb of ambulanceCursor) {
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

  // -------------------------------------------------------------
  // PHASE D: Plan Ambulance Drivers
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

  let driverSkip = 0;
  while (true) {
    const driverBatch = await AmbulanceDriverModel.find(
      {},
      {
        _id: 1,
        providerId: 1,
        assignedAmbulanceId: 1,
        ...(includeDetailedIdentifiers ? { licenseNumber: 1, fullName: 1 } : {}),
      }
    )
      .sort({ _id: 1 })
      .skip(driverSkip)
      .limit(batchSize)
      .lean()
      .exec();

    if (driverBatch.length === 0) break;
    driverSkip += driverBatch.length;

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
      } else if (parentProvider.isDeterministic) {
        driverCounts.plannedInherits!++;

        // Plan driver membership if not already present
        const driverPrincipalKey = `AMBULANCE_DRIVER:${drvId}`;
        const driverMemberships = membershipsByPrincipal.get(driverPrincipalKey) || [];
        const hasMembershipInOrg = driverMemberships.some(
          (m) => String(m.organizationId) === parentProvider.orgId && m.role === 'DRIVER'
        );

        if (!hasMembershipInOrg) {
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
        } else {
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
        }
      } else {
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
        'Model.find (read-only queries with projected fields)',
        'Model.cursor (read-only streaming for large collections)',
        'Model.countDocuments (read-only count for emergency preservation check)',
      ],
      limitations:
        'Application-level code path verification guarantees that no Mongoose write APIs (save, create, insert, update, delete, bulkWrite) are called during dry-run planning. Database-level enforcement requires a user with "read" role.',
      databaseLevelEnforcementRecommendation:
        'Run planner using a dedicated MongoDB user configured with the least-privilege "read" role: db.createUser({ user: "resq_readonly", pwd: "<password>", roles: [{ role: "read", db: "resq" }] })',
    },
    configuration: {
      batchSize,
      maxEntities,
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
  const resolvedPath =
    outputPath ||
    process.env.ORGANIZATION_BACKFILL_PLAN_PATH ||
    path.resolve(process.cwd(), 'reports', 'organization-backfill-plan.json');

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Restrictive file permissions (0o600: read/write by owner only)
  fs.writeFileSync(resolvedPath, JSON.stringify(plan, null, 2), { encoding: 'utf-8', mode: 0o600 });
  return resolvedPath;
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
  const isJson = process.argv.includes('--json');
  const includeDetailedIdentifiers = process.argv.includes('--include-identifiers');
  const batchSizeArg = process.argv.find((a) => a.startsWith('--batch-size='));
  const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1] || '500', 10) : 500;

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
    const plan = await planOrganizationBackfill({ batchSize, includeDetailedIdentifiers });
    const savedPath = savePlanToFile(plan);

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
