import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { DispatchJobModel } from '../models/DispatchJob.js';
import { AmbulanceModel } from '../models/Ambulance.js';
import { AmbulanceDriverModel } from '../models/AmbulanceDriver.js';

const apply = process.argv.includes('--apply');
const requiredIndexes = [
  { collection: DispatchJobModel.collection, name: 'dispatch_emergency_request_unique', key: { emergencyRequestId: 1 }, unique: true },
  { collection: DispatchJobModel.collection, name: 'dispatch_worker_queue', key: { status: 1, nextAttemptAt: 1, leaseUntil: 1, updatedAt: 1 } },
  { collection: DispatchJobModel.collection, name: 'dispatch_current_driver_state', key: { currentDriverId: 1, status: 1, deadlineAt: 1 } },
  { collection: DispatchJobModel.collection, name: 'dispatch_current_ambulance_state', key: { currentAmbulanceId: 1, status: 1 } },
  { collection: AmbulanceModel.collection, name: 'location_2dsphere', key: { location: '2dsphere' } },
  { collection: AmbulanceModel.collection, name: 'dispatchReservationId_1', key: { dispatchReservationId: 1 } },
  { collection: AmbulanceDriverModel.collection, name: 'dispatchReservationId_1', key: { dispatchReservationId: 1 } },
];

type IndexInfo = { name?: string; key: Record<string, unknown>; unique?: boolean };
const indexesFor = async <T extends { indexes: () => Promise<unknown[]> }>(collection: T): Promise<IndexInfo[]> => {
  try { return await collection.indexes() as IndexInfo[]; }
  catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 26) return [];
    throw error;
  }
};

try {
  await connectDatabase();
  const dispatchIndexes = await indexesFor(DispatchJobModel.collection);
  const duplicateGroups = await DispatchJobModel.collection.aggregate<{ count: number }>([
    { $match: { emergencyRequestId: { $exists: true } } },
    { $group: { _id: '$emergencyRequestId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: 'duplicateGroups' },
  ]).toArray();
  const duplicates = duplicateGroups[0]?.count ?? 0;
  if (duplicates > 0) throw new Error('Duplicate dispatch jobs exist for an emergency request. Resolve them manually before applying the unique index; no records were changed.');

  const plan = [];
  for (const item of requiredIndexes) {
    const existingIndexes = item.collection.collectionName === DispatchJobModel.collection.collectionName
      ? dispatchIndexes
      : await indexesFor(item.collection);
    const sameKey = existingIndexes.find((index) => JSON.stringify(index.key) === JSON.stringify(item.key));
    if (sameKey && item.unique && sameKey.unique !== true) {
      throw new Error(`Index key for ${item.name} already exists without the required unique option. Review manually; this script will not drop or replace indexes.`);
    }
    const exists = Boolean(sameKey && (!item.unique || sameKey.unique === true));
    plan.push({ collection: item.collection.collectionName, name: item.name, exists, create: !exists });
  }
  console.info(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', duplicateDispatchJobGroups: duplicates, indexes: plan }, null, 2));
  if (apply) {
    for (const item of requiredIndexes) {
      const existingIndexes = await indexesFor(item.collection);
      const sameKey = existingIndexes.find((index) => JSON.stringify(index.key) === JSON.stringify(item.key));
      if (sameKey && (!item.unique || sameKey.unique === true)) continue;
      await item.collection.createIndex(item.key as unknown as import('mongodb').IndexSpecification, { name: item.name, ...(item.unique ? { unique: true } : {}) });
    }
    console.info('Dispatch indexes are installed.');
  } else {
    console.info('Dry run only. Review the index plan, then re-run with --apply in an authorized deployment environment.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Dispatch index check failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
