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

## Independent Core Workflows

### Workflow A: Emergency SOS & Dispatch (Core Realtime EMS)
USER → facility discovery → situation selection → location confirmation → facility recommendation → emergency request (`RSQ-...`) → HOSPITAL review → preparation → ambulance coordination → PROVIDER dispatch → DRIVER acceptance → pickup → patient onboard → hospital arrival → handover → trip completion → emergency resolution.

Emergency statuses:
`RECEIVED`, `REVIEWING`, `PREPARING`, `AMBULANCE_COORDINATION`, `RESOLVED`, `CANCELLED`.

Trip statuses:
`ASSIGNED`, `ACCEPTED`, `TO_PICKUP`, `AT_PICKUP`, `PATIENT_ONBOARD`, `TO_HOSPITAL`, `AT_HOSPITAL`, `COMPLETED`, `CANCELLED`.

Critical cancellation and trip-completion paths use multi-document MongoDB transactions.

### Workflow B: Direct Hospital Requests & Appointments (Non-Emergency Care)
CITIZEN → select hospital facility → submit non-emergency care request (`REQ-...`) or select appointment slot (`APT-...`) → atomic concurrency-safe reservation (`bookedCount < maxCapacity`) → HOSPITAL review → accept with instructions / reject with reason / propose alternative slot → real-time notifications to citizen and hospital.

**Strict Separation Guarantee**: Normal care requests never create ambulance dispatch jobs, trips, or emergency-priority alerts. Emergency SOS remains completely prominent, functional, and isolated.

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

## Core Deliverables & Production Documentation

Comprehensive audit matrices, technical reports, test evidence, and deployment checklists are maintained in the `docs/` directory:

1. **[Feature Audit Matrix](docs/RESQ_FEATURE_AUDIT.md)**: Feature-by-feature evaluation across Citizen, Hospital, Provider, Driver, Admin, and Normal Care portals.
2. **[Implementation Report](docs/RESQ_IMPLEMENTATION_REPORT.md)**: Code changes, database isolation guards, concurrency controls, and architectural completions.
3. **[Test Evidence & Quality Gates](docs/RESQ_TEST_EVIDENCE.md)**: Full logs and execution evidence for 154 backend tests, 33 Selenium browser tests, and live lifecycle verification.
4. **[Deployment & Production Checklist](docs/RESQ_DEPLOYMENT_CHECKLIST.md)**: Environment variable specifications, database indexing, and health checks.

## Environment

Frontend variables are listed in `.env.example`.

Backend requires:
- `MONGODB_URI`: Primary database connection (Atlas replica set recommended).
- `TEST_MONGODB_URI`: Dedicated test database for destructive test execution (must contain `test` in name).
- `JWT_SECRET`: Secret key for access token signing ($\ge 32$ chars).
- `JWT_REFRESH_SECRET`: Secret key for refresh token signing ($\ge 32$ chars).
- `RESQ_ADMIN_EMAIL` & `RESQ_ADMIN_PASSWORD`: Superadmin credentials.
- `CORS_ORIGINS`: Allowed origins in production.
- Google / Microsoft OAuth credentials (optional).
- Server-side Google Maps keys (`GOOGLE_GEOCODING_API_KEY`, `GOOGLE_ROUTES_API_KEY`, `GOOGLE_PLACES_API_KEY`).

Never commit real secrets to source control.

## Validation & Testing

### 1. Static Analysis & Builds
```bash
# Frontend
npm run typecheck
npm run lint
npm run build

# Backend
npm run typecheck --prefix server
npm run lint --prefix server
npm run build --prefix server
```

### 2. Backend Automated Test Suite
```bash
TEST_MONGODB_URI="mongodb+srv://.../resq_automated_test?retryWrites=true&w=majority" npm test --prefix server
```

### 3. Selenium Automated Browser Suite
```bash
RESQ_BASE_URL="http://localhost:5173" tests/selenium/.venv/bin/python3 -m unittest discover -s tests/selenium -p "test_*.py" -v
```

### 4. End-to-End Emergency Lifecycle Verification
```bash
TEST_MONGODB_URI="mongodb+srv://.../resq_automated_test?retryWrites=true&w=majority" npm run test:e2e --prefix server
```
*Note: Destructive test scripts fail closed if `TEST_MONGODB_URI` is omitted or points to a non-test database like `ResQ`.*

## Realtime Architecture

ResQ 2.0 employs a dual-channel real-time architecture:
- **Socket.IO**: Bi-directional event communication powering live driver GPS telemetry and multi-client fanout across authenticated rooms (`emergency:*`, `trip:*`, `hospital:*`).
- **Server-Sent Events (SSE)**: Fallback stream at `/api/v1/realtime/stream` for environments restricting WebSockets.
- **Authoritative REST Snapshots**: Clients recovering from disconnections poll `/api/v1/tracking/...` to restore state before re-establishing subscriptions.

## Product Boundaries

ResQ coordinates emergency access and transport. It does not diagnose patients and does not guarantee admission, beds, ICU access, treatment, ambulance availability, or clinical outcomes unless the corresponding operational commitment is explicitly modeled and verified.
