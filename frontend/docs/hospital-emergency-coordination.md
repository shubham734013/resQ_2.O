# Hospital emergency coordination inbox

## Reliability model

Hospital coordination notifications are persisted in `HospitalCoordinationNotification` before any Socket.IO emission is attempted. The `dedupeKey` has a unique index; retrying the same emergency/trip milestone reuses the existing notification instead of creating duplicates. Realtime events are hints, not the source of truth.

On inbox load, the service reconciles the selected hospital's recent emergency records and trip status history into the persisted notification collection. This recovers milestones if a browser was closed, Socket.IO was disconnected, or a process stopped after saving the trip state but before saving the notification. The inbox can be reloaded after reconnect and acknowledgements remain persisted.

Notifications contain operational data only: request code, emergency category, milestone, trip status, ETA and ambulance identity. They do not contain patient names, phone numbers or unrestricted medical records. Every REST query and acknowledgement includes the authenticated hospital ID in its database filter. Socket.IO delivery uses the authorized `hospital-operations:<hospitalId>` room.

## REST endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/hospital/coordination/notifications?state=UNREAD&page=1&limit=25` | Persisted unread alert inbox and unread count |
| GET | `/api/v1/hospital/coordination/notifications?state=ALL` | Alert history including acknowledged and superseded records |
| POST | `/api/v1/hospital/coordination/notifications/:id/acknowledge` | Idempotently acknowledge an unread notification belonging to this hospital |
| GET | `/api/v1/hospital/coordination/emergencies/:id` | Hospital-scoped emergency, patient-coordination state, latest trip, ambulance identity/location freshness and permitted hospital status actions |
| PATCH | `/api/v1/hospital/emergencies/:id/status` | Existing legal hospital emergency status transition endpoint |

The detail response intentionally excludes patient contact details. It includes the pickup marker and last-known ambulance coordinates with `FRESH`/`STALE` metadata and `coordinatesAreLive`; stale coordinates must never be represented as live.

## Lifecycle events

- Emergency intake: `EMERGENCY_RECEIVED`
- Driver accepts dispatch: `AMBULANCE_ASSIGNED` (or `AMBULANCE_REASSIGNED` when the accepted vehicle changes)
- Driver confirms pickup arrival: `AMBULANCE_AT_PICKUP`
- Patient is picked up: `PATIENT_PICKED_UP`
- Trip enters hospital-bound phase: `EN_ROUTE_TO_HOSPITAL`
- Driver confirms hospital arrival: `AMBULANCE_ARRIVED`
- Driver completes the trip: `TRIP_COMPLETED`
- Emergency cancellation: `EMERGENCY_CANCELLED`
- Pre-transport trip cancellation: `TRIP_CANCELLED`; the case becomes `REASSIGNMENT_REQUIRED` and the existing dispatch job is requeued

Hospital staff can only perform the emergency status transitions returned by `allowedActions`. The backend still enforces those transitions; the UI is not the authorization boundary. Cancellation after patient transport begins is rejected. On reassignment, prior unread lifecycle alerts are marked `SUPERSEDED` so the inbox does not show a stale vehicle as the current assignment; acknowledged history is retained.

## Trip index migration required for redispatch

Trip history must be retained when a pre-transport trip is cancelled and a new trip is accepted. The old unique index on `Trip.emergencyRequestId` prevents that. The new code removes the schema-level single-trip constraint and the guarded migration replaces it with a partial unique index that allows historical terminal trips while enforcing at most one active trip per emergency.

Before deploying this branch against an existing database:

1. Back up and review the deployment plan.
2. Run the dry-run index check:
   `cd server && npm run ensure:trip-reassignment-index`
3. Confirm it reports no duplicate active trips and that the only legacy index being replaced is the expected unique emergency-request index.
4. In an authorized deployment window, apply the index change:
   `cd server && npm run ensure:trip-reassignment-index -- --apply`
5. Verify the resulting `trip_one_active_per_emergency` partial unique index before enabling redispatch.

The migration checks for duplicate active trips before changing indexes and does not delete or rewrite trip records. It is **not** run automatically by the app or CI. Do not run `--apply` against production without the database owner approving the plan.

## Acceptance test

The Socket.IO acceptance test also checks the hospital inbox and reassignment flow. It is gated by `TRACKING_TEST_MONGODB_URI` and requires a dedicated MongoDB replica set whose database name contains `test` or `tracking`:

```bash
cd server
TRACKING_TEST_MONGODB_URI='mongodb://127.0.0.1:27017/resq_tracking_test?replicaSet=rs0' npm test
```

The test covers duplicate event calls, persisted unread and acknowledgement state, repeated REST loads, two sessions for one hospital, cross-hospital denial, socket disconnect/reconnect recovery, pre-transport cancellation, reassignment, pickup, en-route notification, arrival, completion, and resource release. CI skips the MongoDB-backed test unless the dedicated test URI is configured; a skipped test is not a live end-to-end pass.
