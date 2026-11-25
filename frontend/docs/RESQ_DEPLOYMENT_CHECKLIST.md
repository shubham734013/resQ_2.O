# ResQ 2.0: Production Deployment and Reliability Checklist

This checklist provides the mandatory operational steps, configuration requirements, security controls, and health verification procedures required before promoting **ResQ 2.0** to a staging or production environment.

---

## 1. Environment Variable Configuration

### Backend (`server/.env`)

| Variable | Required | Production Guidance | Security Notes |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | **YES** | Set strictly to `production`. | Disables auto-indexing, activates strict CORS, enables production cookie flags. |
| `PORT` | **YES** | Default: `5001`. Must match ingress / reverse proxy routing. | Configured to non-privileged port. |
| `MONGODB_URI` | **YES** | Must target a MongoDB 7.0+ Replica Set. | Multi-document ACID transactions will fail on standalone instances. Sanitize logs. |
| `TEST_MONGODB_URI` | *TEST ONLY* | Target isolated database with `test` in name. | **Never set in production environment.** |
| `JWT_SECRET` | **YES** | High-entropy string $\ge 32$ characters. | Signs user access tokens. Rotate via scheduled key rotation policies. |
| `JWT_REFRESH_SECRET` | **YES** | High-entropy string $\ge 32$ characters (distinct from `JWT_SECRET`). | Signs refresh session tokens. |
| `RESQ_ADMIN_EMAIL` | **YES** | Root operational superadmin email. | Seeded upon initial deployment. |
| `RESQ_ADMIN_PASSWORD` | **YES** | Strong administrative password $\ge 12$ characters. | Must be hashed via Bcrypt (10+ salt rounds). |
| `CORS_ORIGINS` | **YES (Prod)** | Comma-separated list of allowed frontend origins (e.g. `https://resq.example.com`). | Wildcards (`*`) strictly disallowed in production. |
| `GOOGLE_GEOCODING_API_KEY` | Optional | Server-side Google Geocoding API key. | Restrict key by server IP address in Google Cloud Console. |
| `GOOGLE_ROUTES_API_KEY` | Optional | Server-side Google Routes API key. | Restrict by server IP address. Mathematical fallback engages if omitted. |
| `GOOGLE_PLACES_API_KEY` | Optional | Server-side Google Places API key. | Restrict by server IP address. |
| `GOOGLE_CLIENT_ID` | Optional | Google OAuth 2.0 Web Client ID. | Must match Google Cloud Credentials configuration. |
| `GOOGLE_CLIENT_SECRET` | Optional | Google OAuth 2.0 Client Secret. | Never expose to client bundles. |

### Frontend (`.env`)

| Variable | Required | Production Guidance | Security Notes |
| :--- | :---: | :--- | :--- |
| `VITE_API_BASE_URL` | **YES** | Production API URL (e.g. `https://api.resq.example.com/api/v1`). | Points directly to load balancer or API gateway. |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional | Browser-facing Google Maps JavaScript SDK key. | **Must be restricted by HTTP referrer** (e.g. `https://resq.example.com/*`). |
| `VITE_GOOGLE_MAPS_MAP_ID` | Optional | Vector Map ID for AdvancedMarkerElement. | Fallback `OverlayView` marker engages automatically if unset. |

---

## 2. Database Replica Set & Indexing Verification

Before launching the API server, execute the schema and geospatial indexing commands:

```bash
# 1. Ensure 2dsphere spatial indexes for facilities and ambulances
npm run ensure:dispatch-indexes --prefix server

# 2. Ensure atomic emergency idempotency compound indexes
npm run ensure:emergency-idempotency-index --prefix server

# 3. Ensure trip reassignment and active trip indexes
npm run ensure:trip-reassignment-index --prefix server

# 4. Verify database schema integrity and coordinate limits
npm run audit:db --prefix server
```

