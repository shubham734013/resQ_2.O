import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

interface NominatimResult {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
}

const fetchNominatim = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${env.NOMINATIM_BASE_URL.replace(/\/$/, '')}${path}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': env.NOMINATIM_USER_AGENT,
    },
  });

  const payload = await response.json().catch(() => null) as T | null;
  if (!response.ok || payload === null) {
    throw new AppError(
      'GEOCODING_FAILED',
      'OpenStreetMap geocoding service is unavailable right now',
      502,
    );
  }
  return payload;
};

export const geocodeAddress = async (address: string) => {
  const results = await fetchNominatim<NominatimResult[]>(
    `/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`,
  );
  const result = results[0];
  if (!result) {
    throw new AppError('GEOCODING_FAILED', 'No location was found for that address', 404);
  }

  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new AppError('GEOCODING_FAILED', 'OpenStreetMap returned an invalid location', 502);
  }

  return {
    placeId: String(result.place_id ?? ''),
    formattedAddress: result.display_name ?? address,
    latitude,
    longitude,
  };
};
