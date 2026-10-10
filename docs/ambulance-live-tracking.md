# ResQ live ambulance tracking and navigation

## Architecture

- Socket.IO is attached to the existing Express HTTP server in `server/src/server.ts`. The application does not start a second HTTP server.
- Socket connections authenticate with the same `resq_access_token` cookie or an explicit bearer token, then use `authenticateAccessToken` and the existing account/role identity.
- Existing authenticated SSE endpoints and payloads remain in place. `broadcastEvent` publishes to SSE and, for exact authorized resource channels, also fans out to Socket.IO.
- The browser must still fetch an authenticated REST snapshot after connect/reconnect. Socket events are notifications/updates, not the source of truth.

## REST endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/v1/tracking/emergencies/:id` | Authorized emergency, dispatch state, trip state, pickup/hospital coordinates, and latest GPS after acceptance |
| `GET` | `/api/v1/tracking/trips/:id` | Same authoritative snapshot through a trip ID |
| `GET` | `/api/v1/tracking/trips/:id/route` | Current Google Routes route from a fresh ambulance GPS fix to pickup or hospital according to persisted trip state |

Snapshot access is role-scoped: users can see their own emergency; hospitals can see requests and trips for their hospital; drivers can see their assigned trips; providers can see their own dispatched trips; admins can inspect operational records. Hospital trip access additionally verifies that the trip destination matches the emergency's hospital.

Before driver acceptance, snapshots include dispatch status only. They do not return vehicle identity or driver GPS. After acceptance, location includes latitude/longitude, accuracy, source timestamp, server update time, age, freshness, and `coordinatesAreLive`. Stale coordinates may be shown as last-known, never labelled live. Terminal trips stop location fan-out and no longer return vehicle GPS in the snapshot.

## Socket.IO events and rooms

Clients may request one room at a time using `tracking:subscribe` with `{ type, id }`, where `type` is `emergency`, `trip`, or `hospital-operations`. The server validates the ObjectId and checks the underlying emergency/trip/hospital ownership before joining. Wildcards, arbitrary room names, and global operations subscriptions are rejected/not exposed.

- `emergency:<id>`: owner user, destination hospital, assigned driver/provider, or admin according to persisted records.
- `trip:<id>`: trip's driver/provider, emergency owner, destination hospital, or admin.
- `hospital-operations:<hospitalId>`: only that hospital identity (or admin).

Events include `dispatch:accepted`, `dispatch:declined`, `tracking:status`, `tracking:location`, and `hospital:incoming-patient`. Socket payloads are minimized; the legacy SSE payloads are preserved. Location events are emitted only for active accepted trips and only to the emergency, trip, and destination-hospital channels. Terminal trip status is delivered before trip-room membership is removed.

## Trip navigation

- `ACCEPTED` / `TO_PICKUP` / `AT_PICKUP`: route target is the confirmed pickup coordinates.
- `PATIENT_ONBOARD` / `TO_HOSPITAL` / `AT_HOSPITAL`: route target is the selected destination hospital.
- Driver arrival/patient-pickup/hospital-arrival actions remain explicit authenticated REST actions. A route line, GPS proximity, ETA, or navigation instruction does not itself mark arrival.
- Route refresh uses the existing Google Routes server integration, a 20-second cache, and a rounded origin cell to avoid one paid route call per GPS tick. Route API errors and stale GPS are shown as errors rather than fabricated directions.
- At `AT_HOSPITAL`, hospital coordination is updated by the existing trip lifecycle. `COMPLETED` releases the ambulance/driver according to the existing state machine and stops active location fan-out.

## Configuration and deployment

- Keep `CORS_ORIGINS` configured for the trusted frontend origins in every deployed environment; REST and Socket.IO use the same allowlist and credential policy.
- Install the added `socket.io` backend and `socket.io-client` frontend dependencies during deployment.
- Use HTTPS in production so the existing secure access-token cookie is available to Socket.IO. Keep REST and Socket.IO on the same backend origin when possible.
- No additional Google Maps key is introduced. The route endpoint uses the existing `GOOGLE_ROUTES_API_KEY` or `GOOGLE_MAPS_SERVER_API_KEY` server-side configuration.
- No location-history collection is introduced; latest GPS remains on the existing ambulance document.

## Validation

CI runs frontend `npm run typecheck`, `npm run lint`, `npm run build`, and backend `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

The current CI run completed successfully: 114 backend tests, 112 passed, 0 failed, 2 skipped. The skipped tests are pre-existing MongoDB-backed dispatch/duty concurrency tests that require dedicated replica-set database configuration.

### Staging acceptance checklist

- [ ] User and hospital snapshot responses for the same accepted emergency contain the same trip status and latest GPS timestamp.
- [ ] Before acceptance, no driver name, vehicle identity, or GPS is returned to the user.
- [ ] Correct owner can subscribe to an emergency; unrelated user, hospital, driver, and provider subscriptions are rejected.
- [ ] Arbitrary room names, wildcard rooms, and global operations subscriptions are rejected.
- [ ] Location events arrive only in the accepted trip's emergency, trip, and destination-hospital rooms.
- [ ] GPS events older than the current snapshot are ignored by clients; stale coordinates are never labelled live.
- [ ] Driver route target is pickup before patient pickup and hospital after patient pickup.
- [ ] Google Routes failure, map loading failure, socket disconnect, reconnect and REST snapshot recovery display actionable states.
- [ ] Driver must explicitly confirm pickup/hospital arrival; map proximity never advances the trip state.
- [ ] Hospital receives the hospital-arrival state and patient coordination update.
- [ ] Completing a trip releases resources and stops live location fan-out; terminal trip rooms are cleaned up.

Live browser-based multi-role E2E and staging replica-set tests have not been executed from this implementation session.