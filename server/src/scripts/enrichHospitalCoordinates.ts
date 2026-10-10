/**
 * ResQ Hospital Coordinate Enrichment Script
 *
 * Safely enriches hospital documents in MongoDB with verified coordinates
 * using the official Google Geocoding API.
 *
 * Rules:
 * - NEVER fabricates random, mock, or fake coordinates.
 * - Supports --dry-run (inspect without writing to MongoDB).
 * - Supports --limit <number> (batch processing).
 * - Validates coordinate ranges: lat in [-90, 90], lng in [-180, 180].
 * - Gracefully handles missing API key or REQUEST_DENIED (e.g. billing disabled).
 */
import mongoose from 'mongoose';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDatabase, disconnectDatabase, sanitizeMongoUri } from '../config/database.js';
import { env } from '../config/env.js';
import { HospitalModel } from '../models/Hospital.js';

export interface EnrichmentOptions {
  dryRun?: boolean;
  limit?: number;
}

export interface EnrichmentResult {
  dryRun: boolean;
  totalHospitals: number;
  needingCoordinates: number;
  attempted: number;
  enriched: number;
  skipped: number;
  failed: number;
  billingBlocked: boolean;
  notes: string[];
}

interface GoogleGeocodeResponse {
  status: string;
  error_message?: string;
  results?: Array<{
    formatted_address?: string;
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
      location_type?: string;
    };
  }>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function enrichHospitalCoordinates(options: EnrichmentOptions = {}): Promise<EnrichmentResult> {
  const isDryRun = Boolean(options.dryRun);
  const limit = options.limit && options.limit > 0 ? options.limit : Infinity;
  const apiKey = env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_GEOCODING_API_KEY;

  const result: EnrichmentResult = {
    dryRun: isDryRun,
    totalHospitals: 0,
    needingCoordinates: 0,
    attempted: 0,
    enriched: 0,
    skipped: 0,
    failed: 0,
    billingBlocked: false,
    notes: [],
  };

  if (mongoose.connection.readyState !== 1) {
    const msg = 'Database connection is not ready. Coordinate enrichment requires an active MongoDB connection.';
    result.notes.push(msg);
    return result;
  }

  const total = await HospitalModel.countDocuments({});
  result.totalHospitals = total;

  // Find hospitals missing latitude, longitude, or GeoJSON coordinates
  const query = {
    $or: [
      { latitude: { $exists: false } },
      { latitude: null },
      { longitude: { $exists: false } },
      { longitude: null },
      { 'location.coordinates': { $exists: false } },
      { 'location.coordinates.0': { $exists: false } },
      { 'location.coordinates.1': { $exists: false } },
    ],
  };

  const hospitalsToEnrich = await HospitalModel.find(query).limit(limit).lean();
  result.needingCoordinates = hospitalsToEnrich.length;

  console.log(`\nHospital Coordinate Enrichment (${isDryRun ? 'DRY-RUN' : 'LIVE'})`);
  console.log(`Total hospitals in DB: ${total}`);
  console.log(`Hospitals requiring coordinates: ${hospitalsToEnrich.length}`);

  if (hospitalsToEnrich.length === 0) {
    result.notes.push('All hospitals already have coordinates populated.');
    console.log('All hospitals already have geographic coordinates populated.');
    return result;
  }

  if (!apiKey || apiKey.trim() === '') {
    const msg = 'No GOOGLE_GEOCODING_API_KEY configured in environment. Skipping coordinate enrichment without fabricating data.';
    result.notes.push(msg);
    console.warn(`\n[WARNING] ${msg}`);
    return result;
  }

  for (const hospital of hospitalsToEnrich) {
    result.attempted++;
    const addressQuery = [hospital.name, hospital.address, hospital.city, hospital.state, hospital.country]
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(', ');

    if (!addressQuery) {
      result.skipped++;
      result.notes.push(`Hospital ${String(hospital._id)} has no address or name text to geocode`);
      continue;
    }

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(addressQuery)}&key=${apiKey}`;
      const response = await fetch(url);
      const data = (await response.json()) as GoogleGeocodeResponse;

      if (data.status === 'REQUEST_DENIED') {
        result.billingBlocked = true;
        const reason = data.error_message || 'API request denied by Google Cloud';
        result.notes.push(`Google Geocoding API blocked: ${reason}`);
        console.warn(`\n[GEOCODING NOTICE] Google Geocoding API returned REQUEST_DENIED:`);
        console.warn(`Details: ${reason}`);
        console.warn('Google Cloud billing is required to use the Geocoding API.');
        console.warn('Real coordinates were not fabricated. The remaining hospitals remain in PENDING geocoding status.\n');
        break; // Stop further calls to avoid repeated denied requests
      }

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const topResult = data.results[0];
        const location = topResult?.geometry?.location;

        if (topResult && location && typeof location.lat === 'number' && typeof location.lng === 'number') {
          const { lat, lng } = location;

          // Strict coordinate sanity check
          if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            result.failed++;
            result.notes.push(`Hospital ${String(hospital._id)}: Geocoded coordinates [${lat}, ${lng}] out of bounds`);
            continue;
          }

          const updateSet: Record<string, unknown> = {
            latitude: lat,
            longitude: lng,
            location: {
              type: 'Point',
              coordinates: [lng, lat], // GeoJSON order: [longitude, latitude]
            },
          };

          if (topResult.formatted_address) {
            updateSet.formattedAddress = topResult.formatted_address;
          }

          if (isDryRun) {
            console.log(`[DRY-RUN] Hospital "${hospital.name}" (${hospital._id}) would receive coordinates: lat=${lat}, lng=${lng}`);
            result.enriched++;
          } else {
            await HospitalModel.collection.updateOne({ _id: hospital._id }, { $set: updateSet });
            console.log(`Enriched hospital "${hospital.name}" (${hospital._id}) -> [${lat}, ${lng}]`);
            result.enriched++;
          }
        } else {
          result.failed++;
          result.notes.push(`Hospital ${String(hospital._id)}: No geometry returned`);
        }
      } else if (data.status === 'ZERO_RESULTS') {
        result.skipped++;
        result.notes.push(`Hospital ${String(hospital._id)}: ZERO_RESULTS for "${addressQuery}"`);
      } else {
        result.failed++;
        result.notes.push(`Hospital ${String(hospital._id)}: Status "${data.status}"`);
      }

      // Small throttle to stay within API rate limits
      await sleep(200);
    } catch (err) {
      result.failed++;
      const errMessage = err instanceof Error ? err.message : String(err);
      result.notes.push(`Hospital ${String(hospital._id)} error: ${errMessage}`);
    }
  }

  console.log('\nEnrichment Summary:');
  console.log(`  Total Hospitals          : ${result.totalHospitals}`);
  console.log(`  Needed Coordinates       : ${result.needingCoordinates}`);
  console.log(`  Attempted                : ${result.attempted}`);
  console.log(`  Enriched                 : ${result.enriched}`);
  console.log(`  Skipped                  : ${result.skipped}`);
  console.log(`  Failed                   : ${result.failed}`);
  console.log(`  Billing Blocked          : ${result.billingBlocked ? 'YES' : 'NO'}`);

  return result;
}

const execute = async (): Promise<void> => {
  const isDryRun = process.argv.includes('--dry-run');
  const limitArgIndex = process.argv.indexOf('--limit');
  const limitArgVal = limitArgIndex !== -1 ? process.argv[limitArgIndex + 1] : undefined;
  const limit = limitArgVal ? parseInt(limitArgVal, 10) : undefined;

  const sanitizedUri = sanitizeMongoUri(env.MONGODB_URI);
  console.log(`Connecting to database (${sanitizedUri})...`);

  try {
    await connectDatabase();
    await enrichHospitalCoordinates({ dryRun: isDryRun, limit });
  } catch (err) {
    const errorMsg = err instanceof Error ? sanitizeMongoUri(err.message) : 'Unknown error';
    console.error(`Hospital enrichment script failed: ${errorMsg}`);
    process.exitCode = 1;
  } finally {
    await disconnectDatabase();
  }
};

const isMainModule = (): boolean => {
  if (!process.argv[1]) return false;
  try {
    const currentFilePath = fileURLToPath(import.meta.url);
    return path.resolve(process.argv[1]) === path.resolve(currentFilePath);
  } catch {
    return false;
  }
};

if (isMainModule()) {
  void execute();
}
