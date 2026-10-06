import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

export const geocodeAddress = async (address: string) => {
  const apiKey = env.GOOGLE_MAPS_SERVER_API_KEY?.trim();
  if (!apiKey) throw new AppError('MAPS_API_KEY_MISSING', 'Server-side Google Maps key is not configured', 503);

  const endpoint = 'https://maps.googleapis.com/maps/api/geocode/json?address=' + encodeURIComponent(address) + '&key=' + encodeURIComponent(apiKey);
  const response = await fetch(endpoint);
  const payload = await response.json().catch(() => null) as { status?: string; results?: Array<{ place_id?: string; formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }> } | null;
  if (!response.ok || payload?.status === 'REQUEST_DENIED') throw new AppError('GEOCODING_FAILED', 'Google could not geocode that address', 502);
  if (payload?.status !== 'OK' || !payload.results?.length) throw new AppError('GEOCODING_FAILED', 'No location was found for that address', 404);

  const result = payload.results[0];
  const location = result.geometry?.location;
  if (typeof location?.lat !== 'number' || typeof location.lng !== 'number') throw new AppError('GEOCODING_FAILED', 'Google returned an invalid location', 502);
  return {
    placeId: result.place_id ?? '',
    formattedAddress: result.formatted_address ?? address,
    latitude: location.lat,
    longitude: location.lng,
  };
};