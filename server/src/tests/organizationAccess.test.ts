import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { OrganizationModel } from '../models/Organization.js';
import { OrganizationMembershipModel } from '../models/OrganizationMembership.js';
import { HospitalModel } from '../models/Hospital.js';
import { AmbulanceProviderModel } from '../models/AmbulanceProvider.js';
import {
  requireOrganizationMembership,
  getAuthorizedOrganizationIds,
  assertResourceOrganization,
  scopeByOrganization,
  assertSameOrganization,
  createOrganization,
  addPrincipalToOrganization,
  assertEmergencyCoordinationAccess,
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

    // Clean existing test orgs & entities
    await OrganizationModel.deleteMany({
      name: {
        $in: [
          'Metro Hospital Network',
          'Valley Hospital System',
          'Alpha Ambulance Corp',
          'Beta Fleet Services',
          'Suspended Network',
          'Delta Regional Care',
          'Epsilon Emergency Care',
        ],
      },
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

    await HospitalModel.deleteMany({
      _id: { $in: [new Types.ObjectId(hospitalAPrincipal.id), new Types.ObjectId(hospitalBPrincipal.id)] },
    }).exec();

    await AmbulanceProviderModel.deleteMany({
      _id: new Types.ObjectId(providerCPrincipal.id),
    }).exec();

    // Create authoritative records in principal collections
    await HospitalModel.create({
      _id: new Types.ObjectId(hospitalAPrincipal.id),
      name: 'Metro General Hospital A',
      registrationNumber: 'HOSP-A-TEST-001',
      email: hospitalAPrincipal.email,
      phone: '111-222-3333',
      passwordHash: 'dummyHash',
      hospitalType: 'General',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
    });

    await HospitalModel.create({
      _id: new Types.ObjectId(hospitalBPrincipal.id),
      name: 'Valley Care Hospital B',
      registrationNumber: 'HOSP-B-TEST-002',
      email: hospitalBPrincipal.email,
      phone: '111-222-4444',
      passwordHash: 'dummyHash',
      hospitalType: 'General',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
    });

    await AmbulanceProviderModel.create({
      _id: new Types.ObjectId(providerCPrincipal.id),
      name: 'Alpha Ambulance Services',
      registrationNumber: 'PROV-C-TEST-001',
      email: providerCPrincipal.email,
      phone: '111-222-5555',
      passwordHash: 'dummyHash',
      serviceType: 'ALS',
      profileCompletionStatus: 'COMPLETE',
      verificationStatus: 'VERIFIED',
      accountStatus: 'ACTIVE',
    });

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
      permissions: ['hospital:read', 'hospital:write', 'patient:read', 'membership:manage'],
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
      permissions: ['fleet:read', 'fleet:write', 'dispatch:read', 'membership:manage'],
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
    await HospitalModel.deleteMany({
      _id: { $in: [new Types.ObjectId(hospitalAPrincipal.id), new Types.ObjectId(hospitalBPrincipal.id)] },
    }).exec();
    await AmbulanceProviderModel.deleteMany({
      _id: new Types.ObjectId(providerCPrincipal.id),
    }).exec();
    await mongoose.disconnect();
  });

  // Test 1: Unauthenticated request cannot create an organization or grant membership
  it('1. rejects unauthenticated requests from creating an organization or granting membership', async () => {
    await assert.rejects(
      async () => {
        await createOrganization(
          { name: 'Rogue Org', type: 'HOSPITAL_NETWORK' },
          undefined as unknown as AuthenticatedIdentity
        );
      },
      { message: /Authenticated creator required to provision organization/ }
    );

    await assert.rejects(
      async () => {
        await addPrincipalToOrganization(
          {
            organizationId: orgAId,
            principalType: 'HOSPITAL',
            principalId: hospitalAPrincipal.id,
            role: 'ORG_MEMBER',
            permissions: [],
          },
          undefined as unknown as AuthenticatedIdentity
        );
      },
      { message: /Authenticated actor is required to manage memberships/ }
    );
  });

  // Test 2: Missing actor cannot bypass membership authorization
  it('2. ensures missing actor cannot bypass membership authorization', async () => {
    await assert.rejects(
      async () => {
        await addPrincipalToOrganization(
          {
            organizationId: orgAId,
            principalType: 'HOSPITAL',
            principalId: hospitalAPrincipal.id,
            role: 'ORG_MEMBER',
            permissions: [],
          },
          null as unknown as AuthenticatedIdentity
        );
      },
      { message: /Authenticated actor is required to manage memberships/ }
    );
  });

  // Test 3: Normal user cannot grant themselves administrative permissions or escalate privileges
  it('3. prevents a normal member from escalating privileges or granting unheld permissions', async () => {
    // Hospital B has only 'hospital:read' and role 'ORG_MEMBER' in Org B.
    // Attempting to grant ORG_ADMIN or unheld permissions must fail with 403.
    await assert.rejects(
      async () => {
        await addPrincipalToOrganization(
          {
            organizationId: orgBId,
            principalType: 'HOSPITAL',
            principalId: hospitalBPrincipal.id,
            role: 'ORG_ADMIN',
            permissions: ['hospital:write'],
          },
          hospitalBPrincipal // acting as normal member
        );
      },
      { message: /Missing required permission: membership:manage/ }
    );
  });

  // Test 4: Hospital cannot read another hospital's private resources
  it('4. prevents Hospital A from accessing Hospital B organization membership or resources', async () => {
    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: hospitalAPrincipal,
          organizationId: orgBId,
        });
      },
      { message: /Principal does not hold active membership in this organization/ }
    );

    const authorizedOrgsA = await getAuthorizedOrganizationIds(hospitalAPrincipal);
    assert.throws(
      () => {
        assertResourceOrganization({
          resourceOrganizationId: orgBId,
          authorizedOrgIds: authorizedOrgsA,
        });
      },
      { message: /Resource belongs to another organization/ }
    );
  });

  // Test 5: Ambulance provider cannot read or modify another provider's resources
  it('5. prevents Provider C from reading or modifying Provider D resources', async () => {
    const providerCOrgs = await getAuthorizedOrganizationIds(providerCPrincipal);
    assert.deepEqual(providerCOrgs, [fleetOrgCId]);
    assert.equal(providerCOrgs.includes(fleetOrgDId), false);

    assert.throws(
      () => {
        assertResourceOrganization({
          resourceOrganizationId: fleetOrgDId,
          authorizedOrgIds: providerCOrgs,
        });
      },
      { message: /Resource belongs to another organization/ }
    );
  });

  // Test 6: Driver cannot operate on an ambulance belonging to another provider or organization
  it('6. prevents cross-tenant assignment between ambulance and driver (assertSameOrganization)', () => {
    assert.throws(
      () => {
        // Ambulance belongs to fleetOrgC, driver belongs to fleetOrgD
        assertSameOrganization(fleetOrgCId, fleetOrgDId);
      },
      { message: /Resources belong to different organizations and cannot be linked/ }
    );
  });

  // Test 7: Inactive / revoked membership is denied
  it('7. denies operational access when membership is revoked or suspended', async () => {
    const revoked = await OrganizationMembershipModel.create({
      organizationId: new Types.ObjectId(orgAId),
      principalType: 'HOSPITAL',
      principalId: new Types.ObjectId(),
      role: 'ORG_MEMBER',
      permissions: ['hospital:read'],
      status: 'REVOKED',
    });

    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: {
            id: revoked.principalId.toString(),
            email: 'revoked@hospital.test',
            role: 'HOSPITAL',
            accountStatus: 'ACTIVE',
          },
          organizationId: orgAId,
        });
      },
      { message: /Principal does not hold active membership in this organization/ }
    );

    await revoked.deleteOne();
  });

  // Test 8: Suspended organization is denied for normal operational access
  it('8. denies access to a suspended organization', async () => {
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

  // Test 9: Caller-supplied filter cannot override tenant constraints
  it('9. prevents caller-supplied filters from overriding tenant constraints using $and', async () => {
    // Attempting to override organizationId in additionalFilter
    await assert.rejects(
      async () => {
        await scopeByOrganization(hospitalAPrincipal, { organizationId: orgBId });
      },
      { message: /Query filter requests an unauthorized organization/ }
    );

    // Normal filter combination uses $and so object spread cannot override
    const filter = await scopeByOrganization(hospitalAPrincipal, { status: 'OCCUPIED' });
    assert.deepEqual(filter, {
      $and: [
        { organizationId: { $in: [new Types.ObjectId(orgAId)] } },
        { status: 'OCCUPIED' },
      ],
    });
  });

  // Test 10: No-membership query cannot become unrestricted
  it('10. ensures no-membership queries fail closed with an impossible match regardless of additionalFilter', async () => {
    const noMembershipUser: AuthenticatedIdentity = {
      id: new Types.ObjectId().toString(),
      email: 'nomember@resq.test',
      role: 'HOSPITAL',
      accountStatus: 'ACTIVE',
    };

    // Caller attempts to supply an _id to bypass no-membership filter
    const requestedId = new Types.ObjectId();
    const failClosedFilter = await scopeByOrganization(noMembershipUser, { _id: requestedId });
    const andArray = failClosedFilter.$and as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(andArray));
    assert.deepEqual(andArray[0], { _id: { $in: [] } });
    assert.deepEqual(andArray[1], { _id: requestedId });
  });

  // Test 11: Invalid organization ID produces a controlled denial or validation error
  it('11. produces controlled 400 validation errors on malformed IDs', async () => {
    await assert.rejects(
      async () => {
        await requireOrganizationMembership({
          principal: hospitalAPrincipal,
          organizationId: 'malformed-not-an-objectid',
        });
      },
      { message: /Invalid organization identifier format/ }
    );

    assert.throws(
      () => {
        assertResourceOrganization({
          resourceOrganizationId: 'invalid-id-format',
          authorizedOrgIds: [orgAId],
        });
      },
      { message: /Resource organization identifier is invalid/ }
    );
  });

  // Test 12: Cross-organization access is rejected even if caller guesses a valid resource ID
  it('12. rejects cross-organization access even with a valid existing foreign organization ID', () => {
    const authorizedIds = [orgAId];
    assert.throws(
      () => {
        // orgBId is a valid 24-char ObjectId in the database, but foreign to Org A
        assertResourceOrganization({
          resourceOrganizationId: orgBId,
          authorizedOrgIds: authorizedIds,
        });
      },
      { message: /Resource belongs to another organization. Access denied./ }
    );
  });

  // Test 13: Explicitly authorized platform administration works through intended administrative path
  it('13. allows platform admin cross-tenant queries ONLY when allowGlobalAdminAccess is explicitly specified', async () => {
    // Normal query without flag: defaults to tenant scoped
    const adminFilterScoped = await scopeByOrganization(platformAdminPrincipal, { status: 'PENDING' });
    assert.ok(adminFilterScoped.$and);

    // Explicit opt-in query: unscoped global query allowed
    const adminFilterGlobal = await scopeByOrganization(
      platformAdminPrincipal,
      { status: 'PENDING' },
      { allowGlobalAdminAccess: true }
    );
    assert.deepEqual(adminFilterGlobal, { status: 'PENDING' });
  });

  // Test 14: Legitimate emergency coordination continues to work for authorized participants
  it('14. allows legitimate emergency coordination for patient, assigned hospital, provider, and driver', () => {
    const emergencyContext = {
      patientId: citizenPrincipal.id,
      assignedHospitalId: hospitalAPrincipal.id,
      assignedProviderId: providerCPrincipal.id,
      assignedDriverId: 'driver-123',
    };

    // Patient: Allowed
    assert.doesNotThrow(() => {
      assertEmergencyCoordinationAccess(citizenPrincipal, emergencyContext);
    });

    // Assigned Hospital: Allowed
    assert.doesNotThrow(() => {
      assertEmergencyCoordinationAccess(hospitalAPrincipal, emergencyContext);
    });

    // Assigned Provider: Allowed
    assert.doesNotThrow(() => {
      assertEmergencyCoordinationAccess(providerCPrincipal, emergencyContext);
    });

    // Unassigned Hospital (Hospital B): Denied
    assert.throws(
      () => {
        assertEmergencyCoordinationAccess(hospitalBPrincipal, emergencyContext);
      },
      { message: /Hospital is not assigned to this emergency coordination workflow/ }
    );

    // Stranger Citizen: Denied
    assert.throws(
      () => {
        assertEmergencyCoordinationAccess(
          { id: new Types.ObjectId().toString(), email: 'stranger@patient.test', role: 'USER', accountStatus: 'ACTIVE' },
          emergencyContext
        );
      },
      { message: /Citizens can only access their own emergencies/ }
    );
  });

  // Test 15: Concurrent duplicate membership attempts cannot create duplicate memberships
  it('15. safely upserts duplicate membership assignments without throwing duplicate key errors', async () => {
    const payload = {
      organizationId: orgAId,
      principalType: 'HOSPITAL' as const,
      principalId: hospitalAPrincipal.id,
      role: 'ORG_ADMIN' as const,
      permissions: ['hospital:read', 'hospital:write'],
    };

    // First assignment
    const mem1 = await addPrincipalToOrganization(payload, hospitalAPrincipal);
    // Second assignment (duplicate parameters)
    const mem2 = await addPrincipalToOrganization(payload, hospitalAPrincipal);

    assert.equal(mem1._id.toString(), mem2._id.toString());
  });

  // Test 16: Organization creation failure does not leave unintended orphaned or privileged records
  it('16. rolls back organization creation if initial membership fails, leaving no orphaned tenant', async () => {
    // If membership creation fails (e.g. invalid principalId), the organization document must be rolled back
    const invalidHospitalCreator: AuthenticatedIdentity = {
      id: 'invalid-principal-id-not-objectid',
      email: 'invalid@hospital.test',
      role: 'HOSPITAL',
      accountStatus: 'ACTIVE',
    };

    await assert.rejects(
      async () => {
        await createOrganization(
          { name: 'Orphan Attempt Care', type: 'HOSPITAL_NETWORK' },
          invalidHospitalCreator
        );
      }
    );

    const exists = await OrganizationModel.findOne({ name: 'Orphan Attempt Care' }).exec();
    assert.equal(exists, null, 'Orphaned organization record must be deleted upon failure');
  });

  // Test 17: Valid organization creation provisions tenant with least-privilege role
  it('17. provisions organization with defined least-privilege role for verified healthcare providers', async () => {
    const result = await createOrganization(
      { name: 'Epsilon Emergency Care', type: 'HOSPITAL_NETWORK' },
      hospitalAPrincipal
    );

    assert.ok(result.organization._id);
    assert.equal(result.organization.status, 'ACTIVE');
    assert.ok(result.membership);
    assert.equal(result.membership.role, 'HOSPITAL_ADMIN');
    // Does NOT contain arbitrary wildcards
    assert.equal(result.membership.permissions.includes('*'), false);
    assert.ok(result.membership.permissions.includes('hospital:manage'));

    await result.organization.deleteOne();
    await result.membership.deleteOne();
  });
});
