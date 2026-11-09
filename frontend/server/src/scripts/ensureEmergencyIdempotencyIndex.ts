import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { EmergencyRequestModel } from '../models/EmergencyRequest.js';

const apply = process.argv.includes('--apply');
const collection = EmergencyRequestModel.collection;
const indexName = 'emergency_idempotency_key_unique';

try {
  await connectDatabase();
  const indexes = await collection.indexes();
  const existing = indexes.find((index) => index.name === indexName);
  const duplicateGroups = await collection.aggregate<{ _id: string; count: number }>([
    { $match: { idempotencyKey: { $type: 'string' } } },
    { $group: { _id: '$idempotencyKey', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicateKeyGroups' },
  ]).toArray();
  const duplicateKeyGroups = duplicateGroups[0]?.count ?? 0;
  const correct = Boolean(existing && existing.unique === true && existing.sparse === true && existing.key?.idempotencyKey === 1);

  console.info(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    collection: collection.collectionName,
    indexName,
    indexAlreadyCorrect: correct,
    duplicateKeyGroups,
    actionRequired: !correct,
  }, null, 2));

  if (existing && !correct) {
    throw new Error('An index with the expected name exists but has a different definition. Review it manually; this script will not drop or replace indexes.');
  }
  if (duplicateKeyGroups > 0) {
    throw new Error('Duplicate idempotency keys exist. Resolve them manually before creating a unique index; no records were changed.');
  }
  if (!apply || correct) {
    console.info(correct ? 'Idempotency index is ready.' : 'Dry run only. Re-run with --apply in an authorized deployment environment to create the index.');
  } else {
    await collection.createIndex({ idempotencyKey: 1 }, { unique: true, sparse: true, name: indexName });
    console.info('Created the emergency idempotency index.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Emergency idempotency index check failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
