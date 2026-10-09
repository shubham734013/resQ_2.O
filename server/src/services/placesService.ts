import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

interface GooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export const searchGooglePlaces = async (query: string) => {
  const apiKey = env.GOOGLE_PLACES_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError('PLACES_API_KEY_MISSING', 'Server-side Google Places API key is not configured', 503);
  }

  const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'en', regionCode: 'IN', maxResultCount: 8 }),
  });
  const payload = await response.json().catch(() => null) as { places?: GooglePlace[]; error?: { message?: string } } | null;
  if (!response.ok) {
    // Do not leak Google response details or credentials to the client.
    throw new AppError('PLACES_SEARCH_FAILED', 'Google Places could not complete the search. Check API enablement, billing, and key restrictions.', 502);
  }

  return (payload?.places ?? []).flatMap((place) => {
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    if (!place.id || typeof latitude !== 'number' || typeof longitude !== 'number') return [];
    return [{
      id: place.id,
      displayName: place.displayName?.text ?? 'Place',
      formattedAddress: place.formattedAddress ?? '',
      location: { latitude, longitude },
    }];
  });
};
