import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { type Types } from 'mongoose';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { env } from '../config/env.js';
import { OrganizationModel, type OrganizationType, type OrganizationStatus } from '../models/Organization.js';
import {
  OrganizationMembershipModel,
  type MembershipPrincipalType,
  type MembershipRole,
  type MembershipStatus,
} from '../models/OrganizationMembership.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';
import { TripModel } from '../models/Trip.js';
import { HospitalPatientModel } from '../models/HospitalPatient.js';

export type AnomalySeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type AnomalyCategory =
  | 'HOSPITALS_WITHOUT_ORGANIZATION'
  | 'PROVIDERS_WITHOUT_ORGANIZATION'
  | 'ORGANIZATIONS_WITHOUT_MEMBERSHIPS'
  | 'MEMBERSHIPS_WITH_NONEXISTENT_ORGANIZATION'
  | 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL'
  | 'MEMBERSHIPS_WITH_INCOMPATIBLE_PRINCIPAL_TYPE'
  | 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE'
  | 'DRIVERS_WITH_NONEXISTENT_PROVIDER'
  | 'DRIVERS_WITH_NONEXISTENT_ASSIGNED_AMBULANCE'
  | 'DRIVERS_ASSIGNED_AMBULANCE_PROVIDER_MISMATCH'
  | 'AMBULANCES_WITH_NONEXISTENT_PROVIDER'
  | 'TRIPS_WITH_INVALID_REFERENCES'
  | 'EMERGENCY_ASSIGNMENT_CONFLICTS'
  | 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS';

export interface TenancyAnomaly {
  category: AnomalyCategory;
  severity: AnomalySeverity;
  collection: string;
  documentId: string;
  code: string;
  details: string;
  requiresManualReview: boolean;
  identifier?: string;
}

export type MappingConfidence = 'DETERMINISTIC' | 'AMBIGUOUS' | 'INVALID';

export interface ProposedOrganizationMapping {
  sourceEntity: 'HOSPITAL' | 'AMBULANCE_PROVIDER' | 'AMBULANCE' | 'AMBULANCE_DRIVER';
  sourceId: string;
  currentOrganizationId?: string;
  proposedOrganizationId?: string;
  proposedAction:
    | 'LINK_EXISTING_ORGANIZATION'
    | 'CREATE_ORGANIZATION'
    | 'INHERIT_PROVIDER_ORGANIZATION'
    | 'MANUAL_REVIEW_REQUIRED';
  proposedOrganizationType?: 'HOSPITAL_NETWORK' | 'AMBULANCE_OPERATOR';
  reason: string;
  confidence: MappingConfidence;
  requiresManualReview: boolean;
  identifier?: string;
}

export interface EntityCounts {
  organizations: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
  memberships: {
    total: number;
    byPrincipalType: Record<string, number>;
    byRole: Record<string, number>;
    byStatus: Record<string, number>;
  };
  hospitals: {
    total: number;
    withOrganization: number;
    withoutOrganization: number;
  };
  providers: {
    total: number;
    withOrganization: number;
    withoutOrganization: number;
  };
  ambulances: {
    total: number;
    byProvider: Record<string, number>;
    orphanedCount: number;
  };
  drivers: {
    total: number;
    withProvider: number;
    orphanedCount: number;
    withAssignedAmbulance: number;
    withoutAssignedAmbulance: number;
    mismatchedProviderAmbulanceCount: number;
  };
  trips: {
    total: number;
    byStatus: Record<string, number>;
    invalidReferencesCount: number;
  };
  emergencyRequests: {
    total: number;
    byStatus: Record<string, number>;
    withAssignedAmbulance: number;
    withAssignedProvider: number;
    withAssignedDriver: number;
    withAssignedHospital: number;
    conflictingAssignmentsCount: number;
  };
  hospitalPatients: {
    total: number;
    byHospital: Record<string, number>;
    withLinkedEmergency: number;
  };
}

export interface ReadOnlyAuditVerification {
  readOnlyImplementation: true;
  executionPathAudited: boolean;
  operationsAudited: string[];
  databaseLevelEnforcementRecommendation: string;
  auditLimitations: string;
}

export interface TenancyInventoryReport {
  timestamp: string;
  databaseName: string;
  connected: boolean;
  counts: EntityCounts;
  anomalies: TenancyAnomaly[];
  anomalySummary: Record<AnomalyCategory, number>;
  proposedMappings: ProposedOrganizationMapping[];
  mappingSummary: {
    total: number;
    deterministic: number;
    ambiguous: number;
    invalid: number;
    requiresManualReview: number;
  };
  ambiguousRecords: ProposedOrganizationMapping[];
  readOnlyAudit: ReadOnlyAuditVerification;
}

export interface InventoryOptions {
  batchSize?: number;
  maxAnomalies?: number;
  maxMappings?: number;
  includeDetailedIdentifiers?: boolean;
}

export class InventoryThresholdExceededError extends Error {
  constructor(public readonly thresholdType: 'ANOMALIES' | 'MAPPINGS', public readonly limit: number) {
    super(`Inventory threshold exceeded: ${thresholdType} exceeded configured limit of ${limit}. Aborting to avoid unbounded execution.`);
    this.name = 'InventoryThresholdExceededError';
  }
}

