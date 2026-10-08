# ResQ 2.0

ResQ 2.0 is a healthcare emergency coordination platform connecting users, hospitals, ambulance providers, ambulance drivers, and administrators around shared MongoDB-backed operational state.

ResQ is a coordination/navigation product. It is not a diagnostic or treatment system.

## Roles

USER — facility discovery, emergency requests, status/history, profile, and saved facilities.

HOSPITAL — emergency intake, review/preparation, ambulance coordination, hospital operational information.

AMBULANCE_PROVIDER — fleet/driver management and emergency dispatch.

AMBULANCE_DRIVER — dispatch acceptance, live location, pickup/transport/hospital handover.

ADMIN — platform monitoring, verification/account controls, emergency monitoring, reporting and analytics.

## Architecture

Frontend:
- React + TypeScript + Vite
- Tailwind CSS
- React Router
- TanStack Query
- Framer Motion
- Lucide React

Backend:
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- Zod
- JWT access/refresh sessions
- bcrypt

Maps/location:
- Google Maps JavaScript API
- Google Places/Geocoding/Routes integrations
- Browser Geolocation
- MongoDB GeoJSON / 2dsphere

The backend is authoritative for authentication, ownership, role permissions, operational state, and lifecycle transitions.

## Emergency lifecycle

USER → facility discovery → situation selection → location confirmation → facility recommendation → emergency request → HOSPITAL review → preparation → ambulance coordination → PROVIDER dispatch → DRIVER acceptance → pickup → patient onboard → hospital arrival → handover → trip completion → emergency resolution.

Emergency statuses:
RECEIVED, REVIEWING, PREPARING, AMBULANCE_COORDINATION, RESOLVED, CANCELLED.

Trip statuses:
ASSIGNED, ACCEPTED, TO_PICKUP, AT_PICKUP, PATIENT_ONBOARD, TO_HOSPITAL, AT_HOSPITAL, COMPLETED, CANCELLED.

Critical cancellation and trip-completion paths use MongoDB transactions.

## Live ambulance location

Driver location is sourced from browser geolocation and sent through the authenticated driver endpoint. The server derives the driver and assigned ambulance from authenticated ownership.

Freshness:
- LIVE: under 30 seconds
- RECENT: 30 seconds to 2 minutes
- STALE: over 2 minutes
- UNKNOWN: no valid timestamp

Operational coordinates are exposed according to role-aware backend authorization.

## Admin reporting

Reports and analytics use MongoDB-backed aggregation for emergency volume/status, situation and hospital distributions, fleet/driver state, resolution ratio, response-to-review timing where history exists, and CSV export.

## Security

The API provides:
- production CORS allowlisting
- credential-safe HTTP-only cookies
- origin/CSRF protection for browser mutations
- authentication and refresh rate limiting
- request body limits
- security headers
- role and ownership checks
- backend state-transition validation
- safe production error responses without stack traces or raw error objects

## Local development

Prerequisites:
- Node.js 22+
- MongoDB or MongoDB Atlas
- Google Cloud credentials for Maps features

Frontend:
`npm install`
`npm run dev`

Backend:
`cd server && npm install`
`cd server && npm run dev`

## Environment

Frontend variables are listed in `.env.example`.

Backend requires:
- MONGODB_URI
- JWT_SECRET
- JWT_REFRESH_SECRET
- RESQ_ADMIN_EMAIL
- RESQ_ADMIN_PASSWORD
- CORS_ORIGINS in production
- corresponding Google/Microsoft credentials
- GOOGLE_MAPS_SERVER_API_KEY for server-side Maps features

Never commit real secrets.

## Validation

Frontend:
`npm run typecheck`
`npm run lint`
`npm run build`

Backend:
`cd server && npm run typecheck`
`cd server && npm run lint`
`cd server && npm test`
`cd server && npm run build`

Transactional workflows require a MongoDB deployment that supports transactions, such as MongoDB Atlas or a replica set.

## Product boundaries

ResQ coordinates emergency access and transport. It does not diagnose patients and does not guarantee admission, beds, ICU access, treatment, ambulance availability, or clinical outcomes unless the corresponding operational commitment is explicitly modeled and verified.

The initial real-time strategy uses TanStack Query polling on operational views. WebSockets/SSE are intentionally not introduced without a demonstrated need.
