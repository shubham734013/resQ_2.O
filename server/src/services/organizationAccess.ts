import { Types } from 'mongoose';
import { OrganizationModel, type OrganizationDocument } from '../models/Organization.js';
import {
  OrganizationMembershipModel,
  type OrganizationMembershipDocument,
  type MembershipPrincipalType,
  type MembershipRole,
} from '../models/OrganizationMembership.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';
import { AuditLogModel } from '../models/AuditLog.js';
import type { AuthenticatedIdentity } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import type { CreateOrganizationInput, AddMembershipInput } from '../schemas/organization.js';

export interface RequireMembershipParams {
  principal: AuthenticatedIdentity;
  organizationId: string | Types.ObjectId;
  permission?: string;
}

export interface AssertResourceOrganizationParams {
  resourceOrganizationId?: string | Types.ObjectId | null;
  authorizedOrgIds: string[];
}

export interface ScopeByOrganizationOptions {
  allowGlobalAdminAccess?: boolean;
}

export interface EmergencyCoordinationContext {
  patientId: string;
  assignedHospitalId?: string;
  assignedProviderId?: string;
  assignedDriverId?: string;
}

/**
 * Validate that the principal has an active membership in the given organization
 * and optionally holds the required permission.
 * Fails closed if organization or membership is missing, suspended, or revoked.
 */
export const requireOrganizationMembership = async ({
  principal,
  organizationId,
  permission,
}: RequireMembershipParams): Promise<OrganizationMembershipDocument> => {
  if (!principal || !principal.id) {
    throw new AppError('UNAUTHORIZED', 'Authentication is required for organizational access', 401);
  }

  const orgIdStr = typeof organizationId === 'string' ? organizationId : organizationId.toString();
  if (!Types.ObjectId.isValid(orgIdStr)) {
    throw new AppError('INVALID_ID', 'Invalid organization identifier format', 400);
  }

  const orgId = new Types.ObjectId(orgIdStr);

  // Verify the organization itself exists and is ACTIVE
  const organization = await OrganizationModel.findById(orgId).exec();
  if (!organization) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'The requested organization was not found', 404);
  }
  if (organization.status !== 'ACTIVE') {
    throw new AppError('ORGANIZATION_SUSPENDED', `Organization is ${organization.status.toLowerCase()}`, 403);
  }

  // System ADMINISTRATOR has oversight access, but organization must exist and be active
  if (principal.role === 'ADMIN') {
    return new OrganizationMembershipModel({
      organizationId: orgId,
      principalType: 'HOSPITAL',
      principalId: Types.ObjectId.isValid(principal.id) ? new Types.ObjectId(principal.id) : new Types.ObjectId(),
      role: 'ORG_ADMIN',
      permissions: ['*'],
      status: 'ACTIVE',
    });
  }

  // Citizens (USER) do not hold organizational memberships
  if (principal.role === 'USER') {
    throw new AppError('FORBIDDEN', 'Citizens cannot access organizational tenancy workflows', 403);
  }

  if (!Types.ObjectId.isValid(principal.id)) {
    throw new AppError('INVALID_ID', 'Invalid principal identifier format', 400);
  }

  // Find active membership matching authenticated principal
  const membership = await OrganizationMembershipModel.findOne({
    organizationId: orgId,
    principalType: principal.role as MembershipPrincipalType,
    principalId: new Types.ObjectId(principal.id),
    status: 'ACTIVE',
  }).exec();

  if (!membership) {
    throw new AppError('FORBIDDEN', 'Principal does not hold active membership in this organization', 403);
  }

  // Permission check if specified
  if (permission) {
    const hasWildcard = membership.permissions.includes('*') || membership.role === 'ORG_ADMIN';
    const hasSpecific = membership.permissions.includes(permission);
    if (!hasWildcard && !hasSpecific) {
      throw new AppError('FORBIDDEN', `Missing required permission: ${permission}`, 403);
    }
  }

  return membership;
};

/**
 * Return only active organization IDs the principal is authorized to access.
 * Returns empty array for principals with no active memberships.
 */
