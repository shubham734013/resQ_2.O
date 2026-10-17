import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose, { Types } from 'mongoose';
import { connectTestDatabase } from '../config/testDatabase.js';
import { AuditLogModel } from '../models/AuditLog.js';

describe('AuditLog Immutability Enforcement (AUD-01)', () => {
  before(async () => {
    await connectTestDatabase();
  });

  after(async () => {
    await mongoose.disconnect();
  });

  it('allows appending new audit log entries', async () => {
    const entry = await AuditLogModel.create({
      actorId: new Types.ObjectId(),
      actorRole: 'ADMIN',
      action: 'SYSTEM_SETTINGS_UPDATE',
      entityType: 'USER',
      entityId: new Types.ObjectId(),
      reason: 'Routine compliance audit test',
    });

    assert.ok(entry._id);
    assert.equal(entry.action, 'SYSTEM_SETTINGS_UPDATE');
  });

  it('blocks updateOne from mutating existing audit log entries', async () => {
    const entry = await AuditLogModel.create({
      actorId: new Types.ObjectId(),
      actorRole: 'ADMIN',
      action: 'IMMUTABILITY_TEST',
      entityType: 'USER',
      entityId: new Types.ObjectId(),
    });

    await assert.rejects(
      async () => {
        await AuditLogModel.updateOne({ _id: entry._id }, { $set: { action: 'MUTATED_ACTION' } }).exec();
      },
      { message: /IMMUTABLE_AUDIT_LOG/ }
    );
  });

  it('blocks deleteOne from deleting audit log entries', async () => {
    const entry = await AuditLogModel.create({
      actorId: new Types.ObjectId(),
      actorRole: 'ADMIN',
      action: 'DELETE_TEST',
      entityType: 'USER',
      entityId: new Types.ObjectId(),
    });

    await assert.rejects(
      async () => {
        await AuditLogModel.deleteOne({ _id: entry._id }).exec();
      },
      { message: /IMMUTABLE_AUDIT_LOG/ }
    );
  });

  it('blocks findOneAndUpdate from modifying audit log entries', async () => {
    const entry = await AuditLogModel.create({
      actorId: new Types.ObjectId(),
      actorRole: 'ADMIN',
      action: 'FIND_ONE_AND_UPDATE_TEST',
      entityType: 'USER',
      entityId: new Types.ObjectId(),
    });

    await assert.rejects(
      async () => {
        await AuditLogModel.findOneAndUpdate({ _id: entry._id }, { $set: { reason: 'Tampered reason' } }).exec();
      },
      { message: /IMMUTABLE_AUDIT_LOG/ }
    );
  });

  it('blocks document save() from modifying existing audit logs', async () => {
    const entry = await AuditLogModel.create({
      actorId: new Types.ObjectId(),
      actorRole: 'ADMIN',
      action: 'DOC_SAVE_TEST',
      entityType: 'USER',
      entityId: new Types.ObjectId(),
    });

    entry.reason = 'Tampered via save';
    await assert.rejects(
      async () => {
        await entry.save();
      },
      { message: /IMMUTABLE_AUDIT_LOG/ }
    );
  });
});
