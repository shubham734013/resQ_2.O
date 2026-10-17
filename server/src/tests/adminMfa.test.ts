import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { connectTestDatabase } from '../config/testDatabase.js';
import { UserModel } from '../models/User.js';
import {
  adminLogin,
  verifyAdminMfaLogin,
  setupAdminMfa,
  confirmAdminMfaSetup,
  disableAdminMfa,
  getAdminMfaStatus,
} from '../services/authService.js';
import { generateTotpCode } from '../utils/totp.js';
import { env } from '../config/env.js';

describe('Admin Two-Factor Authentication (TOTP MFA) Workflow', () => {
  const adminEmail = env.RESQ_ADMIN_EMAIL;
  const adminPassword = env.RESQ_ADMIN_PASSWORD;

  before(async () => {
    await connectTestDatabase();
    // Ensure admin user exists with clean state
    await UserModel.deleteMany({ email: adminEmail.toLowerCase() }).exec();
    await UserModel.create({
      name: 'ResQ Master Admin',
      email: adminEmail.toLowerCase(),
      passwordHash: await bcrypt.hash(adminPassword, 10),
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
      emailVerified: true,
      phoneVerified: true,
      mfaEnabled: false,
    });
  });

  after(async () => {
    await UserModel.deleteMany({ email: adminEmail.toLowerCase() }).exec();
    await mongoose.disconnect();
  });

  it('admin login without MFA returns mfaSetupRequired=true and mfaSetupToken (no session tokens)', async () => {
    const res = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(res.mfaRequired, false);
    if (!res.mfaRequired && res.mfaSetupRequired) {
      assert.equal(res.mfaSetupRequired, true);
      // AUTH-02: Must NOT receive full auth tokens; only a restricted setup token.
      assert.ok(res.mfaSetupToken, 'Should receive mfaSetupToken');
      assert.equal('accessToken' in res, false, 'Must NOT receive accessToken before MFA enrollment');
      assert.equal(res.user.role, 'ADMIN');
    }
  });

  it('generates MFA setup secret, otpauth URI, and 8 recovery codes', async () => {
    const adminUser = await UserModel.findOne({ email: adminEmail.toLowerCase() }).exec();
    assert.ok(adminUser);

    const setup = await setupAdminMfa({
      id: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });

    assert.ok(setup.secret);
    assert.match(setup.secret, /^[A-Z2-7]+$/);
    assert.ok(setup.otpauthUri.startsWith('otpauth://totp/ResQ:'));
    assert.equal(setup.recoveryCodes.length, 8);
  });

  it('rejects confirmation with an invalid TOTP code', async () => {
    const adminUser = await UserModel.findOne({ email: adminEmail.toLowerCase() }).exec();
    assert.ok(adminUser);

    await assert.rejects(
      async () => {
        await confirmAdminMfaSetup(
          {
            id: adminUser._id.toString(),
            email: adminUser.email,
            name: adminUser.name,
            role: 'ADMIN',
            accountStatus: 'ACTIVE',
          },
          '000000'
        );
      },
      { message: /Verification code does not match the generated TOTP secret/ }
    );
  });

  it('confirms setup with a valid TOTP code and enables MFA', async () => {
    const adminUser = await UserModel.findOne({ email: adminEmail.toLowerCase() })
      .select('+mfaPendingSecret')
      .exec();
    assert.ok(adminUser?.mfaPendingSecret);

    const validCode = generateTotpCode(adminUser.mfaPendingSecret);
    const confirmRes = await confirmAdminMfaSetup(
      {
        id: adminUser._id.toString(),
        email: adminUser.email,
        name: adminUser.name,
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      },
      validCode
    );

    assert.equal(confirmRes.success, true);
    assert.equal(confirmRes.recoveryCodesCount, 8);

    const status = await getAdminMfaStatus({
      id: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });
    assert.equal(status.mfaEnabled, true);
    assert.equal(status.recoveryCodesRemaining, 8);
  });

  it('requires MFA challenge token on login once enabled', async () => {
    const res = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(res.mfaRequired, true);
    if (res.mfaRequired) {
      assert.ok(res.mfaToken);
      assert.equal(typeof res.mfaToken, 'string');
      assert.equal(res.user.role, 'ADMIN');
    }
  });

  it('rejects invalid TOTP verification during MFA login', async () => {
    const loginRes = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(loginRes.mfaRequired, true);
    if (!loginRes.mfaRequired) return;

    await assert.rejects(
      async () => {
        await verifyAdminMfaLogin({
          mfaToken: loginRes.mfaToken,
          code: '123456',
        });
      },
      { message: /Invalid 6-digit verification code/ }
    );
  });

  it('completes login with a valid TOTP code', async () => {
    const loginRes = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(loginRes.mfaRequired, true);
    if (!loginRes.mfaRequired) return;

    const admin = await UserModel.findOne({ email: adminEmail.toLowerCase() })
      .select('+mfaSecret')
      .exec();
    assert.ok(admin?.mfaSecret);

    const validCode = generateTotpCode(admin.mfaSecret);
    const authResult = await verifyAdminMfaLogin({
      mfaToken: loginRes.mfaToken,
      code: validCode,
    });

    assert.ok(authResult.accessToken);
    assert.ok(authResult.refreshToken);
    assert.equal(authResult.user.role, 'ADMIN');
  });

  it('prevents replay of the same TOTP code within the same window', async () => {
    // Reset mfaLastUsedWindow so this test can independently demonstrate:
    // 1. First-use of valid code succeeds
    // 2. Replay of same code in same window is rejected
    await UserModel.updateOne(
      { email: adminEmail.toLowerCase() },
      { $unset: { mfaLastUsedWindow: 1 } }
    ).exec();

    // First login attempt — obtain a challenge token.
    const loginRes1 = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(loginRes1.mfaRequired, true);
    if (!loginRes1.mfaRequired) return;

    const admin = await UserModel.findOne({ email: adminEmail.toLowerCase() })
      .select('+mfaSecret')
      .exec();
    assert.ok(admin?.mfaSecret);

    const validCode = generateTotpCode(admin.mfaSecret);

    // First use of the code MUST succeed.
    const firstResult = await verifyAdminMfaLogin({
      mfaToken: loginRes1.mfaToken,
      code: validCode,
    });
    assert.ok(firstResult.accessToken, 'First use of valid code should succeed');

    // Second use of the SAME code in the SAME 30-second window MUST be rejected.
    const loginRes2 = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(loginRes2.mfaRequired, true);
    if (!loginRes2.mfaRequired) return;

    await assert.rejects(
      async () => {
        await verifyAdminMfaLogin({
          mfaToken: loginRes2.mfaToken,
          code: validCode, // exact same code / same time-step
        });
      },
      { message: /Verification code has already been used/ }
    );
  });

  it('allows login using a recovery code and consumes it', async () => {
    const adminUser = await UserModel.findOne({ email: adminEmail.toLowerCase() }).exec();
    assert.ok(adminUser);

    // Re-enroll to get fresh recovery codes
    const setup = await setupAdminMfa({
      id: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });
    const code = generateTotpCode(setup.secret);
    await confirmAdminMfaSetup(
      {
        id: adminUser._id.toString(),
        email: adminUser.email,
        name: adminUser.name,
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      },
      code
    );

    const recoveryCodeToUse = setup.recoveryCodes[0]!;

    const loginRes = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(loginRes.mfaRequired, true);
    if (!loginRes.mfaRequired) return;

    // Login using recovery code
    const authResult = await verifyAdminMfaLogin({
      mfaToken: loginRes.mfaToken,
      code: recoveryCodeToUse,
    });
    assert.ok(authResult.accessToken);

    // Verify recovery code count decreased
    const status = await getAdminMfaStatus({
      id: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });
    assert.equal(status.recoveryCodesRemaining, 7);

    // Attempting to reuse the same recovery code must fail
    const secondLogin = await adminLogin({ email: adminEmail, password: adminPassword });
    assert.equal(secondLogin.mfaRequired, true);
    if (!secondLogin.mfaRequired) return;

    await assert.rejects(
      async () => {
        await verifyAdminMfaLogin({
          mfaToken: secondLogin.mfaToken,
          code: recoveryCodeToUse,
        });
      },
      { message: /Invalid verification code or recovery code/ }
    );
  });

  it('disables MFA when correct password and valid code are provided', async () => {
    const adminUser = await UserModel.findOne({ email: adminEmail.toLowerCase() })
      .select('+mfaSecret')
      .exec();
    assert.ok(adminUser?.mfaSecret);

    const validCode = generateTotpCode(adminUser.mfaSecret);

    // Wrong password fails
    await assert.rejects(
      async () => {
        await disableAdminMfa(
          {
            id: adminUser._id.toString(),
            email: adminUser.email,
            name: adminUser.name,
            role: 'ADMIN',
            accountStatus: 'ACTIVE',
          },
          { password: 'WrongPassword!', code: validCode }
        );
      },
      { message: /Incorrect password/ }
    );

    // Correct password & code succeeds
    const disabledRes = await disableAdminMfa(
      {
        id: adminUser._id.toString(),
        email: adminUser.email,
        name: adminUser.name,
        role: 'ADMIN',
        accountStatus: 'ACTIVE',
      },
      { password: adminPassword, code: validCode }
    );
    assert.equal(disabledRes.disabled, true);

    const finalStatus = await getAdminMfaStatus({
      id: adminUser._id.toString(),
      email: adminUser.email,
      name: adminUser.name,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });
    assert.equal(finalStatus.mfaEnabled, false);
  });
});
