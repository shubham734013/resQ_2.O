import { Types } from 'mongoose';
import { OrganizationModel, type OrganizationDocument } from '../models/Organization.js';
import {
  OrganizationMembershipModel,
  type OrganizationMembershipDocument,
  type MembershipPrincipalType,
} from '../models/OrganizationMembership.js';
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

  const orgId = typeof organizationId === 'string' ? new Types.ObjectId(organizationId) : organizationId;

  // Verify the organization itself exists and is ACTIVE
  const organization = await OrganizationModel.findById(orgId).exec();
  if (!organization) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'The requested organization was not found', 404);
  }
  if (organization.status !== 'ACTIVE') {
    throw new AppError('ORGANIZATION_SUSPENDED', `Organization is ${organization.status.toLowerCase()}`, 403);
  }

  // System ADMINISTRATOR has oversight access, but org must be active
  if (principal.role === 'ADMIN') {
    return new OrganizationMembershipModel({
      organizationId: orgId,
      principalType: 'HOSPITAL',
      principalId: new Types.ObjectId(principal.id),
      role: 'ORG_ADMIN',
      permissions: ['*'],
      status: 'ACTIVE',
    });
  }

  // Citizens (USER) do not hold organizational memberships
  if (principal.role === 'USER') {
    throw new AppError('FORBIDDEN', 'Citizens cannot access organizational tenancy workflows', 403);
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
  if (!authorizedOrgIds.includes(resourceOrgStr)) {
    throw new AppError('FORBIDDEN', 'Resource belongs to another organization. Access denied.', 403);
  }
};

/**
 * Construct a server-derived MongoDB query filter scoped to the principal's authorized organizations.
 * If principal has no authorized organizations, returns a non-matching query ({ _id: null }) to fail closed.
 */
export const scopeByOrganization = async (
  principal: AuthenticatedIdentity,
  additionalFilter: Record<string, unknown> = {}
): Promise<Record<string, unknown>> => {
  if (principal.role === 'ADMIN') {
    return { ...additionalFilter };
  }

  const authorizedIds = await getAuthorizedOrganizationIds(principal);
  if (authorizedIds.length === 0) {
    // Fail-closed: matches nothing
    return { _id: null, ...additionalFilter };
  }

  const orgObjectIds = authorizedIds.map((id) => new Types.ObjectId(id));
  return {
    organizationId: { $in: orgObjectIds },
    ...additionalFilter,
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

  if (resourceAOrgId.toString() !== resourceBOrgId.toString()) {
    throw new AppError(
      'CROSS_ORGANIZATION_CONFLICT',
      'Resources belong to different organizations and cannot be linked',
      409
    );
  }
};

/**
 * Create a new organization and optionally link the creator as ORG_ADMIN.
 */
export const createOrganization = async (
  input: CreateOrganizationInput,
  creator?: AuthenticatedIdentity
): Promise<OrganizationDocument> => {
  const org = await OrganizationModel.create(input);

  if (creator && creator.role !== 'ADMIN' && creator.role !== 'USER') {
    await OrganizationMembershipModel.create({
      organizationId: org._id,
      principalType: creator.role as MembershipPrincipalType,
      principalId: new Types.ObjectId(creator.id),
      role: 'ORG_ADMIN',
      permissions: ['*'],
      status: 'ACTIVE',
    });
  }

  return org;
};

/**
 * Add or update a principal's membership within an organization.
 */
export const addPrincipalToOrganization = async (
  input: AddMembershipInput,
  actingAdmin?: AuthenticatedIdentity
): Promise<OrganizationMembershipDocument> => {
  if (actingAdmin) {
    await requireOrganizationMembership({
      principal: actingAdmin,
      organizationId: input.organizationId,
      permission: 'membership:manage',
    });
  }

  const org = await OrganizationModel.findById(input.organizationId).exec();
  if (!org) {
    throw new AppError('ORGANIZATION_NOT_FOUND', 'Organization not found', 404);
  }

  // Type compatibility validation
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

  const membership = await OrganizationMembershipModel.findOneAndUpdate(
    {
      organizationId: new Types.ObjectId(input.organizationId),
      principalType: input.principalType,
      principalId: new Types.ObjectId(input.principalId),
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

  return membership!;
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
