import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { HospitalModel } from '../models/Hospital.js';

interface GooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

export const searchGooglePlaces = async (query: string) => {
  const apiKey = (env.GOOGLE_PLACES_API_KEY || env.GOOGLE_MAPS_SERVER_API_KEY)?.trim();
  const trimmedKey = apiKey && apiKey !== 'YOUR_SERVER_GOOGLE_KEY' ? apiKey : null;

  if (trimmedKey) {
    try {
      const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': trimmedKey,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
        },
        body: JSON.stringify({ textQuery: query, languageCode: 'en', regionCode: 'IN', maxResultCount: 8 }),
      });

      if (response.ok) {
        const payload = await response.json().catch(() => null) as { places?: GooglePlace[] } | null;
        const googleItems = (payload?.places ?? []).flatMap((place) => {
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
        if (googleItems.length > 0) {
          return googleItems;
        }
      }
    } catch {
      // Continue to local MongoDB facility fallback on network or DNS errors.
    }
  }

  // Fallback: search healthcare facilities in MongoDB matching the query
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');
  try {
    const matchingHospitals = await HospitalModel.find({
      $or: [
        { name: regex },
        { address: regex },
        { city: regex },
        { hospitalType: regex },
      ],
      latitude: { $exists: true, $ne: null },
      longitude: { $exists: true, $ne: null },
    }).limit(8).lean();

    if (matchingHospitals.length > 0) {
      return matchingHospitals.map((h) => ({
        id: h._id.toString(),
        displayName: h.name,
        formattedAddress: [h.address, h.city, h.state].filter(Boolean).join(', ') || h.name,
        location: { latitude: h.latitude!, longitude: h.longitude! },
      }));
    }
  } catch {
    // If database search also fails and no API key configured, report configuration error.
  }

  if (!trimmedKey) {
    throw new AppError('PLACES_API_KEY_MISSING', 'Server-side Google Places API key is not configured and no local facilities match the query', 503);
  }

  return [];
};

