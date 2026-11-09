import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import mongoose from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { app } from '../app.js';
import { UserModel } from '../models/User.js';
import { AuthSessionModel } from '../models/AuthSession.js';
import { initiatePasswordReset, completePasswordReset } from '../services/authService.js';
import type { MailMessage } from '../services/mailer.js';

const TEST_PASSWORD = 'Original-Password-123';
const NEW_PASSWORD = 'Replacement-Password-456';

const createUser = async (email: string) => {
  const bcrypt = (await import('bcrypt')).default;
  return UserModel.create({
    name: 'Reset Test User',
    email,
    phone: `97${Date.now().toString().slice(-8)}`,
    passwordHash: await bcrypt.hash(TEST_PASSWORD, 10),
    accountStatus: 'ACTIVE',
    role: 'USER',
  });
};

describe('Password reset security workflow', () => {
  const sentMail: MailMessage[] = [];
  const captureMail = async (message: MailMessage) => { sentMail.push(message); };
  const lastMail = (): MailMessage => {
    const message = sentMail[sentMail.length - 1];
    assert.ok(message, 'expected at least one sent email');
    return message;
  };
  const extractToken = (message: MailMessage): string => {
    const match = /[?&]token=([a-f0-9]{64})/.exec(message.text);
    assert.ok(match?.[1], 'reset email must contain a one-time token link');
    return match[1];
  };

  before(async () => {
    await connectTestDatabase();
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it('delivers the raw token only via email and stores only its hash', async () => {
    const email = `reset-${Date.now()}@test.com`;
    const user = await createUser(email);
    sentMail.length = 0;

    const result = await initiatePasswordReset(email, captureMail);

    assert.equal(result, undefined, 'service must not return the raw token');
    assert.equal(sentMail.length, 1, 'exactly one reset email must be sent');
    assert.equal(lastMail().to, email);
    const token = extractToken(lastMail());

    const stored = await UserModel.findById(user._id).select('+passwordResetTokenHash +passwordResetExpiresAt').exec();
    assert.ok(stored?.passwordResetTokenHash, 'token hash must be stored');
    assert.notEqual(stored?.passwordResetTokenHash, token, 'raw token must never be stored');
    assert.ok(stored?.passwordResetExpiresAt && stored.passwordResetExpiresAt.getTime() > Date.now());
  });

  it('sends no email and stores nothing for unknown accounts', async () => {
    sentMail.length = 0;
    await initiatePasswordReset(`nobody-${Date.now()}@test.com`, captureMail);
    assert.equal(sentMail.length, 0);
  });

  it('completes a reset, rejects the old password, and invalidates sessions', async () => {
    const email = `reset-flow-${Date.now()}@test.com`;
    const user = await createUser(email);
    await AuthSessionModel.create({
      accountId: user._id.toString(),
      role: 'USER',
      tokenId: `test-session-${Date.now()}`,
      tokenHash: 'x'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
    });
    sentMail.length = 0;

    await initiatePasswordReset(email, captureMail);
    const token = extractToken(lastMail());

    await completePasswordReset(token, NEW_PASSWORD);

    const updated = await UserModel.findById(user._id).select('+passwordHash +passwordResetTokenHash').exec();
    const bcrypt = (await import('bcrypt')).default;
    assert.ok(await bcrypt.compare(NEW_PASSWORD, updated!.passwordHash!), 'new password must work');
    assert.ok(!(await bcrypt.compare(TEST_PASSWORD, updated!.passwordHash!)), 'old password must fail');
    assert.equal(updated!.passwordResetTokenHash, undefined, 'token must be single-use');

    const sessions = await AuthSessionModel.countDocuments({ accountId: user._id.toString() });
    assert.equal(sessions, 0, 'all sessions must be invalidated after password change');
  });

  it('rejects token replay', async () => {
    const email = `reset-replay-${Date.now()}@test.com`;
    await createUser(email);
    sentMail.length = 0;
    await initiatePasswordReset(email, captureMail);
    const token = extractToken(lastMail());

    await completePasswordReset(token, NEW_PASSWORD);
    await assert.rejects(
      () => completePasswordReset(token, 'Another-Password-789'),
      /invalid or has expired/i,
    );
  });

  it('rejects expired tokens', async () => {
    const email = `reset-expired-${Date.now()}@test.com`;
    const user = await createUser(email);
    sentMail.length = 0;
    await initiatePasswordReset(email, captureMail);
    const token = extractToken(lastMail());

    await UserModel.updateOne({ _id: user._id }, { $set: { passwordResetExpiresAt: new Date(Date.now() - 1000) } });
    await assert.rejects(
      () => completePasswordReset(token, NEW_PASSWORD),
      /invalid or has expired/i,
    );
  });

  it('rejects malformed tokens', async () => {
    await assert.rejects(() => completePasswordReset('short', NEW_PASSWORD), /invalid or has expired/i);
    await assert.rejects(() => completePasswordReset('', NEW_PASSWORD), /invalid or has expired/i);
  });
});

describe('Password reset HTTP API', () => {
  let server: Server;
  let baseUrl: string;

  const post = async (path: string, body: unknown) => {
    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() as Record<string, unknown> };
  };

  before(async () => {
    await connectTestDatabase();
    server = app.listen(0);
    await new Promise<void>((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await mongoose.disconnect();
  });

  it('never returns the raw reset token and stays generic for unknown accounts', async () => {
    const email = `reset-http-${Date.now()}@test.com`;
    await createUser(email);

    const known = await post('/api/v1/auth/forgot-password', { email });
    const unknown = await post('/api/v1/auth/forgot-password', { email: `unknown-${Date.now()}@test.com` });

    for (const res of [known, unknown]) {
      assert.equal(res.status, 200);
      const data = res.body.data as Record<string, unknown>;
      assert.ok(typeof data.message === 'string');
      assert.equal('resetToken' in data, false, 'API must never return the raw reset token');
      assert.equal('expiresAt' in data, false);
      assert.equal('token' in data, false);
    }
    assert.deepEqual(known.body, unknown.body, 'responses must be identical for known and unknown accounts');
  });

  it('rejects invalid reset tokens with a generic 400', async () => {
    const res = await post('/api/v1/auth/reset-password', {
      token: 'a'.repeat(64),
      password: NEW_PASSWORD,
    });
    assert.equal(res.status, 400);
    const error = res.body.error as { code: string };
    assert.equal(error.code, 'INVALID_RESET_TOKEN');
  });
});
