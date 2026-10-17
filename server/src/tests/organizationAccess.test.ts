import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { OrganizationModel } from '../models/Organization.js';
import { OrganizationMembershipModel } from '../models/OrganizationMembership.js';
import {
  requireOrganizationMembership,
  getAuthorizedOrganizationIds,
  assertResourceOrganization,
  scopeByOrganization,
  assertSameOrganization,
  createOrganization,
  addPrincipalToOrganization,
} from '../services/organizationAccess.js';
import type { AuthenticatedIdentity } from '../types/auth.js';

describe('DATA-01 Multi-Tenant Organization Isolation and Access Policy', () => {
  let orgAId: string;
  let orgBId: string;
  let fleetOrgCId: string;
  let fleetOrgDId: string;
  let suspendedOrgId: string;

  const hospitalAPrincipal: AuthenticatedIdentity = {
    id: new Types.ObjectId().toString(),
    email: 'admin@hospital-a.network',
    name: 'Hospital A Admin',
    role: 'HOSPITAL',
    accountStatus: 'ACTIVE',
  };

  const hospitalBPrincipal: AuthenticatedIdentity = {
    id: new Types.ObjectId().toString(),
    email: 'admin@hospital-b.network',
    name: 'Hospital B Admin',
    role: 'HOSPITAL',
    accountStatus: 'ACTIVE',
  };

  const providerCPrincipal: AuthenticatedIdentity = {
    id: new Types.ObjectId().toString(),
    email: 'dispatch@provider-c.com',
    name: 'Provider C Dispatcher',
    role: 'AMBULANCE_PROVIDER',
    accountStatus: 'ACTIVE',
  };

  const citizenPrincipal: AuthenticatedIdentity = {
    id: new Types.ObjectId().toString(),
    email: 'citizen@emergency.test',
    name: 'Citizen Patient',
    role: 'USER',
    accountStatus: 'ACTIVE',
  };

  const platformAdminPrincipal: AuthenticatedIdentity = {
    id: new Types.ObjectId().toString(),
    email: 'admin@resq.test',
    name: 'System SuperAdmin',
    role: 'ADMIN',
    accountStatus: 'ACTIVE',
  };

  before(async () => {
    await connectTestDatabase();

    // Clean existing test orgs
    await OrganizationModel.deleteMany({
      name: { $in: ['Metro Hospital Network', 'Valley Hospital System', 'Alpha Ambulance Corp', 'Beta Fleet Services', 'Suspended Network'] },
    }).exec();
    await OrganizationMembershipModel.deleteMany({
      principalId: {
        $in: [
          new Types.ObjectId(hospitalAPrincipal.id),
          new Types.ObjectId(hospitalBPrincipal.id),
          new Types.ObjectId(providerCPrincipal.id),
        ],
      },
    }).exec();

    // Create 2 independent Hospital Networks
    const orgA = await OrganizationModel.create({
      name: 'Metro Hospital Network',
      type: 'HOSPITAL_NETWORK',
      status: 'ACTIVE',
    });
    orgAId = orgA._id.toString();

    const orgB = await OrganizationModel.create({
      name: 'Valley Hospital System',
      type: 'HOSPITAL_NETWORK',
      status: 'ACTIVE',
    });
    orgBId = orgB._id.toString();

    // Create 2 independent Ambulance Operators
    const fleetOrgC = await OrganizationModel.create({
      name: 'Alpha Ambulance Corp',
      type: 'AMBULANCE_OPERATOR',
      status: 'ACTIVE',
    });
    fleetOrgCId = fleetOrgC._id.toString();

    const fleetOrgD = await OrganizationModel.create({
      name: 'Beta Fleet Services',
      type: 'AMBULANCE_OPERATOR',
      status: 'ACTIVE',
    });
    fleetOrgDId = fleetOrgD._id.toString();

    // Create a suspended organization
    const suspended = await OrganizationModel.create({
      name: 'Suspended Network',
      type: 'HOSPITAL_NETWORK',
      status: 'SUSPENDED',
    });
    suspendedOrgId = suspended._id.toString();

    // Link Hospital A to Org A
    await OrganizationMembershipModel.create({
      organizationId: orgA._id,
      principalType: 'HOSPITAL',
      principalId: new Types.ObjectId(hospitalAPrincipal.id),
      role: 'ORG_ADMIN',
      permissions: ['hospital:read', 'hospital:write', 'patient:read'],
      status: 'ACTIVE',
    });

    // Link Hospital B to Org B
    await OrganizationMembershipModel.create({
      organizationId: orgB._id,
      principalType: 'HOSPITAL',
      principalId: new Types.ObjectId(hospitalBPrincipal.id),
      role: 'ORG_MEMBER',
      permissions: ['hospital:read'],
      status: 'ACTIVE',
    });

    // Link Provider C to Fleet Org C
    await OrganizationMembershipModel.create({
      organizationId: fleetOrgC._id,
      principalType: 'AMBULANCE_PROVIDER',
      principalId: new Types.ObjectId(providerCPrincipal.id),
      role: 'PROVIDER_ADMIN',
      permissions: ['fleet:read', 'fleet:write', 'dispatch:read'],
      status: 'ACTIVE',
    });
  });

  after(async () => {
    await OrganizationModel.deleteMany({
      _id: { $in: [orgAId, orgBId, fleetOrgCId, fleetOrgDId, suspendedOrgId] },
    }).exec();
    await OrganizationMembershipModel.deleteMany({
      organizationId: { $in: [orgAId, orgBId, fleetOrgCId, fleetOrgDId, suspendedOrgId] },
    }).exec();
    await mongoose.disconnect();
  });

  it('allows access to authorized organization membership and permissions', async () => {
    const membership = await requireOrganizationMembership({
      principal: hospitalAPrincipal,
      organizationId: orgAId,
      permission: 'hospital:read',
    });

    assert.ok(membership);
    assert.equal(membership.organizationId.toString(), orgAId);
    assert.equal(membership.role, 'ORG_ADMIN');
  });

  it('denies access when Hospital A requests Hospital B organization membership', async () => {
    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: hospitalAPrincipal,
          organizationId: orgBId,
        });
      },
      { message: /Principal does not hold active membership in this organization/ }
    );
  });

  it('denies access when a member lacks the required permission', async () => {
    await assert.rejects(
      async () => {
        // Hospital B has only ['hospital:read'], lacks 'hospital:write'
        await requireOrganizationMembership({
          principal: hospitalBPrincipal,
          organizationId: orgBId,
          permission: 'hospital:write',
        });
      },
      { message: /Missing required permission: hospital:write/ }
    );
  });

  it('denies access to a suspended organization', async () => {
    // Temporarily add membership to suspended org
    const tempMembership = await OrganizationMembershipModel.create({
      organizationId: new Types.ObjectId(suspendedOrgId),
      principalType: 'HOSPITAL',
      principalId: new Types.ObjectId(hospitalAPrincipal.id),
      role: 'ORG_MEMBER',
      permissions: ['hospital:read'],
      status: 'ACTIVE',
    });

    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: hospitalAPrincipal,
          organizationId: suspendedOrgId,
        });
      },
      { message: /Organization is suspended/ }
    );

    await tempMembership.deleteOne();
  });

  it('denies access when a membership itself is suspended or revoked', async () => {
    const revokedMembership = await OrganizationMembershipModel.create({
      organizationId: new Types.ObjectId(orgAId),
      principalType: 'AMBULANCE_DRIVER',
      principalId: new Types.ObjectId(),
      role: 'DRIVER',
      permissions: ['trip:read'],
      status: 'REVOKED',
    });

    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: {
            id: revokedMembership.principalId.toString(),
            email: 'driver@revoked.test',
            role: 'AMBULANCE_DRIVER',
            accountStatus: 'ACTIVE',
          },
          organizationId: orgAId,
        });
      },
      { message: /Principal does not hold active membership/ }
    );

    await revokedMembership.deleteOne();
  });

  it('exempts citizens from organizational membership requirement and prevents them from accessing tenant workflows', async () => {
    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: citizenPrincipal,
          organizationId: orgAId,
        });
      },
      { message: /Citizens cannot access organizational tenancy workflows/ }
    );

    const authorized = await getAuthorizedOrganizationIds(citizenPrincipal);
    assert.deepEqual(authorized, []);
  });

  it('returns strictly scoped authorized organization IDs for principals', async () => {
    const hospitalAOrgs = await getAuthorizedOrganizationIds(hospitalAPrincipal);
    assert.deepEqual(hospitalAOrgs, [orgAId]);

    const hospitalBOrgs = await getAuthorizedOrganizationIds(hospitalBPrincipal);
    assert.deepEqual(hospitalBOrgs, [orgBId]);

    const providerCOrgs = await getAuthorizedOrganizationIds(providerCPrincipal);
    assert.deepEqual(providerCOrgs, [fleetOrgCId]);
  });

  it('assertResourceOrganization validates tenant boundaries and blocks cross-tenant access', () => {
    const authorizedForA = [orgAId];

    // Access to Org A resource: Allowed
    assert.doesNotThrow(() => {
      assertResourceOrganization({
        resourceOrganizationId: orgAId,
        authorizedOrgIds: authorizedForA,
      });
    });

    // Access to Org B resource with Org A credentials: Blocked
    assert.throws(
      () => {
        assertResourceOrganization({
          resourceOrganizationId: orgBId,
          authorizedOrgIds: authorizedForA,
        });
      },
      { message: /Resource belongs to another organization/ }
    );

    // Access to unassigned resource: Fails closed
    assert.throws(
      () => {
        assertResourceOrganization({
          resourceOrganizationId: undefined,
          authorizedOrgIds: authorizedForA,
        });
      },
      { message: /Resource has no organization assignment/ }
    );
  });

  it('scopeByOrganization generates a fail-closed MongoDB query filter', async () => {
    // Principal with active membership
    const filterA = await scopeByOrganization(hospitalAPrincipal, { status: 'ADMITTED' });
    assert.deepEqual(filterA, {
      organizationId: { $in: [new Types.ObjectId(orgAId)] },
      status: 'ADMITTED',
    });

    // Principal with NO membership: fails closed with non-matching query {_id: null}
    const stranger: AuthenticatedIdentity = {
      id: new Types.ObjectId().toString(),
      email: 'stranger@nowhere.test',
      role: 'HOSPITAL',
      accountStatus: 'ACTIVE',
    };
    const failClosedFilter = await scopeByOrganization(stranger, { isPublic: false });
    assert.deepEqual(failClosedFilter, {
      _id: null,
      isPublic: false,
    });
  });

  it('assertSameOrganization allows matching tenants and blocks cross-tenant resource combinations', () => {
    // Same tenant (Provider C ambulance + Provider C driver)
    assert.doesNotThrow(() => {
      assertSameOrganization(fleetOrgCId, fleetOrgCId);
    });

    // Conflicting tenants (Provider C ambulance + Provider D driver)
    assert.throws(
      () => {
        assertSameOrganization(fleetOrgCId, fleetOrgDId);
      },
      { message: /Resources belong to different organizations/ }
    );

    // Missing tenant assignment on either resource
    assert.throws(
      () => {
        assertSameOrganization(fleetOrgCId, undefined);
      },
      { message: /Both resources must have valid organization assignments/ }
    );
  });

  it('validates principal type compatibility with organization type upon membership assignment', async () => {
    // Attempting to add an AMBULANCE_PROVIDER to a HOSPITAL_NETWORK must be rejected
    await assert.rejects(
      async () => {
        await addPrincipalToOrganization({
          organizationId: orgAId,
          principalType: 'AMBULANCE_PROVIDER',
          principalId: new Types.ObjectId().toString(),
          role: 'PROVIDER_ADMIN',
          permissions: [],
        });
      },
      { message: /Hospital networks can only accept hospital principals/ }
    );

    // Attempting to add a HOSPITAL to an AMBULANCE_OPERATOR must be rejected
    await assert.rejects(
      async () => {
        await addPrincipalToOrganization({
          organizationId: fleetOrgCId,
          principalType: 'HOSPITAL',
          principalId: new Types.ObjectId().toString(),
          role: 'HOSPITAL_ADMIN',
          permissions: [],
        });
      },
      { message: /Ambulance operators can only accept ambulance provider and driver principals/ }
    );
  });

  it('allows platform ADMIN oversight across active organizations', async () => {
    const adminMembership = await requireOrganizationMembership({
      principal: platformAdminPrincipal,
      organizationId: orgAId,
      permission: 'any:permission',
    });

    assert.ok(adminMembership);
    assert.equal(adminMembership.role, 'ORG_ADMIN');

    const allAuthorized = await getAuthorizedOrganizationIds(platformAdminPrincipal);
    assert.ok(allAuthorized.includes(orgAId));
    assert.ok(allAuthorized.includes(orgBId));
    assert.ok(allAuthorized.includes(fleetOrgCId));
    assert.ok(allAuthorized.includes(fleetOrgDId));
    assert.equal(allAuthorized.includes(suspendedOrgId), false); // Suspended org excluded
  });

  it('createOrganization provisions new tenant with active lifecycle', async () => {
    const newOrg = await createOrganization({
      name: 'Delta Regional Care',
      type: 'HOSPITAL_NETWORK',
    });

    assert.ok(newOrg._id);
    assert.equal(newOrg.name, 'Delta Regional Care');
    assert.equal(newOrg.status, 'ACTIVE');

    await newOrg.deleteOne();
  });
});
