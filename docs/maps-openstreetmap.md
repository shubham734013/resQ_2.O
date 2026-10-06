# ResQ OpenStreetMap mapping configuration

ResQ uses OpenStreetMap-derived map tiles rendered with Leaflet. Route calculation and address geocoding run server-side so provider credentials are never exposed in the browser.

## Frontend

Set `VITE_OSM_TILE_URL` only when using a different OSM-derived tile provider. The default is:

`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

The map UI includes visible OpenStreetMap attribution.

## Backend

Set:

`OPENROUTESERVICE_API_KEY=`

`OPENROUTESERVICE_BASE_URL=https://api.heigit.org/openrouteservice`

`NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org`

`NOMINATIM_USER_AGENT=ResQ/1.0 (Healthcare Navigation & Emergency Coordination Platform)`

The routing key stays server-side.

Geocoding is user-triggered through the ResQ backend. Search autocomplete is intentionally not implemented against the public Nominatim endpoint.

## Operational caveats

OpenStreetMap standard tiles are community-funded and best-effort. Keep normal caching and attribution requirements, and switch to a suitable OSM-derived tile provider or self-hosted tiles if ResQ is deployed at higher traffic.

The public Nominatim service is rate-limited and should not be used for client-side autocomplete or bulk geocoding.

OpenRouteService routing estimates are road-network estimates. This implementation does not claim live traffic unless a future provider explicitly supplies live traffic data.

## Emergency product rule

Never present a route ETA as a guarantee of ambulance availability, hospital admission, ICU/bed availability, or treatment.