export const getAuthorizedOrganizationIds = async (principal: AuthenticatedIdentity): Promise<string[]> => {
  if (!principal || !principal.id) return [];

  // Super-admin can see all active organizations
  if (principal.role === 'ADMIN') {
    const allActive = await OrganizationModel.find({ status: 'ACTIVE' }).select('_id').lean().exec();
    return allActive.map((o) => o._id.toString());
  }

  // Citizens have no organizational memberships
  if (principal.role === 'USER') {
    return [];
  }

  if (!Types.ObjectId.isValid(principal.id)) return [];

  const memberships = await OrganizationMembershipModel.find({
    principalType: principal.role as MembershipPrincipalType,
    principalId: new Types.ObjectId(principal.id),
    status: 'ACTIVE',
  })
    .select('organizationId')
    .lean()
    .exec();

  if (memberships.length === 0) {
    return [];
  }

  const candidateIds = memberships.map((m) => m.organizationId);

  // Filter to only organizations that are currently ACTIVE
  const activeOrgs = await OrganizationModel.find({
    _id: { $in: candidateIds },
    status: 'ACTIVE',
  })
    .select('_id')
    .lean()
    .exec();

  return activeOrgs.map((o) => o._id.toString());
};

/**
 * Verify that a specific resource belongs to one of the authorized organizations.
 * Fails closed on null, undefined, or unauthorized IDs.
 */
export const assertResourceOrganization = ({
  resourceOrganizationId,
  authorizedOrgIds,
}: AssertResourceOrganizationParams): void => {
  if (!resourceOrganizationId) {
    throw new AppError(
      'FORBIDDEN',
      'Resource has no organization assignment and cannot be accessed in scoped context',
      403
    );
  }

  const resourceOrgStr = resourceOrganizationId.toString();
  if (!Types.ObjectId.isValid(resourceOrgStr)) {
    throw new AppError('INVALID_ID', 'Resource organization identifier is invalid', 400);
  }

  if (!authorizedOrgIds.includes(resourceOrgStr)) {
    throw new AppError('FORBIDDEN', 'Resource belongs to another organization. Access denied.', 403);
  }
};

/**
 * Construct a server-derived MongoDB query filter scoped to the principal's authorized organizations.
 * - Prevents caller-supplied filters from overriding tenant constraints using $and.
 * - Fails closed with an un-matchable {_id: {$in: []}} if principal has no authorized organizations.
 * - Requires explicit allowGlobalAdminAccess: true for platform administrators to execute cross-tenant queries.
 */
export const scopeByOrganization = async (
  principal: AuthenticatedIdentity,
  additionalFilter: Record<string, unknown> = {},
  options?: ScopeByOrganizationOptions
): Promise<Record<string, unknown>> => {
  if (!principal || !principal.id) {
    throw new AppError('UNAUTHORIZED', 'Authentication is required for query scoping', 401);
  }

  // Explicit global admin access: only allowed if explicitly requested
  if (principal.role === 'ADMIN' && options?.allowGlobalAdminAccess === true) {
    return { ...additionalFilter };
  }

  const authorizedIds = await getAuthorizedOrganizationIds(principal);
  if (authorizedIds.length === 0) {
    // Fail-closed: Ensure the query CANNOT match anything, regardless of additionalFilter.
    // Combining with $and ensures caller cannot overwrite _id through object spread.
    return {
      $and: [
        { _id: { $in: [] } },
        { ...additionalFilter },
      ],
    };
  }

  const orgObjectIds = authorizedIds.map((id) => new Types.ObjectId(id));
  const sanitizedFilter = { ...additionalFilter };

  // If caller provided an organizationId in additionalFilter, ensure it is within authorizedIds!
  if ('organizationId' in sanitizedFilter) {
    const requestedOrgId = String(sanitizedFilter.organizationId);
    if (!authorizedIds.includes(requestedOrgId)) {
      throw new AppError('FORBIDDEN', 'Query filter requests an unauthorized organization', 403);
    }
  }

  // Safe typed combination using $and to prevent property override attacks
  return {
    $and: [
      { organizationId: { $in: orgObjectIds } },
      sanitizedFilter,
    ],
  };
};

