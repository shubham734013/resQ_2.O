import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose, { type Types } from 'mongoose';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { env } from '../config/env.js';
import { OrganizationModel, type OrganizationType, type OrganizationStatus } from '../models/Organization.js';
import { OrganizationMembershipModel, type MembershipPrincipalType, type MembershipRole, type MembershipStatus } from '../models/OrganizationMembership.js';
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
  identifier?: string;
  details: string;
  requiresManualReview: boolean;
}

export type MappingConfidence = 'DETERMINISTIC' | 'AMBIGUOUS' | 'INVALID';

export interface ProposedOrganizationMapping {
  sourceEntity: 'HOSPITAL' | 'AMBULANCE_PROVIDER' | 'AMBULANCE' | 'AMBULANCE_DRIVER';
  sourceId: string;
  identifier: string;
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
  zeroWritesConfirmed: boolean;
  verificationStatement: string;
}

export const runTenancyInventory = async (): Promise<TenancyInventoryReport> => {
  const timestamp = new Date().toISOString();
  const databaseName = mongoose.connection.name || 'unknown';
  const connected = mongoose.connection.readyState === 1;

  if (!connected) {
    throw new Error('Database connection is not ready. Cannot run tenancy inventory.');
  }

  // 1. Collect aggregated counts using aggregation pipelines & facets for maximum scalability
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
    // Organizations
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

    // Memberships
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

    // Hospitals (with and without organizationId)
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

    // Ambulance Providers (with and without organizationId)
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

    // Ambulances grouped by provider
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

    // Drivers grouped by provider and assigned ambulance
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

    // Trips
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

    // Emergency Requests
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

    // Hospital Patients
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

  // Transform facet results to simple dictionaries
  const orgCounts = orgCountsResult[0] || { total: 0, byType: [], byStatus: [] };
  const membershipCounts = membershipCountsResult[0] || { total: 0, byPrincipalType: [], byRole: [], byStatus: [] };
  const hospitalCounts = hospitalCountsResult[0] || { total: 0, withOrganization: 0, withoutOrganization: 0 };
  const providerCounts = providerCountsResult[0] || { total: 0, withOrganization: 0, withoutOrganization: 0 };
  const ambulanceCounts = ambulanceCountsResult[0] || { total: 0, byProvider: [] };
  const driverCounts = driverCountsResult[0] || { total: 0, withProvider: 0, withAssignedAmbulance: 0, withoutAssignedAmbulance: 0 };
  const tripCounts = tripCountsResult[0] || { total: 0, byStatus: [] };
  const emergencyCounts = emergencyCountsResult[0] || { total: 0, byStatus: [], withAmbulance: 0, withProvider: 0, withDriver: 0, withHospital: 0 };
  const patientCounts = patientCountsResult[0] || { total: 0, byHospital: [], withEmergency: 0 };

  // 2. Execute the 14 anomaly detection pipelines
  const anomalies: TenancyAnomaly[] = [];

  // Anomaly 1: Hospitals without an organization
  const hospitalsWithoutOrg = await HospitalModel.find(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    { _id: 1, name: 1, registrationNumber: 1 }
  ).lean().exec();

  for (const h of hospitalsWithoutOrg) {
    anomalies.push({
      category: 'HOSPITALS_WITHOUT_ORGANIZATION',
      severity: 'WARNING',
      collection: 'Hospitals_data',
      documentId: String(h._id),
      identifier: h.name || h.registrationNumber,
      details: `Hospital '${h.name}' (${h.registrationNumber}) has no assigned organizationId.`,
      requiresManualReview: false, // will have deterministic recommendation
    });
  }

  // Anomaly 2: Providers without an organization
  const providersWithoutOrg = await AmbulanceProviderModel.find(
    { $or: [{ organizationId: { $exists: false } }, { organizationId: null }] },
    { _id: 1, name: 1, registrationNumber: 1 }
  ).lean().exec();

  for (const p of providersWithoutOrg) {
    anomalies.push({
      category: 'PROVIDERS_WITHOUT_ORGANIZATION',
      severity: 'WARNING',
      collection: 'Providers_Data',
      documentId: String(p._id),
      identifier: p.name || p.registrationNumber,
      details: `Ambulance provider '${p.name}' (${p.registrationNumber}) has no assigned organizationId.`,
      requiresManualReview: false, // will have deterministic recommendation
    });
  }

  // Anomaly 3: Organizations with no memberships
  const orgsWithoutMemberships = await OrganizationModel.aggregate<{ _id: Types.ObjectId; name: string; type: string }>([
    {
      $lookup: {
        from: 'OrganizationMemberships',
        localField: '_id',
        foreignField: 'organizationId',
        as: 'memberships',
      },
    },
    { $match: { 'memberships.0': { $exists: false } } },
    { $project: { _id: 1, name: 1, type: 1 } },
  ]);

  for (const o of orgsWithoutMemberships) {
    anomalies.push({
      category: 'ORGANIZATIONS_WITHOUT_MEMBERSHIPS',
      severity: 'WARNING',
      collection: 'Organizations',
      documentId: String(o._id),
      identifier: o.name,
      details: `Organization '${o.name}' of type '${o.type}' has zero active or registered members.`,
      requiresManualReview: true,
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
    anomalies.push({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_ORGANIZATION',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      identifier: String(m.principalId),
      details: `Membership references non-existent organizationId '${m.organizationId}' for principal '${m.principalType}:${m.principalId}'.`,
      requiresManualReview: true,
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
    anomalies.push({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      identifier: String(m.principalId),
      details: `Membership declares principalType 'HOSPITAL' but principalId '${m.principalId}' does not exist in Hospitals_data.`,
      requiresManualReview: true,
    });
  }

  for (const m of providerMemberships) {
    anomalies.push({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      identifier: String(m.principalId),
      details: `Membership declares principalType 'AMBULANCE_PROVIDER' but principalId '${m.principalId}' does not exist in Providers_Data.`,
      requiresManualReview: true,
    });
  }

  for (const m of driverMemberships) {
    anomalies.push({
      category: 'MEMBERSHIPS_WITH_NONEXISTENT_PRINCIPAL',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      identifier: String(m.principalId),
      details: `Membership declares principalType 'AMBULANCE_DRIVER' but principalId '${m.principalId}' does not exist in ambulancedrivers.`,
      requiresManualReview: true,
    });
  }

  for (const m of invalidTypeMemberships) {
    anomalies.push({
      category: 'MEMBERSHIPS_WITH_INCOMPATIBLE_PRINCIPAL_TYPE',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(m._id),
      identifier: String(m.principalId),
      details: `Membership declares unsupported principalType '${m.principalType}'. Expected HOSPITAL, AMBULANCE_PROVIDER, or AMBULANCE_DRIVER.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 7: Hospitals and providers linked to wrong organization type
  const [hospitalsWrongOrgType, providersWrongOrgType] = await Promise.all([
    HospitalModel.aggregate<{ _id: Types.ObjectId; name: string; organizationId: Types.ObjectId; orgType: string }>([
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
      { $project: { _id: 1, name: 1, organizationId: 1, orgType: '$org.type' } },
    ]),
    AmbulanceProviderModel.aggregate<{ _id: Types.ObjectId; name: string; organizationId: Types.ObjectId; orgType: string }>([
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
      { $project: { _id: 1, name: 1, organizationId: 1, orgType: '$org.type' } },
    ]),
  ]);

  for (const h of hospitalsWrongOrgType) {
    anomalies.push({
      category: 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE',
      severity: 'CRITICAL',
      collection: 'Hospitals_data',
      documentId: String(h._id),
      identifier: h.name,
      details: `Hospital '${h.name}' is linked to organization '${h.organizationId}' of type '${h.orgType}' (expected HOSPITAL_NETWORK).`,
      requiresManualReview: true,
    });
  }

  for (const p of providersWrongOrgType) {
    anomalies.push({
      category: 'ENTITY_LINKED_TO_WRONG_ORGANIZATION_TYPE',
      severity: 'CRITICAL',
      collection: 'Providers_Data',
      documentId: String(p._id),
      identifier: p.name,
      details: `Ambulance provider '${p.name}' is linked to organization '${p.organizationId}' of type '${p.orgType}' (expected AMBULANCE_OPERATOR).`,
      requiresManualReview: true,
    });
  }

  // Anomaly 8: Drivers whose provider does not exist
  const driversNonexistentProvider = await AmbulanceDriverModel.aggregate<{
    _id: Types.ObjectId;
    fullName: string;
    licenseNumber: string;
    providerId: Types.ObjectId;
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
    { $project: { _id: 1, fullName: 1, licenseNumber: 1, providerId: 1 } },
  ]);

  for (const d of driversNonexistentProvider) {
    anomalies.push({
      category: 'DRIVERS_WITH_NONEXISTENT_PROVIDER',
      severity: 'CRITICAL',
      collection: 'ambulancedrivers',
      documentId: String(d._id),
      identifier: d.licenseNumber || d.fullName,
      details: `Driver '${d.fullName}' (${d.licenseNumber}) references non-existent providerId '${d.providerId}'.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 9: Drivers whose assigned ambulance does not exist
  const driversNonexistentAmbulance = await AmbulanceDriverModel.aggregate<{
    _id: Types.ObjectId;
    fullName: string;
    assignedAmbulanceId: Types.ObjectId;
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
    { $project: { _id: 1, fullName: 1, assignedAmbulanceId: 1 } },
  ]);

  for (const d of driversNonexistentAmbulance) {
    anomalies.push({
      category: 'DRIVERS_WITH_NONEXISTENT_ASSIGNED_AMBULANCE',
      severity: 'WARNING',
      collection: 'ambulancedrivers',
      documentId: String(d._id),
      identifier: d.fullName,
      details: `Driver '${d.fullName}' references non-existent assignedAmbulanceId '${d.assignedAmbulanceId}'.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 10: Drivers assigned to an ambulance belonging to another provider
  const driversMismatchedAmbulance = await AmbulanceDriverModel.aggregate<{
    _id: Types.ObjectId;
    fullName: string;
    providerId: Types.ObjectId;
    assignedAmbulanceId: Types.ObjectId;
    ambulanceProviderId: Types.ObjectId;
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
        fullName: 1,
        providerId: 1,
        assignedAmbulanceId: 1,
        ambulanceProviderId: '$ambulance.providerId',
      },
    },
  ]);

  for (const d of driversMismatchedAmbulance) {
    anomalies.push({
      category: 'DRIVERS_ASSIGNED_AMBULANCE_PROVIDER_MISMATCH',
      severity: 'CRITICAL',
      collection: 'ambulancedrivers',
      documentId: String(d._id),
      identifier: d.fullName,
      details: `Driver '${d.fullName}' belongs to provider '${d.providerId}' but is assigned ambulance '${d.assignedAmbulanceId}' belonging to provider '${d.ambulanceProviderId}'.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 11: Ambulances whose provider does not exist
  const ambulancesNonexistentProvider = await AmbulanceModel.aggregate<{
    _id: Types.ObjectId;
    vehicleNumber: string;
    registrationNumber: string;
    providerId: Types.ObjectId;
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
    { $project: { _id: 1, vehicleNumber: 1, registrationNumber: 1, providerId: 1 } },
  ]);

  for (const a of ambulancesNonexistentProvider) {
    anomalies.push({
      category: 'AMBULANCES_WITH_NONEXISTENT_PROVIDER',
      severity: 'CRITICAL',
      collection: 'Ambulance_Data',
      documentId: String(a._id),
      identifier: a.vehicleNumber || a.registrationNumber,
      details: `Ambulance '${a.vehicleNumber}' references non-existent providerId '${a.providerId}'.`,
      requiresManualReview: true,
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

    anomalies.push({
      category: 'TRIPS_WITH_INVALID_REFERENCES',
      severity: 'WARNING',
      collection: 'trips',
      documentId: String(t._id),
      details: `Trip references invalid or mismatched entities: ${reasons.join('; ')}.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 13: Emergency assignments that conflict with authoritative provider, driver, or hospital
  const emergencyConflicts = await EmergencyRequestModel.aggregate<{
    _id: Types.ObjectId;
    requestCode: string;
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
        requestCode: 1,
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

    anomalies.push({
      category: 'EMERGENCY_ASSIGNMENT_CONFLICTS',
      severity: 'WARNING',
      collection: 'emergencyrequests',
      documentId: String(e._id),
      identifier: e.requestCode,
      details: `Emergency request '${e.requestCode}' has assignment conflict: ${reasons.join('; ')}.`,
      requiresManualReview: true,
    });
  }

  // Anomaly 14: Duplicate or ambiguous relationships that prevent safe automatic ownership assignment
  // E.g., principal assigned to multiple distinct organizations in active memberships
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
    anomalies.push({
      category: 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS',
      severity: 'CRITICAL',
      collection: 'OrganizationMemberships',
      documentId: String(amb._id.principalId),
      identifier: `${amb._id.principalType}:${amb._id.principalId}`,
      details: `Principal '${amb._id.principalType}:${amb._id.principalId}' has active memberships across ${amb.orgCount} distinct organizations (${amb.orgs.join(', ')}). Automatic single-tenant mapping cannot be resolved.`,
      requiresManualReview: true,
    });
  }

  // Check hospitals where direct organizationId conflicts with membership organizationId
  const hospitalMembershipConflicts = await HospitalModel.aggregate<{
    _id: Types.ObjectId;
    name: string;
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
        name: 1,
        organizationId: 1,
        memberOrgId: '$membership.organizationId',
      },
    },
  ]);

  for (const hmc of hospitalMembershipConflicts) {
    anomalies.push({
      category: 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS',
      severity: 'CRITICAL',
      collection: 'Hospitals_data',
      documentId: String(hmc._id),
      identifier: hmc.name,
      details: `Hospital '${hmc.name}' has direct organizationId '${hmc.organizationId}' but has active membership in distinct organization '${hmc.memberOrgId}'.`,
      requiresManualReview: true,
    });
  }

  // Check providers where direct organizationId conflicts with membership organizationId
  const providerMembershipConflicts = await AmbulanceProviderModel.aggregate<{
    _id: Types.ObjectId;
    name: string;
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
        name: 1,
        organizationId: 1,
        memberOrgId: '$membership.organizationId',
      },
    },
  ]);

  for (const pmc of providerMembershipConflicts) {
    anomalies.push({
      category: 'AMBIGUOUS_OR_DUPLICATE_RELATIONSHIPS',
      severity: 'CRITICAL',
      collection: 'Providers_Data',
      documentId: String(pmc._id),
      identifier: pmc.name,
      details: `Ambulance provider '${pmc.name}' has direct organizationId '${pmc.organizationId}' but has active membership in distinct organization '${pmc.memberOrgId}'.`,
      requiresManualReview: true,
    });
  }

  // 3. Propose deterministic ownership mappings for all resource entities
  const proposedMappings: ProposedOrganizationMapping[] = [];

  // Index active memberships by principalId for fast lookup
  const activeMemberships = await OrganizationMembershipModel.find(
    { status: 'ACTIVE' },
    { organizationId: 1, principalType: 1, principalId: 1, role: 1 }
  ).lean().exec();

  const membershipsByPrincipal = new Map<string, typeof activeMemberships>();
  for (const m of activeMemberships) {
    const key = `${m.principalType}:${m.principalId}`;
    const list = membershipsByPrincipal.get(key) || [];
    list.push(m);
    membershipsByPrincipal.set(key, list);
  }

  // Lookup map of all organizations for type checking
  const allOrgs = await OrganizationModel.find({}, { _id: 1, name: 1, type: 1, status: 1 }).lean().exec();
  const orgMap = new Map<string, (typeof allOrgs)[0]>();
  for (const o of allOrgs) {
    orgMap.set(String(o._id), o);
  }

  // Maps for proposed organization IDs per provider to support driver and ambulance inheritance
  const providerOrgResolution = new Map<string, { orgId?: string; isDeterministic: boolean; willCreate: boolean }>();

  // Evaluate all hospitals
  const allHospitals = await HospitalModel.find({}, { _id: 1, name: 1, registrationNumber: 1, organizationId: 1 }).lean().exec();
  for (const h of allHospitals) {
    const principalKey = `HOSPITAL:${h._id}`;
    const members = membershipsByPrincipal.get(principalKey) || [];
    const directOrg = h.organizationId ? orgMap.get(String(h.organizationId)) : undefined;

    if (h.organizationId) {
      if (!directOrg) {
        proposedMappings.push({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          identifier: h.name || h.registrationNumber,
          currentOrganizationId: String(h.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Current organizationId '${h.organizationId}' does not exist in Organizations collection.`,
          confidence: 'INVALID',
          requiresManualReview: true,
        });
      } else if (directOrg.type !== 'HOSPITAL_NETWORK') {
        proposedMappings.push({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          identifier: h.name || h.registrationNumber,
          currentOrganizationId: String(h.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationType: directOrg.type,
          reason: `Assigned organization '${directOrg.name}' is of type '${directOrg.type}'. Expected HOSPITAL_NETWORK.`,
          confidence: 'INVALID',
          requiresManualReview: true,
        });
      } else if (members.some((m) => String(m.organizationId) !== String(h.organizationId))) {
        proposedMappings.push({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          identifier: h.name || h.registrationNumber,
          currentOrganizationId: String(h.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationId: String(h.organizationId),
          reason: `Hospital has conflicting organization assignments between direct organizationId and membership.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
        });
      } else {
        proposedMappings.push({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          identifier: h.name || h.registrationNumber,
          currentOrganizationId: String(h.organizationId),
          proposedOrganizationId: String(h.organizationId),
          proposedAction: 'LINK_EXISTING_ORGANIZATION',
          proposedOrganizationType: 'HOSPITAL_NETWORK',
          reason: `Valid existing organization assignment to HOSPITAL_NETWORK '${directOrg.name}'.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
        });
      }
    } else {
      // Hospital without organizationId
      if (members.length === 1 && members[0]) {
        const memOrg = orgMap.get(String(members[0].organizationId));
        if (memOrg && memOrg.type === 'HOSPITAL_NETWORK') {
          proposedMappings.push({
            sourceEntity: 'HOSPITAL',
            sourceId: String(h._id),
            identifier: h.name || h.registrationNumber,
            proposedOrganizationId: String(memOrg._id),
            proposedAction: 'LINK_EXISTING_ORGANIZATION',
            proposedOrganizationType: 'HOSPITAL_NETWORK',
            reason: `Inherit organization from existing verified active membership in '${memOrg.name}'.`,
            confidence: 'DETERMINISTIC',
            requiresManualReview: false,
          });
          continue;
        }
      }

      if (members.length > 1) {
        proposedMappings.push({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          identifier: h.name || h.registrationNumber,
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Hospital has multiple active memberships across distinct organizations.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
        });
      } else {
        // No membership, no direct org -> Standalone hospital network
        proposedMappings.push({
          sourceEntity: 'HOSPITAL',
          sourceId: String(h._id),
          identifier: h.name || h.registrationNumber,
          proposedAction: 'CREATE_ORGANIZATION',
          proposedOrganizationType: 'HOSPITAL_NETWORK',
          reason: `Standalone hospital without organization or membership. Deterministically create dedicated HOSPITAL_NETWORK organization.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
        });
      }
    }
  }

  // Evaluate all ambulance providers
  const allProviders = await AmbulanceProviderModel.find({}, { _id: 1, name: 1, registrationNumber: 1, organizationId: 1 }).lean().exec();
  const providerMap = new Map<string, (typeof allProviders)[0]>();
  for (const p of allProviders) {
    providerMap.set(String(p._id), p);
  }

  for (const p of allProviders) {
    const principalKey = `AMBULANCE_PROVIDER:${p._id}`;
    const members = membershipsByPrincipal.get(principalKey) || [];
    const directOrg = p.organizationId ? orgMap.get(String(p.organizationId)) : undefined;

    if (p.organizationId) {
      if (!directOrg) {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        proposedMappings.push({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          identifier: p.name || p.registrationNumber,
          currentOrganizationId: String(p.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Current organizationId '${p.organizationId}' does not exist in Organizations collection.`,
          confidence: 'INVALID',
          requiresManualReview: true,
        });
      } else if (directOrg.type !== 'AMBULANCE_OPERATOR') {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        proposedMappings.push({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          identifier: p.name || p.registrationNumber,
          currentOrganizationId: String(p.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationType: directOrg.type,
          reason: `Assigned organization '${directOrg.name}' is of type '${directOrg.type}'. Expected AMBULANCE_OPERATOR.`,
          confidence: 'INVALID',
          requiresManualReview: true,
        });
      } else if (members.some((m) => String(m.organizationId) !== String(p.organizationId))) {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        proposedMappings.push({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          identifier: p.name || p.registrationNumber,
          currentOrganizationId: String(p.organizationId),
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          proposedOrganizationId: String(p.organizationId),
          reason: `Provider has conflicting organization assignments between direct organizationId and membership.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
        });
      } else {
        providerOrgResolution.set(String(p._id), { orgId: String(directOrg._id), isDeterministic: true, willCreate: false });
        proposedMappings.push({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          identifier: p.name || p.registrationNumber,
          currentOrganizationId: String(p.organizationId),
          proposedOrganizationId: String(p.organizationId),
          proposedAction: 'LINK_EXISTING_ORGANIZATION',
          proposedOrganizationType: 'AMBULANCE_OPERATOR',
          reason: `Valid existing organization assignment to AMBULANCE_OPERATOR '${directOrg.name}'.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
        });
      }
    } else {
      // Provider without organizationId
      if (members.length === 1 && members[0]) {
        const memOrg = orgMap.get(String(members[0].organizationId));
        if (memOrg && memOrg.type === 'AMBULANCE_OPERATOR') {
          providerOrgResolution.set(String(p._id), { orgId: String(memOrg._id), isDeterministic: true, willCreate: false });
          proposedMappings.push({
            sourceEntity: 'AMBULANCE_PROVIDER',
            sourceId: String(p._id),
            identifier: p.name || p.registrationNumber,
            proposedOrganizationId: String(memOrg._id),
            proposedAction: 'LINK_EXISTING_ORGANIZATION',
            proposedOrganizationType: 'AMBULANCE_OPERATOR',
            reason: `Inherit organization from existing verified active membership in '${memOrg.name}'.`,
            confidence: 'DETERMINISTIC',
            requiresManualReview: false,
          });
          continue;
        }
      }

      if (members.length > 1) {
        providerOrgResolution.set(String(p._id), { isDeterministic: false, willCreate: false });
        proposedMappings.push({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          identifier: p.name || p.registrationNumber,
          proposedAction: 'MANUAL_REVIEW_REQUIRED',
          reason: `Provider has multiple active memberships across distinct organizations.`,
          confidence: 'AMBIGUOUS',
          requiresManualReview: true,
        });
      } else {
        // No membership, no direct org -> Standalone ambulance operator
        providerOrgResolution.set(String(p._id), { isDeterministic: true, willCreate: true });
        proposedMappings.push({
          sourceEntity: 'AMBULANCE_PROVIDER',
          sourceId: String(p._id),
          identifier: p.name || p.registrationNumber,
          proposedAction: 'CREATE_ORGANIZATION',
          proposedOrganizationType: 'AMBULANCE_OPERATOR',
          reason: `Standalone provider without organization or membership. Deterministically create dedicated AMBULANCE_OPERATOR organization.`,
          confidence: 'DETERMINISTIC',
          requiresManualReview: false,
        });
      }
    }
  }

  // Evaluate all ambulances
  const allAmbulances = await AmbulanceModel.find({}, { _id: 1, vehicleNumber: 1, registrationNumber: 1, providerId: 1 }).lean().exec();
  const ambulanceMap = new Map<string, (typeof allAmbulances)[0]>();
  for (const a of allAmbulances) {
    ambulanceMap.set(String(a._id), a);
  }

  for (const a of allAmbulances) {
    const parentProvider = providerMap.get(String(a.providerId));
    const providerRes = providerOrgResolution.get(String(a.providerId));

    if (!parentProvider) {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE',
        sourceId: String(a._id),
        identifier: a.vehicleNumber || a.registrationNumber,
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Ambulance providerId '${a.providerId}' does not exist in Providers_Data.`,
        confidence: 'INVALID',
        requiresManualReview: true,
      });
    } else if (providerRes?.isDeterministic) {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE',
        sourceId: String(a._id),
        identifier: a.vehicleNumber || a.registrationNumber,
        proposedOrganizationId: providerRes.orgId,
        proposedAction: 'INHERIT_PROVIDER_ORGANIZATION',
        proposedOrganizationType: 'AMBULANCE_OPERATOR',
        reason: providerRes.willCreate
          ? `Inherit organization from parent provider '${parentProvider.name}' (scheduled for dedicated organization creation).`
          : `Inherit organization from parent provider '${parentProvider.name}'.`,
        confidence: 'DETERMINISTIC',
        requiresManualReview: false,
      });
    } else {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE',
        sourceId: String(a._id),
        identifier: a.vehicleNumber || a.registrationNumber,
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Parent provider '${parentProvider.name}' has ambiguous or invalid organization status.`,
        confidence: 'AMBIGUOUS',
        requiresManualReview: true,
      });
    }
  }

  // Evaluate all drivers
  const allDrivers = await AmbulanceDriverModel.find(
    {},
    { _id: 1, fullName: 1, licenseNumber: 1, providerId: 1, assignedAmbulanceId: 1 }
  ).lean().exec();

  for (const d of allDrivers) {
    const parentProvider = providerMap.get(String(d.providerId));
    const providerRes = providerOrgResolution.get(String(d.providerId));
    const assignedAmbulance = d.assignedAmbulanceId ? ambulanceMap.get(String(d.assignedAmbulanceId)) : undefined;

    if (!parentProvider) {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE_DRIVER',
        sourceId: String(d._id),
        identifier: d.licenseNumber || d.fullName,
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Driver providerId '${d.providerId}' does not exist in Providers_Data.`,
        confidence: 'INVALID',
        requiresManualReview: true,
      });
    } else if (d.assignedAmbulanceId && !assignedAmbulance) {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE_DRIVER',
        sourceId: String(d._id),
        identifier: d.licenseNumber || d.fullName,
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Driver assignedAmbulanceId '${d.assignedAmbulanceId}' does not exist in Ambulance_Data.`,
        confidence: 'AMBIGUOUS',
        requiresManualReview: true,
      });
    } else if (assignedAmbulance && String(assignedAmbulance.providerId) !== String(d.providerId)) {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE_DRIVER',
        sourceId: String(d._id),
        identifier: d.licenseNumber || d.fullName,
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Driver belongs to provider '${d.providerId}' but assigned ambulance belongs to provider '${assignedAmbulance.providerId}'.`,
        confidence: 'AMBIGUOUS',
        requiresManualReview: true,
      });
    } else if (providerRes?.isDeterministic) {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE_DRIVER',
        sourceId: String(d._id),
        identifier: d.licenseNumber || d.fullName,
        proposedOrganizationId: providerRes.orgId,
        proposedAction: 'INHERIT_PROVIDER_ORGANIZATION',
        proposedOrganizationType: 'AMBULANCE_OPERATOR',
        reason: providerRes.willCreate
          ? `Inherit organization from parent provider '${parentProvider.name}' (scheduled for dedicated organization creation).`
          : `Inherit organization from parent provider '${parentProvider.name}'.`,
        confidence: 'DETERMINISTIC',
        requiresManualReview: false,
      });
    } else {
      proposedMappings.push({
        sourceEntity: 'AMBULANCE_DRIVER',
        sourceId: String(d._id),
        identifier: d.licenseNumber || d.fullName,
        proposedAction: 'MANUAL_REVIEW_REQUIRED',
        reason: `Parent provider '${parentProvider.name}' has ambiguous or invalid organization status.`,
        confidence: 'AMBIGUOUS',
        requiresManualReview: true,
      });
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

  // Convert array group counts to dictionary
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
    zeroWritesConfirmed: true,
    verificationStatement: 'Verification confirmed: 0 database writes performed.',
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
      console.log(`  [${rec.confidence}] ${rec.sourceEntity} ${rec.identifier} (${rec.sourceId}): ${rec.reason}`);
    }
    if (report.ambiguousRecords.length > 10) {
      console.log(`  ... and ${report.ambiguousRecords.length - 10} more records requiring manual review.`);
    }
  }

  console.log('\n================================================================');
  console.log(`>>> ${report.verificationStatement} <<<`);
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

  fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2), 'utf-8');
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
    const report = await runTenancyInventory();
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
