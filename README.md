# ResQ 2.0

ResQ is a healthcare emergency coordination platform connecting users, verified hospitals, ambulance providers, ambulance drivers, and administrators through shared backend state.

## Stack
Frontend: React, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Framer Motion, Lucide React.
Backend: Node.js, Express, TypeScript, MongoDB, Mongoose, Zod, JWT, bcrypt.
Maps: Google Maps JavaScript API, Places API, Routes API, Geocoding, browser geolocation, MongoDB GeoJSON.

## Roles
USER, HOSPITAL, AMBULANCE_PROVIDER, AMBULANCE_DRIVER, ADMIN.

## Operational model
Emergency requests are persisted in MongoDB and use RECEIVED, REVIEWING, PREPARING, AMBULANCE_COORDINATION, RESOLVED, and CANCELLED states. Ambulance trips use ASSIGNED, ACCEPTED, TO_PICKUP, AT_PICKUP, PATIENT_ONBOARD, TO_HOSPITAL, AT_HOSPITAL, COMPLETED, and CANCELLED states.

The backend enforces role and ownership checks. Dispatch and driver acceptance use conditional MongoDB updates to protect against stale concurrent writes.

## Live ambulance location
An authenticated assigned driver can publish device location through PATCH /api/v1/ambulance-driver/location. Latitude, longitude, accuracy, and timestamp are validated, and coordinates are persisted as GeoJSON.

## User emergency APIs
POST /api/v1/emergencies
GET /api/v1/emergencies
GET /api/v1/emergencies/:id
POST /api/v1/emergencies/:id/cancel

## Environment
Frontend: configure VITE_API_BASE_URL plus required Google/Microsoft client values.
Backend: configure MONGODB_URI, JWT secrets, admin credentials, Google/Microsoft settings, and comma-separated CORS_ORIGINS.

## Development
Frontend: npm install, npm run typecheck, npm run lint, npm run build.
Backend: cd server, npm install, npm run typecheck, npm run lint, npm test, npm run build.

## Product boundary
ResQ does not claim guaranteed admission, ICU capacity, treatment, ambulance availability, fabricated ETAs, or fabricated locations. Operational UI must be backed by persisted backend state.