/**
 * Verify that related resources belong to a valid common tenant where required.
 * e.g. Assigning a driver to an ambulance must ensure both belong to the same operator.
 */
export const assertSameOrganization = (
  resourceAOrgId: string | Types.ObjectId | undefined | null,
  resourceBOrgId: string | Types.ObjectId | undefined | null
): void => {
  if (!resourceAOrgId || !resourceBOrgId) {
    throw new AppError(
      'CROSS_ORGANIZATION_CONFLICT',
      'Both resources must have valid organization assignments to verify tenancy',
      409
    );
  }

  const strA = resourceAOrgId.toString();
  const strB = resourceBOrgId.toString();

  if (!Types.ObjectId.isValid(strA) || !Types.ObjectId.isValid(strB)) {
    throw new AppError('INVALID_ID', 'Invalid organization identifier format', 400);
  }

  if (strA !== strB) {
    throw new AppError(
      'CROSS_ORGANIZATION_CONFLICT',
      'Resources belong to different organizations and cannot be linked',
      409
    );
  }
};

/**
 * Create a new organization and establish initial membership with defined least-privilege permissions.
 * Creator is strictly required and must be an authenticated, authorized principal.
 */
export const createOrganization = async (
  input: CreateOrganizationInput,
  creator: AuthenticatedIdentity
): Promise<{ organization: OrganizationDocument; membership?: OrganizationMembershipDocument }> => {
  if (!creator || !creator.id) {
    throw new AppError('UNAUTHORIZED', 'Authenticated creator required to provision organization', 401);
  }

  // Only platform ADMIN, HOSPITAL, or AMBULANCE_PROVIDER can create organizations
  if (creator.role !== 'ADMIN' && creator.role !== 'HOSPITAL' && creator.role !== 'AMBULANCE_PROVIDER') {
    throw new AppError('FORBIDDEN', 'Citizens and drivers cannot provision organization tenants', 403);
  }

  // Type compatibility check with creator
  if (creator.role === 'HOSPITAL' && input.type !== 'HOSPITAL_NETWORK') {
    throw new AppError('FORBIDDEN', 'Hospitals can only provision HOSPITAL_NETWORK organizations', 403);
  }
  if (creator.role === 'AMBULANCE_PROVIDER' && input.type !== 'AMBULANCE_OPERATOR') {
    throw new AppError('FORBIDDEN', 'Ambulance providers can only provision AMBULANCE_OPERATOR organizations', 403);
  }

  const org = await OrganizationModel.create(input);

  let membership: OrganizationMembershipDocument | undefined;

  // Provision initial membership for healthcare creators with defined least-privilege permissions
  if (creator.role === 'HOSPITAL' || creator.role === 'AMBULANCE_PROVIDER') {
    try {
      const defaultRole: MembershipRole = creator.role === 'HOSPITAL' ? 'HOSPITAL_ADMIN' : 'PROVIDER_ADMIN';
      const defaultPermissions: string[] =
        creator.role === 'HOSPITAL'
          ? ['hospital:manage', 'membership:manage', 'patient:manage', 'emergency:coordinate']
          : ['fleet:manage', 'driver:manage', 'membership:manage', 'dispatch:manage'];

      membership = await OrganizationMembershipModel.create({
        organizationId: org._id,
        principalType: creator.role as MembershipPrincipalType,
        principalId: new Types.ObjectId(creator.id),
        role: defaultRole,
        permissions: defaultPermissions,
        status: 'ACTIVE',
      });
    } catch (membershipError) {
      // Rollback organization creation to prevent orphaned tenant record
      await OrganizationModel.deleteOne({ _id: org._id }).exec();
      throw membershipError;
    }
  }

  // Audit log organization creation
  await AuditLogModel.create({
    actorId: Types.ObjectId.isValid(creator.id) ? new Types.ObjectId(creator.id) : undefined,
    actorRole: creator.role,
    action: 'ORGANIZATION_CREATED',
    entityType: 'ORGANIZATION',
    entityId: org._id,
    newState: {
      name: org.name,
      type: org.type,
      status: org.status,
    },
  }).catch(() => null);

  return { organization: org, membership };
};

