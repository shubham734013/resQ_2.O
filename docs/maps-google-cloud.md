# ResQ Google Maps configuration

## Frontend key

Set `VITE_GOOGLE_MAPS_API_KEY` in the deployed frontend environment.

Restrict the browser key by HTTP referrer/application origin. Restrict APIs to the browser APIs actually used by ResQ:

- Maps JavaScript API
- Places API (New)

If a separate browser Maps ID is used, set `VITE_GOOGLE_MAPS_MAP_ID`.

## Server key

Set `GOOGLE_MAPS_SERVER_API_KEY` only in the backend environment.

Restrict the server key to the APIs used by server-side requests:

- Routes API
- Geocoding API

Never expose this key through Vite, React source, client network responses, or logs.

## Required services

Enable the Google Cloud APIs required by the implementation before manual verification. Do not commit either key to the repository.

## Security

- Use separate browser and server keys.
- Apply application restrictions and API restrictions.
- Rotate keys if they are ever exposed.
- Keep production keys in deployment environment configuration only.