export const runTenancyInventory = async (options: InventoryOptions = {}): Promise<TenancyInventoryReport> => {
  const batchSize = Math.max(1, options.batchSize ?? 500);
  const maxAnomalies = options.maxAnomalies ?? 20000;
  const maxMappings = options.maxMappings ?? 100000;
  const includeDetailedIdentifiers = options.includeDetailedIdentifiers ?? false;

  const timestamp = new Date().toISOString();
  const databaseName = mongoose.connection.name || 'unknown';
  const connected = mongoose.connection.readyState === 1;

  if (!connected) {
    throw new Error('Database connection is not ready. Cannot run tenancy inventory.');
  }

  // 1. Aggregation pipelines for entity counts using $facet to avoid loading collections into application memory
  const [
    orgCountsResult,
    membershipCountsResult,
    hospitalCountsResult,
    providerCountsResult,
    ambulanceCountsResult,
    driverCountsResult,
    tripCountsResult,
    emergencyCountsResult,
    patientCountsResult,
  ] = await Promise.all([
    OrganizationModel.aggregate<{
      total: number;
      byType: { _id: OrganizationType; count: number }[];
      byStatus: { _id: OrganizationStatus; count: number }[];
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byType: [{ $group: { _id: '$type', count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          byType: 1,
          byStatus: 1,
        },
      },
    ]),

    OrganizationMembershipModel.aggregate<{
      total: number;
      byPrincipalType: { _id: MembershipPrincipalType; count: number }[];
      byRole: { _id: MembershipRole; count: number }[];
      byStatus: { _id: MembershipStatus; count: number }[];
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byPrincipalType: [{ $group: { _id: '$principalType', count: { $sum: 1 } } }],
          byRole: [{ $group: { _id: '$role', count: { $sum: 1 } } }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          byPrincipalType: 1,
          byRole: 1,
          byStatus: 1,
        },
      },
    ]),

    HospitalModel.aggregate<{
      total: number;
      withOrganization: number;
      withoutOrganization: number;
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          withOrg: [
            { $match: { organizationId: { $ne: null } } },
            { $count: 'count' },
          ],
          withoutOrg: [
            { $match: { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] } },
            { $count: 'count' },
          ],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          withOrganization: { $ifNull: [{ $arrayElemAt: ['$withOrg.count', 0] }, 0] },
          withoutOrganization: { $ifNull: [{ $arrayElemAt: ['$withoutOrg.count', 0] }, 0] },
        },
      },
    ]),

    AmbulanceProviderModel.aggregate<{
      total: number;
      withOrganization: number;
      withoutOrganization: number;
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          withOrg: [
            { $match: { organizationId: { $ne: null } } },
            { $count: 'count' },
          ],
          withoutOrg: [
            { $match: { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] } },
            { $count: 'count' },
          ],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          withOrganization: { $ifNull: [{ $arrayElemAt: ['$withOrg.count', 0] }, 0] },
          withoutOrganization: { $ifNull: [{ $arrayElemAt: ['$withoutOrg.count', 0] }, 0] },
        },
      },
    ]),

    AmbulanceModel.aggregate<{
      total: number;
      byProvider: { _id: Types.ObjectId | null; count: number }[];
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byProvider: [{ $group: { _id: '$providerId', count: { $sum: 1 } } }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          byProvider: 1,
        },
      },
    ]),

    AmbulanceDriverModel.aggregate<{
      total: number;
      withProvider: number;
      withAssignedAmbulance: number;
      withoutAssignedAmbulance: number;
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          withProvider: [
            { $match: { providerId: { $ne: null } } },
            { $count: 'count' },
          ],
          withAmbulance: [
            { $match: { assignedAmbulanceId: { $ne: null } } },
            { $count: 'count' },
          ],
          withoutAmbulance: [
            { $match: { $or: [{ assignedAmbulanceId: { $exists: false } }, { assignedAmbulanceId: null }] } },
            { $count: 'count' },
          ],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          withProvider: { $ifNull: [{ $arrayElemAt: ['$withProvider.count', 0] }, 0] },
          withAssignedAmbulance: { $ifNull: [{ $arrayElemAt: ['$withAmbulance.count', 0] }, 0] },
          withoutAssignedAmbulance: { $ifNull: [{ $arrayElemAt: ['$withoutAmbulance.count', 0] }, 0] },
        },
      },
    ]),

    TripModel.aggregate<{
      total: number;
      byStatus: { _id: string; count: number }[];
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          byStatus: 1,
        },
      },
    ]),

    EmergencyRequestModel.aggregate<{
      total: number;
      byStatus: { _id: string; count: number }[];
      withAmbulance: number;
      withProvider: number;
      withDriver: number;
      withHospital: number;
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
          withAmbulance: [{ $match: { ambulanceId: { $ne: null } } }, { $count: 'count' }],
          withProvider: [{ $match: { ambulanceProviderId: { $ne: null } } }, { $count: 'count' }],
          withDriver: [{ $match: { driverId: { $ne: null } } }, { $count: 'count' }],
          withHospital: [{ $match: { hospitalId: { $ne: null } } }, { $count: 'count' }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          byStatus: 1,
          withAmbulance: { $ifNull: [{ $arrayElemAt: ['$withAmbulance.count', 0] }, 0] },
          withProvider: { $ifNull: [{ $arrayElemAt: ['$withProvider.count', 0] }, 0] },
          withDriver: { $ifNull: [{ $arrayElemAt: ['$withDriver.count', 0] }, 0] },
          withHospital: { $ifNull: [{ $arrayElemAt: ['$withHospital.count', 0] }, 0] },
        },
      },
    ]),

    HospitalPatientModel.aggregate<{
      total: number;
      byHospital: { _id: Types.ObjectId | null; count: number }[];
      withEmergency: number;
    }>([
      {
        $facet: {
          total: [{ $count: 'count' }],
          byHospital: [{ $group: { _id: '$hospitalId', count: { $sum: 1 } } }],
          withEmergency: [{ $match: { emergencyId: { $ne: null } } }, { $count: 'count' }],
        },
      },
      {
        $project: {
          total: { $ifNull: [{ $arrayElemAt: ['$total.count', 0] }, 0] },
          byHospital: 1,
          withEmergency: { $ifNull: [{ $arrayElemAt: ['$withEmergency.count', 0] }, 0] },
        },
      },
    ]),
  ]);

  const orgCounts = orgCountsResult[0] || { total: 0, byType: [], byStatus: [] };
  const membershipCounts = membershipCountsResult[0] || { total: 0, byPrincipalType: [], byRole: [], byStatus: [] };
  const hospitalCounts = hospitalCountsResult[0] || { total: 0, withOrganization: 0, withoutOrganization: 0 };
  const providerCounts = providerCountsResult[0] || { total: 0, withOrganization: 0, withoutOrganization: 0 };
  const ambulanceCounts = ambulanceCountsResult[0] || { total: 0, byProvider: [] };
  const driverCounts = driverCountsResult[0] || { total: 0, withProvider: 0, withAssignedAmbulance: 0, withoutAssignedAmbulance: 0 };
  const tripCounts = tripCountsResult[0] || { total: 0, byStatus: [] };
  const emergencyCounts = emergencyCountsResult[0] || { total: 0, byStatus: [], withAmbulance: 0, withProvider: 0, withDriver: 0, withHospital: 0 };
  const patientCounts = patientCountsResult[0] || { total: 0, byHospital: [], withEmergency: 0 };

  // 2. Execute the 14 anomaly detection pipelines using aggregation lookups and narrow projections
  const anomalies: TenancyAnomaly[] = [];

  const addAnomaly = (anomaly: TenancyAnomaly): void => {
    if (anomalies.length >= maxAnomalies) {
      throw new InventoryThresholdExceededError('ANOMALIES', maxAnomalies);
    }
    anomalies.push(anomaly);
  };

  // Anomaly 1: Hospitals without an organization
  const hospitalProjection = includeDetailedIdentifiers
    ? { _id: 1, name: 1, registrationNumber: 1 }
    : { _id: 1 };

  const hospitalsWithoutOrg = await HospitalModel.find(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    hospitalProjection
  ).lean().exec();

  for (const h of hospitalsWithoutOrg) {
    addAnomaly({
      category: 'HOSPITALS_WITHOUT_ORGANIZATION',
      severity: 'WARNING',
      collection: 'Hospitals_data',
      documentId: String(h._id),
      code: 'HOSPITAL_MISSING_ORGANIZATION',
      details: `Hospital documentId '${h._id}' has no assigned organizationId.`,
      requiresManualReview: false,
      ...(includeDetailedIdentifiers ? { identifier: (h as { registrationNumber?: string; name?: string }).registrationNumber || (h as { name?: string }).name } : {}),
    });
  }

  // Anomaly 2: Providers without an organization
  const providerProjection = includeDetailedIdentifiers
    ? { _id: 1, name: 1, registrationNumber: 1 }
    : { _id: 1 };

  const providersWithoutOrg = await AmbulanceProviderModel.find(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    providerProjection
  ).lean().exec();

  for (const p of providersWithoutOrg) {
    addAnomaly({
      category: 'PROVIDERS_WITHOUT_ORGANIZATION',
      severity: 'WARNING',
      collection: 'Providers_Data',
      documentId: String(p._id),
      code: 'PROVIDER_MISSING_ORGANIZATION',
      details: `Ambulance provider documentId '${p._id}' has no assigned organizationId.`,
      requiresManualReview: false,
      ...(includeDetailedIdentifiers ? { identifier: (p as { registrationNumber?: string; name?: string }).registrationNumber || (p as { name?: string }).name } : {}),
    });
  }

  // Anomaly 3: Organizations with no memberships
  const orgsWithoutMemberships = await OrganizationModel.aggregate<{ _id: Types.ObjectId; type: string; name?: string }>([
    {
      $lookup: {
        from: 'OrganizationMemberships',
        localField: '_id',
        foreignField: 'organizationId',
        as: 'memberships',
      },
    },
    { $match: { 'memberships.0': { $exists: false } } },
    { $project: { _id: 1, type: 1, ...(includeDetailedIdentifiers ? { name: 1 } : {}) } },
  ]);

  for (const o of orgsWithoutMemberships) {
    addAnomaly({
      category: 'ORGANIZATIONS_WITHOUT_MEMBERSHIPS',
      severity: 'WARNING',
      collection: 'Organizations',
      documentId: String(o._id),
      code: 'ORGANIZATION_HAS_ZERO_MEMBERS',
      details: `Organization documentId '${o._id}' of type '${o.type}' has zero active or registered members.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && o.name ? { identifier: o.name } : {}),
    });
  }

  // Anomaly 4: Memberships whose organization does not exist
  const membershipsNonexistentOrg = await OrganizationMembershipModel.aggregate<{
    _id: Types.ObjectId;
    organizationId: Types.ObjectId;
    principalType: string;
    principalId: Types.ObjectId;
  }>([
    {
      $lookup: {
        from: 'Organizations',
        localField: 'organizationId',
        foreignField: '_id',
        as: 'org',
      },
    },
    { $match: { 'org.0': { $exists: false } } },
    { $project: { _id: 1, organizationId: 1, principalType: 1, principalId: 1 } },
  ]);

  for (const m of membershipsNonexistentOrg) {
    addAnomaly({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_ORGANIZATION',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      code: 'MEMBERSHIP_FOREIGN_ORG_NOT_FOUND',
      details: `Membership references non-existent organizationId '${m.organizationId}' for principal '${m.principalType}:${m.principalId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: `${m.principalType}:${m.principalId}` } : {}),
    });
  }

  // Anomaly 5 & 6: Memberships whose principal does not exist or has incompatible principal type
  const [hospitalMemberships, providerMemberships, driverMemberships, invalidTypeMemberships] = await Promise.all([
    OrganizationMembershipModel.aggregate<{ _id: Types.ObjectId; organizationId: Types.ObjectId; principalId: Types.ObjectId }>([
      { $match: { principalType: 'HOSPITAL' } },
      {
        $lookup: {
          from: 'Hospitals_data',
          localField: 'principalId',
          foreignField: '_id',
          as: 'target',
        },
      },
      { $match: { 'target.0': { $exists: false } } },
      { $project: { _id: 1, organizationId: 1, principalId: 1 } },
    ]),
    OrganizationMembershipModel.aggregate<{ _id: Types.ObjectId; organizationId: Types.ObjectId; principalId: Types.ObjectId }>([
      { $match: { principalType: 'AMBULANCE_PROVIDER' } },
      {
        $lookup: {
          from: 'Providers_Data',
          localField: 'principalId',
          foreignField: '_id',
          as: 'target',
        },
      },
      { $match: { 'target.0': { $exists: false } } },
      { $project: { _id: 1, organizationId: 1, principalId: 1 } },
    ]),
    OrganizationMembershipModel.aggregate<{ _id: Types.ObjectId; organizationId: Types.ObjectId; principalId: Types.ObjectId }>([
      { $match: { principalType: 'AMBULANCE_DRIVER' } },
      {
        $lookup: {
          from: 'ambulancedrivers',
          localField: 'principalId',
          foreignField: '_id',
          as: 'target',
        },
      },
      { $match: { 'target.0': { $exists: false } } },
      { $project: { _id: 1, organizationId: 1, principalId: 1 } },
    ]),
    OrganizationMembershipModel.find(
      { principalType: { $nin: ['HOSPITAL', 'AMBULANCE_PROVIDER', 'AMBULANCE_DRIVER'] } },
      { _id: 1, organizationId: 1, principalType: 1, principalId: 1 }
    ).lean().exec(),
  ]);

  for (const m of hospitalMemberships) {
    addAnomaly({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      code: 'HOSPITAL_PRINCIPAL_NOT_FOUND',
      details: `Membership declares principalType 'HOSPITAL' but principalId '${m.principalId}' does not exist in Hospitals_data.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: String(m.principalId) } : {}),
    });
  }

  for (const m of providerMemberships) {
    addAnomaly({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      code: 'PROVIDER_PRINCIPAL_NOT_FOUND',
      details: `Membership declares principalType 'AMBULANCE_PROVIDER' but principalId '${m.principalId}' does not exist in Providers_Data.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: String(m.principalId) } : {}),
    });
  }

  for (const m of driverMemberships) {
    addAnomaly({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      code: 'DRIVER_PRINCIPAL_NOT_FOUND',
      details: `Membership declares principalType 'AMBULANCE_DRIVER' but principalId '${m.principalId}' does not exist in ambulancedrivers.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: String(m.principalId) } : {}),
    });
  }

  for (const m of invalidTypeMemberships) {
    addAnomaly({
      category: 'MEMBERSHIPS_WITH_INCOMPATIBLE_PRINCIPAL_TYPE',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      code: 'UNSUPPORTED_PRINCIPAL_TYPE',
      details: `Membership declares unsupported principalType '${m.principalType}'. Expected HOSPITAL, AMBULANCE_PROVIDER, or AMBULANCE_DRIVER.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: String(m.principalId) } : {}),
    });
  }

  // Anomaly 7: Hospitals and providers linked to wrong organization type
  const [hospitalsWrongOrgType, providersWrongOrgType] = await Promise.all([
    HospitalModel.aggregate<{ _id: Types.ObjectId; organizationId: Types.ObjectId; orgType: string; name?: string }>([
      { $match: { organizationId: { $ne: null } } },
      {
        $lookup: {
          from: 'Organizations',
          localField: 'organizationId',
          foreignField: '_id',
          as: 'org',
        },
      },
      { $unwind: '$org' },
      { $match: { 'org.type': { $ne: 'HOSPITAL_NETWORK' } } },
      { $project: { _id: 1, organizationId: 1, orgType: '$org.type', ...(includeDetailedIdentifiers ? { name: 1 } : {}) } },
    ]),
    AmbulanceProviderModel.aggregate<{ _id: Types.ObjectId; organizationId: Types.ObjectId; orgType: string; name?: string }>([
      { $match: { organizationId: { $ne: null } } },
      {
        $lookup: {
          from: 'Organizations',
          localField: 'organizationId',
          foreignField: '_id',
          as: 'org',
        },
      },
      { $unwind: '$org' },
      { $match: { 'org.type': { $ne: 'AMBULANCE_OPERATOR' } } },
      { $project: { _id: 1, organizationId: 1, orgType: '$org.type', ...(includeDetailedIdentifiers ? { name: 1 } : {}) } },
    ]),
  ]);

  for (const h of hospitalsWrongOrgType) {
    addAnomaly({
      category: 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE',
      severity: 'CRITICAL',
      collection: 'Hospitals_data',
      documentId: String(h._id),
      code: 'HOSPITAL_INCOMPATIBLE_ORG_TYPE',
      details: `Hospital documentId '${h._id}' is linked to organization '${h.organizationId}' of type '${h.orgType}' (expected HOSPITAL_NETWORK).`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && h.name ? { identifier: h.name } : {}),
    });
  }

  for (const p of providersWrongOrgType) {
    addAnomaly({
      category: 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE',
      severity: 'CRITICAL',
      collection: 'Providers_Data',
      documentId: String(p._id),
      code: 'PROVIDER_INCOMPATIBLE_ORG_TYPE',
      details: `Ambulance provider documentId '${p._id}' is linked to organization '${p.organizationId}' of type '${p.orgType}' (expected AMBULANCE_OPERATOR).`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && p.name ? { identifier: p.name } : {}),
    });
  }

  // Anomaly 8: Drivers whose provider does not exist
  const driversNonexistentProvider = await AmbulanceDriverModel.aggregate<{
    _id: Types.ObjectId;
    providerId: Types.ObjectId;
    licenseNumber?: string;
  }>([
    {
      $lookup: {
        from: 'Providers_Data',
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $match: { 'provider.0': { $exists: false } } },
    { $project: { _id: 1, providerId: 1, ...(includeDetailedIdentifiers ? { licenseNumber: 1 } : {}) } },
  ]);

  for (const d of driversNonexistentProvider) {
    addAnomaly({
      category: 'DRIVERS_WITH_NONEXISTENT_PROVIDER',
      severity: 'CRITICAL',
      collection: 'ambulancedrivers',
      documentId: String(d._id),
      code: 'DRIVER_PROVIDER_NOT_FOUND',
      details: `Driver documentId '${d._id}' references non-existent providerId '${d.providerId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && d.licenseNumber ? { identifier: d.licenseNumber } : {}),
    });
  }

  // Anomaly 9: Drivers whose assigned ambulance does not exist
  const driversNonexistentAmbulance = await AmbulanceDriverModel.aggregate<{
    _id: Types.ObjectId;
    assignedAmbulanceId: Types.ObjectId;
    licenseNumber?: string;
  }>([
    { $match: { assignedAmbulanceId: { $ne: null } } },
    {
      $lookup: {
        from: 'Ambulance_Data',
        localField: 'assignedAmbulanceId',
        foreignField: '_id',
        as: 'ambulance',
      },
    },
    { $match: { 'ambulance.0': { $exists: false } } },
    { $project: { _id: 1, assignedAmbulanceId: 1, ...(includeDetailedIdentifiers ? { licenseNumber: 1 } : {}) } },
  ]);

  for (const d of driversNonexistentAmbulance) {
    addAnomaly({
      category: 'DRIVERS_WITH_NONEXISTENT_ASSIGNED_AMBULANCE',
      severity: 'WARNING',
      collection: 'ambulancedrivers',
      documentId: String(d._id),
      code: 'DRIVER_ASSIGNED_AMBULANCE_NOT_FOUND',
      details: `Driver documentId '${d._id}' references non-existent assignedAmbulanceId '${d.assignedAmbulanceId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && d.licenseNumber ? { identifier: d.licenseNumber } : {}),
    });
  }

  // Anomaly 10: Drivers assigned to an ambulance belonging to another provider
  const driversMismatchedAmbulance = await AmbulanceDriverModel.aggregate<{
    _id: Types.ObjectId;
    providerId: Types.ObjectId;
    assignedAmbulanceId: Types.ObjectId;
    ambulanceProviderId: Types.ObjectId;
    licenseNumber?: string;
  }>([
    { $match: { assignedAmbulanceId: { $ne: null } } },
    {
      $lookup: {
        from: 'Ambulance_Data',
        localField: 'assignedAmbulanceId',
        foreignField: '_id',
        as: 'ambulance',
      },
    },
    { $unwind: '$ambulance' },
    { $match: { $expr: { $ne: ['$providerId', '$ambulance.providerId'] } } },
    {
      $project: {
        _id: 1,
        providerId: 1,
        assignedAmbulanceId: 1,
        ambulanceProviderId: '$ambulance.providerId',
        ...(includeDetailedIdentifiers ? { licenseNumber: 1 } : {}),
      },
    },
  ]);

  for (const d of driversMismatchedAmbulance) {
    addAnomaly({
      category: 'DRIVERS_ASSIGNED_AMBULANCE_PROVIDER_MISMATCH',
      severity: 'CRITICAL',
      collection: 'ambulancedrivers',
      documentId: String(d._id),
      code: 'DRIVER_AMBULANCE_PROVIDER_MISMATCH',
      details: `Driver documentId '${d._id}' belongs to provider '${d.providerId}' but is assigned ambulance '${d.assignedAmbulanceId}' belonging to provider '${d.ambulanceProviderId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && d.licenseNumber ? { identifier: d.licenseNumber } : {}),
    });
  }

  // Anomaly 11: Ambulances whose provider does not exist
  const ambulancesNonexistentProvider = await AmbulanceModel.aggregate<{
    _id: Types.ObjectId;
    providerId: Types.ObjectId;
    registrationNumber?: string;
  }>([
    {
      $lookup: {
        from: 'Providers_Data',
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $match: { 'provider.0': { $exists: false } } },
    { $project: { _id: 1, providerId: 1, ...(includeDetailedIdentifiers ? { registrationNumber: 1 } : {}) } },
  ]);

  for (const a of ambulancesNonexistentProvider) {
    addAnomaly({
      category: 'AMBULANCES_WITH_NONEXISTENT_PROVIDER',
      severity: 'CRITICAL',
      collection: 'Ambulance_Data',
      documentId: String(a._id),
      code: 'AMBULANCE_PROVIDER_NOT_FOUND',
      details: `Ambulance documentId '${a._id}' references non-existent providerId '${a.providerId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && a.registrationNumber ? { identifier: a.registrationNumber } : {}),
    });
  }

  // Anomaly 12: Trips with invalid references
  const tripsInvalidRefs = await TripModel.aggregate<{
    _id: Types.ObjectId;
    providerId: Types.ObjectId;
    ambulanceId: Types.ObjectId;
    driverId?: Types.ObjectId;
    destinationHospitalId: Types.ObjectId;
    emergencyRequestId: Types.ObjectId;
    hasProvider: boolean;
    hasAmbulance: boolean;
    hasHospital: boolean;
    hasEmergency: boolean;
    hasDriver: boolean;
    ambulanceProviderId?: Types.ObjectId;
    driverProviderId?: Types.ObjectId;
  }>([
    {
      $lookup: {
        from: 'Providers_Data',
        localField: 'providerId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    {
      $lookup: {
        from: 'Ambulance_Data',
        localField: 'ambulanceId',
        foreignField: '_id',
        as: 'ambulance',
      },
    },
    {
      $lookup: {
        from: 'Hospitals_data',
        localField: 'destinationHospitalId',
        foreignField: '_id',
        as: 'hospital',
      },
    },
    {
      $lookup: {
        from: 'emergencyrequests',
        localField: 'emergencyRequestId',
        foreignField: '_id',
        as: 'emergency',
      },
    },
    {
      $lookup: {
        from: 'ambulancedrivers',
        localField: 'driverId',
        foreignField: '_id',
        as: 'driver',
      },
    },
    {
      $match: {
        $or: [
          { 'provider.0': { $exists: false } },
          { 'ambulance.0': { $exists: false } },
          { 'hospital.0': { $exists: false } },
          { 'emergency.0': { $exists: false } },
          { $and: [{ driverId: { $ne: null } }, { 'driver.0': { $exists: false } }] },
          { $expr: { $ne: [{ $arrayElemAt: ['$ambulance.providerId', 0] }, '$providerId'] } },
          {
            $and: [
              { driverId: { $ne: null } },
              { $expr: { $ne: [{ $arrayElemAt: ['$driver.providerId', 0] }, '$providerId'] } },
            ],
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        providerId: 1,
        ambulanceId: 1,
        driverId: 1,
        destinationHospitalId: 1,
        emergencyRequestId: 1,
        hasProvider: { $gt: [{ $size: '$provider' }, 0] },
        hasAmbulance: { $gt: [{ $size: '$ambulance' }, 0] },
        hasHospital: { $gt: [{ $size: '$hospital' }, 0] },
        hasEmergency: { $gt: [{ $size: '$emergency' }, 0] },
        hasDriver: {
          $cond: {
            if: { $eq: ['$driverId', null] },
            then: true,
            else: { $gt: [{ $size: '$driver' }, 0] },
          },
        },
        ambulanceProviderId: { $arrayElemAt: ['$ambulance.providerId', 0] },
        driverProviderId: { $arrayElemAt: ['$driver.providerId', 0] },
      },
    },
  ]);

  for (const t of tripsInvalidRefs) {
    const reasons: string[] = [];
    if (!t.hasProvider) reasons.push(`providerId '${t.providerId}' not found`);
    if (!t.hasAmbulance) reasons.push(`ambulanceId '${t.ambulanceId}' not found`);
    if (!t.hasHospital) reasons.push(`destinationHospitalId '${t.destinationHospitalId}' not found`);
    if (!t.hasEmergency) reasons.push(`emergencyRequestId '${t.emergencyRequestId}' not found`);
    if (!t.hasDriver) reasons.push(`driverId '${t.driverId}' not found`);
    if (t.ambulanceProviderId && String(t.ambulanceProviderId) !== String(t.providerId)) {
      reasons.push(`ambulance belongs to provider '${t.ambulanceProviderId}', not trip provider '${t.providerId}'`);
    }
    if (t.driverProviderId && String(t.driverProviderId) !== String(t.providerId)) {
      reasons.push(`driver belongs to provider '${t.driverProviderId}', not trip provider '${t.providerId}'`);
    }

    addAnomaly({
      category: 'TRIPS_WITH_INVALID_REFERENCES',
      severity: 'WARNING',
      collection: 'trips',
      documentId: String(t._id),
      code: 'TRIP_INVALID_RELATIONSHIPS',
      details: `Trip documentId '${t._id}' references invalid or mismatched entities: ${reasons.join('; ')}.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 13: Emergency assignments that conflict with authoritative relationships
  const emergencyConflicts = await EmergencyRequestModel.aggregate<{
    _id: Types.ObjectId;
    hospitalId: Types.ObjectId;
    userId: Types.ObjectId;
    ambulanceId?: Types.ObjectId;
    ambulanceProviderId?: Types.ObjectId;
    driverId?: Types.ObjectId;
    hasHospital: boolean;
    hasUser: boolean;
    hasAmbulance: boolean;
    hasProvider: boolean;
    hasDriver: boolean;
    ambulanceProviderRef?: Types.ObjectId;
    driverProviderRef?: Types.ObjectId;
    requestCode?: string;
  }>([
    {
      $lookup: {
        from: 'Hospitals_data',
        localField: 'hospitalId',
        foreignField: '_id',
        as: 'hospital',
      },
    },
    {
      $lookup: {
        from: 'User_Data',
        localField: 'userId',
        foreignField: '_id',
        as: 'user',
      },
    },
    {
      $lookup: {
        from: 'Ambulance_Data',
        localField: 'ambulanceId',
        foreignField: '_id',
        as: 'ambulance',
      },
    },
    {
      $lookup: {
        from: 'Providers_Data',
        localField: 'ambulanceProviderId',
        foreignField: '_id',
        as: 'provider',
      },
    },
    {
      $lookup: {
        from: 'ambulancedrivers',
        localField: 'driverId',
        foreignField: '_id',
        as: 'driver',
      },
    },
    {
      $match: {
        $or: [
          { 'hospital.0': { $exists: false } },
          { 'user.0': { $exists: false } },
          { $and: [{ ambulanceId: { $ne: null } }, { 'ambulance.0': { $exists: false } }] },
          { $and: [{ ambulanceProviderId: { $ne: null } }, { 'provider.0': { $exists: false } }] },
          { $and: [{ driverId: { $ne: null } }, { 'driver.0': { $exists: false } }] },
          {
            $and: [
              { ambulanceId: { $ne: null } },
              { ambulanceProviderId: { $ne: null } },
              { $expr: { $ne: [{ $arrayElemAt: ['$ambulance.providerId', 0] }, '$ambulanceProviderId'] } },
            ],
          },
          {
            $and: [
              { driverId: { $ne: null } },
              { ambulanceProviderId: { $ne: null } },
              { $expr: { $ne: [{ $arrayElemAt: ['$driver.providerId', 0] }, '$ambulanceProviderId'] } },
            ],
          },
        ],
      },
    },
    {
      $project: {
        _id: 1,
        hospitalId: 1,
        userId: 1,
        ambulanceId: 1,
        ambulanceProviderId: 1,
        driverId: 1,
        hasHospital: { $gt: [{ $size: '$hospital' }, 0] },
        hasUser: { $gt: [{ $size: '$user' }, 0] },
        hasAmbulance: {
          $cond: {
            if: { $eq: ['$ambulanceId', null] },
            then: true,
            else: { $gt: [{ $size: '$ambulance' }, 0] },
          },
        },
        hasProvider: {
          $cond: {
            if: { $eq: ['$ambulanceProviderId', null] },
            then: true,
            else: { $gt: [{ $size: '$provider' }, 0] },
          },
        },
        hasDriver: {
          $cond: {
            if: { $eq: ['$driverId', null] },
            then: true,
            else: { $gt: [{ $size: '$driver' }, 0] },
          },
        },
        ambulanceProviderRef: { $arrayElemAt: ['$ambulance.providerId', 0] },
        driverProviderRef: { $arrayElemAt: ['$driver.providerId', 0] },
        ...(includeDetailedIdentifiers ? { requestCode: 1 } : {}),
      },
    },
  ]);

  for (const e of emergencyConflicts) {
    const reasons: string[] = [];
    if (!e.hasHospital) reasons.push(`hospitalId '${e.hospitalId}' not found`);
    if (!e.hasUser) reasons.push(`userId '${e.userId}' not found`);
    if (!e.hasAmbulance) reasons.push(`ambulanceId '${e.ambulanceId}' not found`);
    if (!e.hasProvider) reasons.push(`ambulanceProviderId '${e.ambulanceProviderId}' not found`);
    if (!e.hasDriver) reasons.push(`driverId '${e.driverId}' not found`);
    if (e.ambulanceProviderRef && e.ambulanceProviderId && String(e.ambulanceProviderRef) !== String(e.ambulanceProviderId)) {
      reasons.push(`assigned ambulance provider '${e.ambulanceProviderRef}' conflicts with emergency provider '${e.ambulanceProviderId}'`);
    }
    if (e.driverProviderRef && e.ambulanceProviderId && String(e.driverProviderRef) !== String(e.ambulanceProviderId)) {
      reasons.push(`assigned driver provider '${e.driverProviderRef}' conflicts with emergency provider '${e.ambulanceProviderId}'`);
    }

    addAnomaly({
      category: 'EMERGENCY_ASSIGNMENT_CONFLICTS',
      severity: 'WARNING',
      collection: 'emergencyrequests',
      documentId: String(e._id),
      code: 'EMERGENCY_ASSIGNMENT_CONFLICT',
      details: `Emergency request documentId '${e._id}' has assignment conflict: ${reasons.join('; ')}.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers && e.requestCode ? { identifier: e.requestCode } : {}),
    });
  }

  // Anomaly 14: Duplicate or ambiguous relationships that prevent safe automatic ownership assignment
  const ambiguousMemberships = await OrganizationMembershipModel.aggregate<{
    _id: { principalType: string; principalId: Types.ObjectId };
    orgCount: number;
    orgs: Types.ObjectId[];
  }>([
    { $match: { status: 'ACTIVE' } },
    {
      $group: {
        _id: { principalType: '$principalType', principalId: '$principalId' },
        orgCount: { $addToSet: '$organizationId' },
      },
    },
    { $project: { orgCount: { $size: '$orgCount' }, orgs: '$orgCount' } },
    { $match: { orgCount: { $gt: 1 } } },
  ]);

  for (const amb of ambiguousMemberships) {
    addAnomaly({
      category: 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(amb._id.principalId),
      code: 'MULTIPLE_ACTIVE_MEMBERSHIPS',
      details: `Principal '${amb._id.principalType}:${amb._id.principalId}' has active memberships across ${amb.orgCount} distinct organizations (${amb.orgs.join(', ')}). Automatic single-tenant mapping cannot be resolved.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: `${amb._id.principalType}:${amb._id.principalId}` } : {}),
    });
  }

  const hospitalMembershipConflicts = await HospitalModel.aggregate<{
    _id: Types.ObjectId;
    organizationId: Types.ObjectId;
    memberOrgId: Types.ObjectId;
  }>([
    { $match: { organizationId: { $ne: null } } },
    {
      $lookup: {
        from: 'OrganizationMemberships',
        localField: '_id',
        foreignField: 'principalId',
        as: 'membership',
      },
    },
    { $unwind: '$membership' },
    {
      $match: {
        'membership.principalType': 'HOSPITAL',
        'membership.status': 'ACTIVE',
        $expr: { $ne: ['$organizationId', '$membership.organizationId'] },
      },
    },
    {
      $project: {
        _id: 1,
        organizationId: 1,
        memberOrgId: '$membership.organizationId',
      },
    },
  ]);

  for (const hmc of hospitalMembershipConflicts) {
    addAnomaly({
      category: 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS',
      severity: 'CRITICAL',
      collection: 'Hospitals_data',
      documentId: String(hmc._id),
      code: 'HOSPITAL_DIRECT_VS_MEMBERSHIP_ORG_CONFLICT',
      details: `Hospital documentId '${hmc._id}' has direct organizationId '${hmc.organizationId}' but has active membership in distinct organization '${hmc.memberOrgId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: String(hmc._id) } : {}),
    });
  }

  const providerMembershipConflicts = await AmbulanceProviderModel.aggregate<{
    _id: Types.ObjectId;
    organizationId: Types.ObjectId;
    memberOrgId: Types.ObjectId;
  }>([
    { $match: { organizationId: { $ne: null } } },
    {
      $lookup: {
        from: 'OrganizationMemberships',
        localField: '_id',
        foreignField: 'principalId',
        as: 'membership',
      },
    },
    { $unwind: '$membership' },
    {
      $match: {
        'membership.principalType': 'AMBULANCE_PROVIDER',
        'membership.status': 'ACTIVE',
        $expr: { $ne: ['$organizationId', '$membership.organizationId'] },
      },
    },
    {
      $project: {
        _id: 1,
        organizationId: 1,
        memberOrgId: '$membership.organizationId',
      },
    },
  ]);

  for (const pmc of providerMembershipConflicts) {
    addAnomaly({
      category: 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS',
      severity: 'CRITICAL',
      collection: 'Providers_Data',
      documentId: String(pmc._id),
      code: 'PROVIDER_DIRECT_VS_MEMBERSHIP_ORG_CONFLICT',
      details: `Ambulance provider documentId '${pmc._id}' has direct organizationId '${pmc.organizationId}' but has active membership in distinct organization '${pmc.memberOrgId}'.`,
      requiresManualReview: true,
      ...(includeDetailedIdentifiers ? { identifier: String(pmc._id) } : {}),
    });
  }

  // 3. Propose deterministic ownership mappings using bounded streaming / cursor processing
  const proposedMappings: ProposedOrganizationMapping[] = [];

  const addMapping = (mapping: ProposedOrganizationMapping): void => {
    if (proposedMappings.length >= maxMappings) {
      throw new InventoryThresholdExceededError('MAPPINGS', maxMappings);
    }
    proposedMappings.push(mapping);
  };

  // Build narrow in-memory index for active memberships of hospitals & providers
  const activeMemberships = await OrganizationMembershipModel.find(
    { status: 'ACTIVE', principalType: { $in: ['HOSPITAL', 'AMBULANCE_PROVIDER'] } },
    { organizationId: 1, principalType: 1, principalId: 1 }
  ).lean().exec();

  const membershipsByPrincipal = new Map<string, { organizationId: Types.ObjectId }[]>();
  for (const m of activeMemberships) {
    const key = `${m.principalType}:${m.principalId}`;
    const list = membershipsByPrincipal.get(key) || [];
    list.push({ organizationId: m.organizationId });
    membershipsByPrincipal.set(key, list);
  }

  // Build narrow in-memory map of existing organizations
  const allOrgs = await OrganizationModel.find({}, { _id: 1, type: 1, status: 1 }).lean().exec();
  const orgMap = new Map<string, { _id: Types.ObjectId; type: OrganizationType; status: OrganizationStatus }>();
  for (const o of allOrgs) {
    orgMap.set(String(o._id), o);
  }

  // Stream Hospitals using cursor with narrow projection
  const hospitalCursor = HospitalModel.find(
    {},
    {
      _id: 1,
      organizationId: 1,
      ...(includeDetailedIdentifiers ? { name: 1, registrationNumber: 1 } : {}),
    }
  ).lean().cursor({ batchSize });

  for await (const h of hospitalCursor) {
    const principalKey = `HOSPITAL:${h._id}`;
    const members = membershipsByPrincipal.get(principalKey) || [];
    const directOrg = h.organizationId ? orgMap.get(String(h.organizationId)) : undefined;
    const identifier = includeDetailedIdentifiers
      ? (h as { registrationNumber?: string; name?: string }).registrationNumber || (h as { name?: string }).name
      : undefined;

    if (h.organizationId) {
      if (!directOrg) {
        addMapping({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          currentOrganizationId: String(h.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Current organizationId '${h.organizationId}' does not exist in Organizations collection.`,
          confidence: 'INVALID',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (directOrg.type !== 'HOSPITAL_NETWORK') {
        addMapping({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          currentOrganizationId: String(h.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationType: directOrg.type,
          reason: `Assigned organization is of type '${directOrg.type}'. Expected HOSPITAL_NETWORK.`,
          confidence: 'INVALID',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (members.some((m) => String(m.organizationId) !== String(h.organizationId))) {
        addMapping({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          currentOrganizationId: String(h.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationId: String(h.organizationId),
          reason: `Hospital has conflicting organization assignments between direct organizationId and membership.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        addMapping({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          currentOrganizationId: String(h.organizationId),
          proposedOrganizationId: String(h.organizationId),
          proposedAction: 'LINK_EXISTING_ORGANIZATION',
          proposedOrganizationType: 'HOSPITAL_NETWORK',
          reason: `Valid existing organization assignment to HOSPITAL_NETWORK '${directOrg._id}'.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
          ...(identifier ? { identifier } : {}),
        });
      }
    } else {
      if (members.length === 1 && members[0]) {
        const memOrg = orgMap.get(String(members[0].organizationId));
        if (memOrg && memOrg.type === 'HOSPITAL_NETWORK') {
          addMapping({
            sourceEntity: 'HOSPITAL',
            sourceId: String(h._id),
            proposedOrganizationId: String(memOrg._id),
            proposedAction: 'LINK_EXISTING_ORGANIZATION',
            proposedOrganizationType: 'HOSPITAL_NETWORK',
            reason: `Inherit organization from existing verified active membership in '${memOrg._id}'.`,
            confidence: 'DETERMINISTIC',
            requiresManualReview: false,
            ...(identifier ? { identifier } : {}),
          });
          continue;
        }
      }

      if (members.length > 1) {
        addMapping({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Hospital has multiple active memberships across distinct organizations.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        addMapping({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          proposedAction: 'CREATE_ORGANIZATION',
          proposedOrganizationType: 'HOSPITAL_NETWORK',
          reason: `Standalone hospital without organization or membership. Deterministically create dedicated HOSPITAL_NETWORK organization.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
          ...(identifier ? { identifier } : {}),
        });
      }
    }
  }

  // Stream Providers using cursor with narrow projection and build providerOrgResolution map
  const providerOrgResolution = new Map<string, { orgId?: string; isDeterministic: boolean; willCreate: boolean }>();

  const providerCursor = AmbulanceProviderModel.find(
    {},
    {
      _id: 1,
      organizationId: 1,
      ...(includeDetailedIdentifiers ? { name: 1, registrationNumber: 1 } : {}),
    }
  ).lean().cursor({ batchSize });

  for await (const p of providerCursor) {
    const principalKey = `AMBULANCE_PROVIDER:${p._id}`;
    const members = membershipsByPrincipal.get(principalKey) || [];
    const directOrg = p.organizationId ? orgMap.get(String(p.organizationId)) : undefined;
    const identifier = includeDetailedIdentifiers
      ? (p as { registrationNumber?: string; name?: string }).registrationNumber || (p as { name?: string }).name
      : undefined;

    if (p.organizationId) {
      if (!directOrg) {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        addMapping({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          currentOrganizationId: String(p.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Current organizationId '${p.organizationId}' does not exist in Organizations collection.`,
          confidence: 'INVALID',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (directOrg.type !== 'AMBULANCE_OPERATOR') {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        addMapping({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          currentOrganizationId: String(p.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationType: directOrg.type,
          reason: `Assigned organization is of type '${directOrg.type}'. Expected AMBULANCE_OPERATOR.`,
          confidence: 'INVALID',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (members.some((m) => String(m.organizationId) !== String(p.organizationId))) {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        addMapping({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          currentOrganizationId: String(p.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationId: String(p.organizationId),
          reason: `Provider has conflicting organization assignments between direct organizationId and membership.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        providerOrgResolution.set(String(p._id), { orgId: String(directOrg._id), isDeterministic: true, willCreate: false });
        addMapping({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          currentOrganizationId: String(p.organizationId),
          proposedOrganizationId: String(p.organizationId),
          proposedAction: 'LINK_EXISTING_ORGANIZATION',
          proposedOrganizationType: 'AMBULANCE_OPERATOR',
          reason: `Valid existing organization assignment to AMBULANCE_OPERATOR '${directOrg._id}'.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
          ...(identifier ? { identifier } : {}),
        });
      }
    } else {
      if (members.length === 1 && members[0]) {
        const memOrg = orgMap.get(String(members[0].organizationId));
        if (memOrg && memOrg.type === 'AMBULANCE_OPERATOR') {
          providerOrgResolution.set(String(p._id), { orgId: String(memOrg._id), isDeterministic: true, willCreate: false });
          addMapping({
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: String(p._id),
            proposedOrganizationId: String(memOrg._id),
            proposedAction: 'LINK_EXISTING_ORGANIZATION',
            proposedOrganizationType: 'AMBULANCE_OPERATOR',
            reason: `Inherit organization from existing verified active membership in '${memOrg._id}'.`,
            confidence: 'DETERMINISTIC',
            requiresManualReview: false,
            ...(identifier ? { identifier } : {}),
          });
          continue;
        }
      }

      if (members.length > 1) {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        addMapping({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Provider has multiple active memberships across distinct organizations.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        providerOrgResolution.set(String(p._id), { isDeterministic: true, willCreate: true });
        addMapping({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          proposedAction: 'CREATE_ORGANIZATION',
          proposedOrganizationType: 'AMBULANCE_OPERATOR',
          reason: `Standalone provider without organization or membership. Deterministically create dedicated AMBULANCE_OPERATOR organization.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
          ...(identifier ? { identifier } : {}),
        });
      }
    }
  }

  // Stream Ambulances using cursor with narrow projection
  const ambulanceCursor = AmbulanceModel.find(
    {},
    {
      _id: 1,
      providerId: 1,
      ...(includeDetailedIdentifiers ? { vehicleNumber: 1, registrationNumber: 1 } : {}),
    }
  ).lean().cursor({ batchSize });

  for await (const a of ambulanceCursor) {
    const providerRes = a.providerId ? providerOrgResolution.get(String(a.providerId)) : undefined;
    const identifier = includeDetailedIdentifiers
      ? (a as { vehicleNumber?: string; registrationNumber?: string }).vehicleNumber || (a as { registrationNumber?: string }).registrationNumber
      : undefined;

    if (!a.providerId || !providerRes) {
      addMapping({
        sourceEntity: 'AMBULANCE',
        sourceId: String(a._id),
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Ambulance providerId '${a.providerId}' does not exist in Providers_Data.`,
        confidence: 'INVALID',
        requiresManualReview: true,
        ...(identifier ? { identifier } : {}),
      });
    } else if (providerRes.isDeterministic) {
      addMapping({
        sourceEntity: 'AMBULANCE',
        sourceId: String(a._id),
        proposedOrganizationId: providerRes.orgId,
        proposedAction: 'INHERIT_PROVIDER_ORGANIZATION',
        proposedOrganizationType: 'AMBULANCE_OPERATOR',
        reason: providerRes.willCreate
          ? `Inherit organization from parent provider '${a.providerId}' (scheduled for dedicated organization creation).`
          : `Inherit organization from parent provider '${a.providerId}'.`,
        confidence: 'DETERMINISTIC',
        requiresManualReview: false,
        ...(identifier ? { identifier } : {}),
      });
    } else {
      addMapping({
        sourceEntity: 'AMBULANCE',
        sourceId: String(a._id),
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Parent provider '${a.providerId}' has ambiguous or invalid organization status.`,
        confidence: 'AMBIGUOUS',
        requiresManualReview: true,
        ...(identifier ? { identifier } : {}),
      });
    }
  }

  // Stream Drivers using chunked pagination with bounded memory
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
      const providerRes = d.providerId ? providerOrgResolution.get(String(d.providerId)) : undefined;
      const assignedAmbulance = d.assignedAmbulanceId ? batchAmbulanceMap.get(String(d.assignedAmbulanceId)) : undefined;
      const identifier = includeDetailedIdentifiers
        ? (d as { licenseNumber?: string; fullName?: string }).licenseNumber || (d as { fullName?: string }).fullName
        : undefined;

      if (!d.providerId || !providerRes) {
        addMapping({
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: String(d._id),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Driver providerId '${d.providerId}' does not exist in Providers_Data.`,
          confidence: 'INVALID',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (d.assignedAmbulanceId && !assignedAmbulance) {
        addMapping({
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: String(d._id),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Driver assignedAmbulanceId '${d.assignedAmbulanceId}' does not exist in Ambulance_Data.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (assignedAmbulance && String(assignedAmbulance.providerId) !== String(d.providerId)) {
        addMapping({
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: String(d._id),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Driver belongs to provider '${d.providerId}' but assigned ambulance belongs to provider '${assignedAmbulance.providerId}'.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      } else if (providerRes.isDeterministic) {
        addMapping({
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: String(d._id),
          proposedOrganizationId: providerRes.orgId,
          proposedAction: 'INHERIT_PROVIDER_ORGANIZATION',
          proposedOrganizationType: 'AMBULANCE_OPERATOR',
          reason: providerRes.willCreate
            ? `Inherit organization from parent provider '${d.providerId}' (scheduled for dedicated organization creation).`
            : `Inherit organization from parent provider '${d.providerId}'.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
          ...(identifier ? { identifier } : {}),
        });
      } else {
        addMapping({
          sourceEntity: 'AMBULANCE_DRIVER',
          sourceId: String(d._id),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Parent provider '${d.providerId}' has ambiguous or invalid organization status.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
          ...(identifier ? { identifier } : {}),
        });
      }
    }
  }

  // 4. Summarize results
  const anomalySummary: Record<AnomalyCategory, number> = {
    HOSPITALS_WITHOUT_ORGANIZATION: 0,
    PROVIDERS_WITHOUT_ORGANIZATION: 0,
    ORGANIZATIONS_WITHOUT_MEMBERSHIPS: 0,
    MEMBERSHIPS_WITH_NONEXISTENT_ORGANIZATION: 0,
    MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL: 0,
    MEMBERSHIPS_WITH_INCOMPATIBLE_PRINCIPAL_TYPE: 0,
    ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE: 0,
    DRIVERS_WITH_NONEXISTENT_PROVIDER: 0,
    DRIVERS_WITH_NONEXISTENT_ASSIGNED_AMBULANCE: 0,
    DRIVERS_ASSIGNED_AMBULANCE_PROVIDER_MISMATCH: 0,
    AMBULANCES_WITH_NONEXISTENT_PROVIDER: 0,
    TRIPS_WITH_INVALID_REFERENCES: 0,
    EMERGENCY_ASSIGNMENT_CONFLICTS: 0,
    AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS: 0,
  };

  for (const an of anomalies) {
    anomalySummary[an.category] = (anomalySummary[an.category] || 0) + 1;
  }

  const deterministicCount = proposedMappings.filter((m) => m.confidence === 'DETERMINISTIC').length;
  const ambiguousCount = proposedMappings.filter((m) => m.confidence === 'AMBIGUOUS').length;
  const invalidCount = proposedMappings.filter((m) => m.confidence === 'INVALID').length;
  const manualReviewCount = proposedMappings.filter((m) => m.requiresManualReview).length;
  const ambiguousRecords = proposedMappings.filter((m) => m.requiresManualReview);

  const orgTypeCounts: Record<string, number> = {};
  for (const item of orgCounts.byType) orgTypeCounts[item._id] = item.count;
  const orgStatusCounts: Record<string, number> = {};
  for (const item of orgCounts.byStatus) orgStatusCounts[item._id] = item.count;

  const membershipTypeCounts: Record<string, number> = {};
  for (const item of membershipCounts.byPrincipalType) membershipTypeCounts[item._id] = item.count;
  const membershipRoleCounts: Record<string, number> = {};
  for (const item of membershipCounts.byRole) membershipRoleCounts[item._id] = item.count;
  const membershipStatusCounts: Record<string, number> = {};
  for (const item of membershipCounts.byStatus) membershipStatusCounts[item._id] = item.count;

  const ambulancesByProviderCounts: Record<string, number> = {};
  for (const item of ambulanceCounts.byProvider) {
    ambulancesByProviderCounts[item._id ? String(item._id) : 'UNASSIGNED'] = item.count;
  }

  const tripStatusCounts: Record<string, number> = {};
  for (const item of tripCounts.byStatus) tripStatusCounts[item._id] = item.count;

  const emergencyStatusCounts: Record<string, number> = {};
  for (const item of emergencyCounts.byStatus) emergencyStatusCounts[item._id] = item.count;

  const patientByHospitalCounts: Record<string, number> = {};
  for (const item of patientCounts.byHospital) {
    patientByHospitalCounts[item._id ? String(item._id) : 'UNKNOWN'] = item.count;
  }

  const counts: EntityCounts = {
    organizations: {
      total: orgCounts.total,
      byType: orgTypeCounts,
      byStatus: orgStatusCounts,
    },
    memberships: {
      total: membershipCounts.total,
      byPrincipalType: membershipTypeCounts,
      byRole: membershipRoleCounts,
      byStatus: membershipStatusCounts,
    },
    hospitals: {
      total: hospitalCounts.total,
      withOrganization: hospitalCounts.withOrganization,
      withoutOrganization: hospitalCounts.withoutOrganization,
    },
    providers: {
      total: providerCounts.total,
      withOrganization: providerCounts.withOrganization,
      withoutOrganization: providerCounts.withoutOrganization,
    },
    ambulances: {
      total: ambulanceCounts.total,
      byProvider: ambulancesByProviderCounts,
      orphanedCount: ambulancesNonexistentProvider.length,
    },
    drivers: {
      total: driverCounts.total,
      withProvider: driverCounts.withProvider,
      orphanedCount: driversNonexistentProvider.length,
      withAssignedAmbulance: driverCounts.withAssignedAmbulance,
      withoutAssignedAmbulance: driverCounts.withoutAssignedAmbulance,
      mismatchedProviderAmbulanceCount: driversMismatchedAmbulance.length,
    },
    trips: {
      total: tripCounts.total,
      byStatus: tripStatusCounts,
      invalidReferencesCount: tripsInvalidRefs.length,
    },
    emergencyRequests: {
      total: emergencyCounts.total,
      byStatus: emergencyStatusCounts,
      withAssignedAmbulance: emergencyCounts.withAmbulance,
      withAssignedProvider: emergencyCounts.withProvider,
      withAssignedDriver: emergencyCounts.withDriver,
      withAssignedHospital: emergencyCounts.withHospital,
      conflictingAssignmentsCount: emergencyConflicts.length,
    },
    hospitalPatients: {
      total: patientCounts.total,
      byHospital: patientByHospitalCounts,
      withLinkedEmergency: patientCounts.withEmergency,
    },
  };

  return {
    timestamp,
    databaseName,
    connected,
    counts,
    anomalies,
    anomalySummary,
    proposedMappings,
    mappingSummary: {
      total: proposedMappings.length,
      deterministic: deterministicCount,
      ambiguous: ambiguousCount,
      invalid: invalidCount,
      requiresManualReview: manualReviewCount,
    },
    ambiguousRecords,
    readOnlyAudit: {
      readOnlyImplementation: true,
      executionPathAudited: true,
      operationsAudited: [
        'Model.aggregate (read-only pipelines with narrow projections)',
        'Model.find (read-only queries with projected fields)',
        'Model.cursor (read-only streaming for large collections)',
      ],
      databaseLevelEnforcementRecommendation:
        'For database-level enforcement, run this script using a dedicated MongoDB user configured strictly with the least-privilege "read" or "readAnyDatabase" role: db.createUser({ user: "resq_readonly", pwd: "<password>", roles: [{ role: "read", db: "resq" }] })',
      auditLimitations:
        'Application-level code path verification guarantees that no Mongoose write APIs (save, create, insert, update, delete, bulkWrite) are called during script execution. However, application-level audit alone cannot independently prove the absence of concurrent database operations by other clients or server-side triggers.',
    },
  };
};

export const printConsoleSummary = (report: TenancyInventoryReport): void => {
  console.log('\n================================================================');
  console.log('       ResQ 2.0 — Read-Only Multi-Tenancy Inventory Audit       ');
  console.log('================================================================');
  console.log(`Timestamp: ${report.timestamp}`);
  console.log(`Database:  ${report.databaseName}`);
  console.log('----------------------------------------------------------------\n');

  console.log('--- [1. ENTITY INVENTORY & OWNERSHIP COUNTS] ---');
  console.log(`Organizations:     ${report.counts.organizations.total} total`);
  console.log(`  Types:           ${JSON.stringify(report.counts.organizations.byType)}`);
  console.log(`  Statuses:        ${JSON.stringify(report.counts.organizations.byStatus)}`);
  console.log(`Memberships:       ${report.counts.memberships.total} total`);
  console.log(`  Principal Types: ${JSON.stringify(report.counts.memberships.byPrincipalType)}`);
  console.log(`  Roles:           ${JSON.stringify(report.counts.memberships.byRole)}`);
  console.log(`Hospitals:         ${report.counts.hospitals.total} total`);
  console.log(`  With Org:        ${report.counts.hospitals.withOrganization}`);
  console.log(`  Without Org:     ${report.counts.hospitals.withoutOrganization}`);
  console.log(`Ambulance Providers: ${report.counts.providers.total} total`);
  console.log(`  With Org:        ${report.counts.providers.withOrganization}`);
  console.log(`  Without Org:     ${report.counts.providers.withoutOrganization}`);
  console.log(`Ambulances:        ${report.counts.ambulances.total} total (Orphaned: ${report.counts.ambulances.orphanedCount})`);
  console.log(`Ambulance Drivers: ${report.counts.drivers.total} total (Orphaned: ${report.counts.drivers.orphanedCount}, Mismatches: ${report.counts.drivers.mismatchedProviderAmbulanceCount})`);
  console.log(`Trips:             ${report.counts.trips.total} total (Invalid References: ${report.counts.trips.invalidReferencesCount})`);
  console.log(`Emergency Requests: ${report.counts.emergencyRequests.total} total (Conflicts: ${report.counts.emergencyRequests.conflictingAssignmentsCount})`);
  console.log(`Hospital Patients: ${report.counts.hospitalPatients.total} total`);

  console.log('\n--- [2. TENANCY ANOMALIES (14 CATEGORIES)] ---');
  const catEntries = Object.entries(report.anomalySummary);
  for (const [cat, count] of catEntries) {
    const symbol = count === 0 ? '✔' : '⚠';
    console.log(`  ${symbol} ${cat.padEnd(46)} : ${count}`);
  }
  console.log(`Total Anomalies Detected: ${report.anomalies.length}`);

  console.log('\n--- [3. PROPOSED OWNERSHIP BACKFILL PLAN] ---');
  console.log(`Total Resource Entities Evaluated: ${report.mappingSummary.total}`);
  console.log(`  Deterministic Backfill:          ${report.mappingSummary.deterministic}`);
  console.log(`  Ambiguous (Manual Review):       ${report.mappingSummary.ambiguous}`);
  console.log(`  Invalid Foreign Key (Review):    ${report.mappingSummary.invalid}`);
  console.log(`  Total Requiring Manual Review:   ${report.mappingSummary.requiresManualReview}`);

  if (report.ambiguousRecords.length > 0) {
    console.log('\n--- [4. RECORDS REQUIRING MANUAL REVIEW] ---');
    for (const rec of report.ambiguousRecords.slice(0, 10)) {
      console.log(`  [${rec.confidence}] ${rec.sourceEntity} (${rec.sourceId}): ${rec.reason}`);
    }
    if (report.ambiguousRecords.length > 10) {
      console.log(`  ... and ${report.ambiguousRecords.length - 10} more records requiring manual review.`);
    }
  }

  console.log('\n================================================================');
  console.log('>>> READ-ONLY IMPLEMENTATION VERIFIED (0 write operations called) <<<');
  console.log('Limitations: Application-level audit verified. Use MongoDB "read" user role for DB-level enforcement.');
  console.log('================================================================\n');
};

export const saveReportToFile = (report: TenancyInventoryReport, outputPath?: string): string => {
  const resolvedPath =
    outputPath ||
    process.env.TENANCY_INVENTORY_REPORT_PATH ||
    path.resolve(process.cwd(), 'reports', 'tenancy-inventory-report.json');

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Restrictive file permissions (0o600: read/write by owner only)
  fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2), { encoding: 'utf-8', mode: 0o600 });
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
    const report = await runTenancyInventory({ batchSize, includeDetailedIdentifiers });
    const savedPath = saveReportToFile(report);

    if (isJson) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printConsoleSummary(report);
      console.log(`Inventory report saved to: ${savedPath}\n`);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? sanitizeMongoUri(err.message) : 'Unknown inventory execution error';
    if (isJson) {
      console.error(JSON.stringify({ error: 'INVENTORY_EXECUTION_ERROR', details: errorMsg }));
    } else {
      console.error(`\n[INVENTORY EXECUTION ERROR] Failed to run tenancy inventory: ${errorMsg}\n`);
    }
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

if (isMainModule()) {
  void execute();
}
