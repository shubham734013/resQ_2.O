# ResQ Google Maps configuration

ResQ now uses Google Maps Platform for browser maps and server-side route calculation.

## Frontend browser key

Set `VITE_GOOGLE_MAPS_API_KEY` in the frontend environment.

For local development:

```env
VITE_GOOGLE_MAPS_API_KEY=YOUR_BROWSER_KEY
VITE_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
```

Restrict the browser key by HTTP referrer and restrict it to the Google Maps JavaScript API and other browser APIs actually used by the app.

A Map ID is required for Advanced Markers. Google documents `DEMO_MAP_ID` as acceptable for testing; use a project-owned JavaScript Map ID for production.

## Backend server key

Set `GOOGLE_MAPS_SERVER_API_KEY` only in `server/.env`.

```env
GOOGLE_MAPS_SERVER_API_KEY=YOUR_SERVER_KEY
```

Restrict the server key to the APIs required for ResQ server-side requests, including Routes API.

Never expose the server key through React/Vite, browser source, client responses, or logs.

## Required Google Cloud APIs

Enable at minimum:

- Maps JavaScript API
- Routes API

The frontend loads the Maps JavaScript API and the `marker` library for Advanced Markers.

## Local environment

Frontend `.env`:

```env
VITE_API_BASE_URL=http://localhost:5001/api/v1
VITE_GOOGLE_MAPS_API_KEY=
VITE_GOOGLE_MAPS_MAP_ID=DEMO_MAP_ID
```

Backend `server/.env`:

```env
GOOGLE_MAPS_SERVER_API_KEY=
```

Do not commit either secret to Git.
