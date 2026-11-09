# ResQ driver duty and GPS tracking

## State model

The API reuses existing status enums; it does not create a second persistence enum.

| UI duty state | Driver availability | Ambulance status | Meaning |
|---|---|---|---|
| `OFF_DUTY` | `OFFLINE` | `OFFLINE` | Not accepting dispatch |
| `AVAILABLE` | `ONLINE` | `AVAILABLE` | On duty with fresh GPS, eligible for dispatch |
| `BUSY` | `BUSY` | `BUSY` | Active trip controls availability |

An ONLINE driver with stale GPS remains stored as ONLINE for audit, but the dashboard explicitly reports STALE and dispatch eligibility rejects the stale location. The dashboard never labels stale coordinates as live.

## API

All routes below are authenticated and require the `AMBULANCE_DRIVER` role:

- `GET /api/v1/ambulance-driver/duty` — authoritative driver/provider/ambulance status, active trip, last-known GPS freshness, and duty-action eligibility.
- `POST /api/v1/ambulance-driver/duty/start` — requires a fresh GPS fix (latitude, longitude, accuracy, source timestamp), verified active driver/provider, and eligible assigned ambulance. Driver and ambulance transition together in a transaction.
- `POST /api/v1/ambulance-driver/duty/end` — atomically sets driver and ambulance OFFLINE; rejected during an active trip or active dispatch offer/reservation.
- `PATCH /api/v1/ambulance-driver/location` — accepts updates only while ONLINE/BUSY, persists actual coordinates, accuracy, server receipt time, and source timestamp to the existing ambulance record.

The old status endpoint remains compatible, but manual ONLINE is rejected because starting duty must include a validated GPS fix. BUSY is controlled by the trip lifecycle; manual status changes cannot invent an active trip.

## Telemetry validation and freshness

- Default update interval: 4,000 ms; configurable only between 3,000 and 5,000 ms.
- Default stale threshold: 15,000 ms; configurable between 10,000 and 30,000 ms.
- Default maximum accepted fix age: 30,000 ms; configurable between 10,000 and 60,000 ms.
- Rejects invalid latitude/longitude, accuracy above 1,000 m, stale timestamps, timestamps more than 5 seconds in the future, duplicate/out-of-order source timestamps, and implausible jumps.
- GPS coordinates are stored in the existing ambulance document as GeoJSON and legacy latitude/longitude fields. No per-fix history collection is introduced.
- The browser requests high-accuracy positions every configured interval while ONLINE/BUSY. A page unmount clears its timer; if the page closes or the network stops, the persisted server timestamp ages to STALE. Permission denial while AVAILABLE attempts to end duty; during an active trip it stops publishing and surfaces an operational warning instead of incorrectly cancelling the trip.
- Dispatch location freshness uses the same stale threshold. A stale driver is not offered new dispatch work.

## Realtime security

Realtime SSE subscriptions require an authenticated access token and resource ownership. Drivers can subscribe only to their own driver channel and currently assigned ambulance channel. Wildcard and operations channels are admin-only. Location events are emitted to the driver and ambulance channels; exact coordinates are not broadcast as an unauthenticated global event.

## Automated validation

Unit tests cover duty-state mapping, schema validation, stale/future timestamps, freshness labels, and implausible GPS jumps. A dedicated integration test is gated on `DRIVER_DUTY_TEST_MONGODB_URI` and requires a replica-set test database whose name includes `test` or `driver-duty`. It races concurrent duty starts, checks duplicate telemetry, validates atomic start/end, and confirms active trips block duty ending.

```bash
cd server
npm run typecheck
npm run lint
npm test
npm run build
```

Configure `DRIVER_DUTY_TEST_MONGODB_URI` only with an isolated disposable test database to run the gated integration test. Do not point it at production.

## Staging acceptance checklist

- [ ] Unverified/inactive driver or provider cannot start duty.
- [ ] Unassigned, unverified, inactive, busy, or maintenance ambulance blocks duty start.
- [ ] Location permission denial prevents duty start and is visible.
- [ ] Driver/ambulance transition together on start/end.
- [ ] A concurrent second start/end receives a conflict rather than overwriting the winner.
- [ ] Invalid coordinates, stale/future timestamps, duplicate/out-of-order fixes, and implausible jumps are rejected.
- [ ] Network loss and tab close result in a visibly stale last-known fix; stale GPS is excluded from dispatch.
- [ ] GPS resumes after reconnect/refresh with a new source timestamp.
- [ ] Active trips prevent ending duty; only trip lifecycle can move a driver to BUSY.
- [ ] Realtime location subscription is restricted to authorized driver/ambulance channels.