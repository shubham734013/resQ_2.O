import mongoose from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { HospitalModel } from '../models/Hospital.js';

const run = async (): Promise<void> => {
  await connectDatabase();
  try {
    const collection = HospitalModel.collection;
    const [total, accountStates, verificationStates, emergencyStates, coordinateStats, indexDefinitions] = await Promise.all([
      collection.countDocuments({}),
      collection.aggregate([{ $group: { _id: { $ifNull: ['$accountStatus', 'MISSING'] }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
      collection.aggregate([{ $group: { _id: { $ifNull: ['$verificationStatus', 'MISSING'] }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
      collection.aggregate([{ $group: { _id: { $ifNull: ['$emergencyAvailability', 'MISSING'] }, count: { $sum: 1 } } }, { $sort: { _id: 1 } }]).toArray(),
      collection.aggregate([
        { $project: {
          lat: '$latitude', lng: '$longitude', coords: '$location.coordinates',
          validLegacy: { $and: [{ $isNumber: '$latitude' }, { $gte: ['$latitude', -90] }, { $lte: ['$latitude', 90] }, { $isNumber: '$longitude' }, { $gte: ['$longitude', -180] }, { $lte: ['$longitude', 180] }] },
          validGeo: { $and: [{ $isArray: '$location.coordinates' }, { $eq: [{ $size: { $cond: [{ $isArray: '$location.coordinates' }, '$location.coordinates', []] } }, 2] }, { $isNumber: { $arrayElemAt: ['$location.coordinates', 0] } }, { $isNumber: { $arrayElemAt: ['$location.coordinates', 1] } }] }
        }},
        { $group: {
          _id: null, withLegacyCoordinates: { $sum: { $cond: ['$validLegacy', 1, 0] } },
          withGeoJsonCoordinates: { $sum: { $cond: ['$validGeo', 1, 0] } },
          missingGeoJsonButValidLegacy: { $sum: { $cond: { if: { $and: ['$validLegacy', { $not: ['$validGeo'] }] }, then: 1, else: 0 } } },
          invalidLegacyCoordinates: { $sum: { $cond: { if: { $and: [{ $or: [{ $ne: ['$lat', null] }, { $ne: ['$lng', null] }] }, { $not: ['$validLegacy'] }] }, then: 1, else: 0 } } }
        }}
      ]).toArray(),
      collection.indexes()
    ]);
    const activeVerified = await collection.countDocuments({ accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED' });
    const searchable = await collection.countDocuments({
      accountStatus: 'ACTIVE', verificationStatus: 'VERIFIED',
      'location.type': 'Point',
      'location.coordinates.0': { $type: 'number', $gte: -180, $lte: 180 },
      'location.coordinates.1': { $type: 'number', $gte: -90, $lte: 90 }
    });
    const report = {
      mode: 'READ_ONLY_DIAGNOSTIC_DRY_RUN',
      timestamp: new Date().toISOString(),
      databaseName: mongoose.connection.name,
      collections: { hospitals: { name: collection.collectionName, total, activeVerified, activeVerifiedWithGeoJsonCoordinates: searchable } },
      accountStates, verificationStates, emergencyStates,
      coordinateStats: coordinateStats[0] ?? { withLegacyCoordinates: 0, withGeoJsonCoordinates: 0, missingGeoJsonButValidLegacy: 0, invalidLegacyCoordinates: 0 },
      indexes: indexDefinitions.map((index) => ({ name: index.name, key: index.key, unique: Boolean(index.unique), sparse: Boolean(index.sparse), expireAfterSeconds: index.expireAfterSeconds ?? null })),
      proposedActions: [
        'Review records with valid latitude/longitude but missing valid GeoJSON location; no records were modified.',
        'Review invalid or contradictory coordinate pairs; do not infer or geocode replacements automatically.',
        'Compare reported index definitions with facility query patterns before proposing any index changes.',
        'Never alter accountStatus or verificationStatus automatically.'
      ]
    };
    process.stdout.write(JSON.stringify(report, null, 2) + '\\n');
  } finally {
    await disconnectDatabase();
  }
};

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown database diagnostic failure';
  process.stderr.write(JSON.stringify({ mode: 'READ_ONLY_DIAGNOSTIC_DRY_RUN', error: message }) + '\\n');
  process.exitCode = 1;
});
