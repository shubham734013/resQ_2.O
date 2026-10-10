import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { TripModel } from '../models/Trip.js';

const apply = process.argv.includes('--apply');
const activeStatuses = ['ASSIGNED', 'ACCEPTED', 'TO_PICKUP', 'AT_PICKUP', 'PATIENT_ONBOARD', 'TO_HOSPITAL', 'AT_HOSPITAL'];
type IndexInfo = { name?: string; key: Record<string, unknown>; unique?: boolean; partialFilterExpression?: Record<string, unknown> };

try {
  await connectDatabase();
  const collection = TripModel.collection;
  const indexes = await collection.indexes() as IndexInfo[];
  const duplicates = await collection.aggregate<{ _id: unknown; count: number }>([
    { $match: { status: { $in: activeStatuses } } },
    { $group: { _id: '$emergencyRequestId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]).toArray();
  if (duplicates.length) throw new Error('Multiple active trips exist for an emergency. Resolve these records manually before applying the index; no records were changed.');

  const targetName = 'trip_one_active_per_emergency';
  const target = indexes.find((index) => index.name === targetName);
  const oldUnique = indexes.filter((index) => index.unique && JSON.stringify(index.key) === JSON.stringify({ emergencyRequestId: 1 }) && index.name !== targetName);
  const plan = {
    mode: apply ? 'apply' : 'dry-run',
    collection: collection.collectionName,
    activeTripStatuses: activeStatuses,
    duplicateActiveEmergencyGroups: duplicates.length,
    existingUniqueIndexesToReplace: oldUnique.map((index) => index.name),
    activeTripUniqueIndexExists: Boolean(target),
    changes: target ? [] : ['Drop the legacy unique emergencyRequestId index (after duplicate check)', 'Create a partial unique index allowing historical cancelled/completed trips but only one active trip per emergency'],
  };
  console.info(JSON.stringify(plan, null, 2));
  if (apply && !target) {
    for (const index of oldUnique) {
      if (!index.name) throw new Error('Found an unnamed unique index; refusing to modify it automatically.');
      await collection.dropIndex(index.name);
    }
    await collection.createIndex({ emergencyRequestId: 1 }, {
      name: targetName,
      unique: true,
      partialFilterExpression: { status: { $in: activeStatuses } },
    });
    console.info('Active-trip uniqueness index installed.');
  } else if (!apply) {
    console.info('Dry run only. Review the plan, then run with --apply in an authorized deployment environment.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Trip reassignment index migration failed.');
  process.exitCode = 1;
} finally {
  await disconnectDatabase();
}
