import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { HospitalModel } from '../models/Hospital.js';

export const geocodeAddress = async (address: string) => {
  const apiKey = (env.GOOGLE_GEOCODING_API_KEY || env.GOOGLE_MAPS_SERVER_API_KEY)?.trim();
  const trimmedKey = apiKey && apiKey !== 'YOUR_SERVER_GOOGLE_KEY' ? apiKey : null;

  if (trimmedKey) {
    try {
      const endpoint = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + encodeURIComponent(trimmedKey);
      const response = await fetch(endpoint);
      const payload = await response.json().catch(() => null) as { status?: string; results?: Array<{ place_id?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }> } | null;

      if (response.ok && payload?.status === 'OK' && payload.results?.length) {
        const result = payload.results[0];
        const location = result?.geometry?.location;
        if (result && typeof location?.lat === 'number' && typeof location.lng === 'number') {
          return {
            placeId: result.place_id ?? '',
            formattedAddress: result.formatted_address ?? address,
            latitude: location.lat,
            longitude: location.lng,
          };
        }
      }
    } catch {
      // Continue to Google Places or local MongoDB facility fallback on network or DNS errors.
    }
  }

  // Fallback 1: Try Google Places search which often has valid billing/authorization
  try {
    const { searchGooglePlaces } = await import('./placesService.js');
    const places = await searchGooglePlaces(address);
    const topPlace = places[0];
    if (topPlace && topPlace.location && typeof topPlace.location.latitude === 'number' && typeof topPlace.location.longitude === 'number') {
      return {
        placeId: topPlace.id,
        formattedAddress: topPlace.formattedAddress || topPlace.displayName,
        latitude: topPlace.location.latitude,
        longitude: topPlace.location.longitude,
      };
    }
  } catch {
    // Continue to database search fallback
  }

  // Fallback 2: search Hospital in MongoDB matching the address or name
  const escaped = address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  try {
    const match = await HospitalModel.findOne({
      $or: [{ name: regex }, { address: regex }, { city: regex }],
      latitude: { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null },
    }).lean();

    if (match && typeof match.latitude === 'number' && typeof match.longitude === 'number') {
      return {
        placeId: match._id.toString(),
        formattedAddress: [match.name, match.address, match.city].filter(Boolean).join(', '),
        latitude: match.latitude,
        longitude: match.longitude,
      };
    }
  } catch {
    // Continue to error throw if lookup fails
  }

  if (!trimmedKey) {
    throw new AppError('MAPS_API_KEY_MISSING', 'Server-side Google Maps key is not configured and no local facility matched that address', 503);
  }

  throw new AppError('GEOCODING_FAILED', 'No location was found for that address', 404);
};