/**
 * Add or update a principal's membership within an organization.
 * Acting principal is strictly required and must be authorized to manage memberships.
 */
export const addPrincipalToOrganization = async (
  input: AddMembershipInput,
  actingPrincipal: AuthenticatedIdentity
): Promise<OrganizationMembershipDocument> => {
  if (!actingPrincipal || !actingPrincipal.id) {
    throw new AppError('UNAUTHORIZED', 'Authenticated actor is required to manage memberships', 401);
  }

  if (!Types.ObjectId.isValid(input.organizationId)) {
    throw new AppError('INVALID_ID', 'Invalid organization identifier format', 400);
  }
  if (!Types.ObjectId.isValid(input.principalId)) {
    throw new AppError('INVALID_ID', 'Invalid principal identifier format', 400);
  }

  const orgId = new Types.ObjectId(input.organizationId);
  const princId = new Types.ObjectId(input.principalId);

  // Authorize actingPrincipal
  if (actingPrincipal.role !== 'ADMIN') {
    const actorMembership = await requireOrganizationMembership({
      principal: actingPrincipal,
      organizationId: input.organizationId,
      permission: 'membership:manage',
    });

    // Prevent privilege escalation: normal managers cannot grant ORG_ADMIN or permissions beyond their own
    if (actorMembership.role !== 'ORG_ADMIN') {
      if (input.role === 'ORG_ADMIN') {
        throw new AppError('FORBIDDEN', 'Only organization administrators can grant ORG_ADMIN role', 403);
      }
      for (const perm of input.permissions ?? []) {
        if (!actorMembership.permissions.includes(perm) && !actorMembership.permissions.includes('*')) {
          throw new AppError('FORBIDDEN', `Cannot grant permission (${perm}) not held by actor`, 403);
        }
      }
    }
  }

  // Check organization exists and is ACTIVE
  const org = await OrganizationModel.findById(orgId).exec();
  if (!org) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
  }
  if (org.status !== 'ACTIVE') {
    throw new AppError('ORGANIZATION_SUSPENDED', `Cannot add members to a ${org.status.toLowerCase()} organization`, 403);
  }

  // Validate type compatibility
  if (org.type === 'HOSPITAL_NETWORK' && input.principalType !== 'HOSPITAL') {
    throw new AppError(
      'INCOMPATIBLE_PRINCIPAL_TYPE',
      'Hospital networks can only accept hospital principals',
      400
    );
  }
  if (
    org.type === 'AMBULANCE_OPERATOR' &&
    input.principalType !== 'AMBULANCE_PROVIDER' &&
    input.principalType !== 'AMBULANCE_DRIVER'
  ) {
    throw new AppError(
      'INCOMPATIBLE_PRINCIPAL_TYPE',
      'Ambulance operators can only accept ambulance provider and driver principals',
      400
    );
  }

  // Verify referenced principal exists in authoritative collections and is not suspended/rejected
  if (input.principalType === 'HOSPITAL') {
    const hosp = await HospitalModel.findById(princId).exec();
    if (!hosp) throw new AppError('PRINCIPAL_NOT_FOUND', 'Hospital principal record not found', 404);
    if (hosp.accountStatus === 'SUSPENDED' || hosp.accountStatus === 'REJECTED') {
      throw new AppError('PRINCIPAL_SUSPENDED', 'Hospital account is suspended or rejected', 403);
    }
  } else if (input.principalType === 'AMBULANCE_PROVIDER') {
    const prov = await AmbulanceProviderModel.findById(princId).exec();
    if (!prov) throw new AppError('PRINCIPAL_NOT_FOUND', 'Ambulance provider principal record not found', 404);
    if (prov.accountStatus === 'SUSPENDED' || prov.accountStatus === 'REJECTED') {
      throw new AppError('PRINCIPAL_SUSPENDED', 'Ambulance provider account is suspended or rejected', 403);
    }
  } else if (input.principalType === 'AMBULANCE_DRIVER') {
    const driver = await AmbulanceDriverModel.findById(princId).exec();
    if (!driver) throw new AppError('PRINCIPAL_NOT_FOUND', 'Ambulance driver principal record not found', 404);
    if (driver.accountStatus === 'SUSPENDED' || driver.accountStatus === 'REJECTED') {
      throw new AppError('PRINCIPAL_SUSPENDED', 'Ambulance driver account is suspended or rejected', 403);
    }
  }

  // Atomic update or insert with concurrency handling
  const membership = await OrganizationMembershipModel.findOneAndUpdate(
    {
      organizationId: orgId,
      principalType: input.principalType,
      principalId: princId,
    },
    {
      $set: {
        role: input.role,
        permissions: input.permissions,
        status: input.status ?? 'ACTIVE',
      },
    },
    { upsert: true, returnDocument: 'after' }
  ).exec();

  // Audit log the membership assignment
  await AuditLogModel.create({
    actorId: Types.ObjectId.isValid(actingPrincipal.id) ? new Types.ObjectId(actingPrincipal.id) : undefined,
    actorRole: actingPrincipal.role,
    action: 'ORGANIZATION_MEMBERSHIP_ASSIGNED',
    entityType: 'ORGANIZATION_MEMBERSHIP',
    entityId: membership!._id,
    newState: {
      organizationId: input.organizationId,
      principalType: input.principalType,
      principalId: input.principalId,
      role: input.role,
      permissions: input.permissions,
      status: input.status ?? 'ACTIVE',
    },
  }).catch(() => null);

  return membership!;
};