Key Database Checks:
- [ ] MongoDB deployment is a Replica Set (Atlas cluster or 3-node self-hosted replica set).
- [ ] 2dsphere index verified on `Hospital.location` (`{ location: "2dsphere" }`).
- [ ] 2dsphere index verified on `Ambulance.location` (`{ location: "2dsphere" }`).
- [ ] Unique compound index on `EmergencyRequest` (`{ userId: 1, idempotencyKey: 1 }`).
- [ ] Compound index on `DispatchJob` (`{ status: 1, nextAttemptAt: 1 }`).

---

## 3. Security & Production Hardening Controls

- [ ] **HTTPS Only**: Ingress enforces TLS 1.3 with automatic HTTP $\to$ HTTPS redirection.
- [ ] **Strict Cookie Flags**:
  - `HttpOnly: true` (prevents client JavaScript token access).
  - `SameSite: 'lax'` or `'strict'`.
  - `Secure: true` (enforced when `NODE_ENV === 'production'`).
- [ ] **CORS Origin Whitelist**: `CORS_ORIGINS` configured with exact production frontend domain.
- [ ] **Rate Limiting Active**:
  - `rateLimit.ts` active (bypass disabled in production).
  - Auth login limit: 20 attempts / 15 minutes.
  - Admin login limit: 10 attempts / 15 minutes.
- [ ] **Security Headers Enforced**:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: same-origin`
  - `Permissions-Policy: geolocation=(self)`
- [ ] **Database Target Guard Verified**:
  - Test scripts fail closed if attempted against production.
  - `TEST_MONGODB_URI` unset in production environment.

---

## 4. Health Checks & Observability Probes

### Liveness & Readiness Probes
Configure container orchestrator (Kubernetes, AWS ECS, Docker Swarm) to probe:
- **Readiness Probe**: `GET /api/v1/health`
  - **Expected Status**: `200 OK`
  - **Payload Structure**:
    ```json
    {
      "status": "UP",
      "timestamp": "2026-10-14T17:15:00.000Z",
      "database": {
        "status": "CONNECTED",
        "readyState": 1,
        "latencyMs": 14
      }
    }
    ```
  - **Failure Condition**: Returns `503 Service Unavailable` if MongoDB disconnects.

### Structured Logging
- Application logs are emitted in JSON format to `process.stderr` / `process.stdout`:
  ```json
  {"timestamp":"2026-10-14T17:15:00.000Z","service":"resq-api","level":"info","message":"ResQ API listening on port 5001"}
  ```
- No plaintext credentials, passwords, or JWT secrets are logged. URIs are sanitized via `sanitizeMongoUri()`.

---

## 5. Pre-Deployment Sign-Off Checklist

| Verification Item | Command / Check | Result | Verified By |
| :--- | :--- | :---: | :---: |
| **Frontend TypeScript** | `npm run typecheck` | 0 Errors | Automated CI |
| **Frontend Lint** | `npm run lint` | 0 Warnings/Errors | Automated CI |
| **Frontend Build** | `npm run build` | Built `dist/` in <300ms | Automated CI |
| **Backend TypeScript** | `npm run typecheck --prefix server` | 0 Errors | Automated CI |
| **Backend Lint** | `npm run lint --prefix server` | 0 Warnings/Errors | Automated CI |
| **Backend Build** | `npm run build --prefix server` | Built `dist/` | Automated CI |
| **Backend Test Suite** | `npm test --prefix server` | 136 / 136 Pass | Automated CI |
| **Selenium E2E Suite** | `tests/selenium/.venv/bin/python3 -m unittest ...` | 29 / 29 Pass | Automated CI |
| **E2E Lifecycle Verification** | `npm run test:e2e --prefix server` | 100% Pass (9 stages) | Automated CI |
| **Database Isolation Guards** | `testDatabaseIsolation.test.ts` | 12 / 12 Pass | Automated CI |
| **Zero Mock Data in Core APIs** | Audited against real MongoDB collections | Verified | Architecture Lead |