/**
 * Dedicated internal provisioning helper for seed scripts or initial system bootstrapping.
 * Strictly NOT exposed via HTTP controllers or public routes.
 */
export const bootstrapInternalMembership = async (
  organizationId: Types.ObjectId,
  principalType: MembershipPrincipalType,
  principalId: Types.ObjectId,
  role: MembershipRole,
  permissions: string[]
): Promise<OrganizationMembershipDocument> => {
  return OrganizationMembershipModel.create({
    organizationId,
    principalType,
    principalId,
    role,
    permissions,
    status: 'ACTIVE',
  });
};

/**
 * Retrieve organization details with membership validation.
 */
export const getOrganizationDetails = async (
  organizationId: string | Types.ObjectId,
  principal: AuthenticatedIdentity
): Promise<OrganizationDocument> => {
  await requireOrganizationMembership({ principal, organizationId });
  const org = await OrganizationModel.findById(organizationId).exec();
  if (!org) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
  }
  return org;
};

/**
 * Validate that an authenticated caller has legitimate participation rights in an emergency.
 * Preserves cross-tenant emergency coordination between citizens, hospitals, and fleet operators.
 */
export const assertEmergencyCoordinationAccess = (
  principal: AuthenticatedIdentity,
  emergency: EmergencyCoordinationContext
): void => {
  if (principal.role === 'ADMIN') return;

  if (principal.role === 'USER') {
    if (principal.id !== emergency.patientId) {
      throw new AppError('FORBIDDEN', 'Citizens can only access their own emergencies', 403);
    }
    return;
  }

  if (principal.role === 'HOSPITAL') {
    if (principal.id !== emergency.assignedHospitalId) {
      throw new AppError('FORBIDDEN', 'Hospital is not assigned to this emergency coordination workflow', 403);
    }
    return;
  }

  if (principal.role === 'AMBULANCE_PROVIDER') {
    if (principal.id !== emergency.assignedProviderId) {
      throw new AppError('FORBIDDEN', 'Provider is not assigned to this emergency dispatch', 403);
    }
    return;
  }

  if (principal.role === 'AMBULANCE_DRIVER') {
    if (principal.id !== emergency.assignedDriverId) {
      throw new AppError('FORBIDDEN', 'Driver is not assigned to this emergency dispatch', 403);
    }
    return;
  }

  throw new AppError('FORBIDDEN', 'Caller has no operational role in this emergency', 403);
};
