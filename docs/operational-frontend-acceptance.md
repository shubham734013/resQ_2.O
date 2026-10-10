# ResQ operational frontend integration acceptance

This checklist validates the existing role dashboards against the API-backed emergency lifecycle. Use a dedicated staging environment with test accounts and synthetic emergencies only. Do not use a production emergency to test destructive actions.

## Preconditions

- Deploy the matching backend branch and configure `VITE_API_BASE_URL` to the correct API origin.
- Configure Maps browser credentials only through the documented environment setup; never add keys to source control.
- Create one authorized test account for each role: USER, AMBULANCE_DRIVER, AMBULANCE_PROVIDER, HOSPITAL and ADMIN.
- Use a dedicated MongoDB test/staging database with the required indexes and replica-set support for transactional flows.
- Ensure test hospitals, providers, drivers and ambulances are verified and active as required by dispatch eligibility.
- Record the build SHA and API deployment version before testing.

## Role-based acceptance matrix

| Role | Scenario | Expected result |
|---|---|---|
| User | Search hospitals by emergency category | Results reflect backend capability, verification, availability and location filters; distance and ETA clearly identify driving route vs straight-line fallback |
| User | Deny GPS permission or provide no fix | SOS cannot submit an unconfirmed pickup; a clear recovery path is shown |
| User | Create SOS and refresh the browser | Request code, selected hospital and dispatch state recover from REST; retries do not create duplicate emergencies |
| User | Track an accepted ambulance | Identity/location are hidden before acceptance; live coordinates include freshness; stale coordinates are not described as live |
| User | Cancel before transport / attempt cancellation during transport | Backend-confirmed legal cancellation is shown; prohibited cancellation is rejected without optimistic success |
| Driver | Start duty with fresh GPS | Backend confirms duty start; permission, stale GPS and API errors do not show success |
| Driver | Receive an offer and wait past its deadline | Countdown uses the server deadline; expired offers cannot be accepted locally or by stale UI |
| Driver | Accept/reject an offer in two sessions | Backend outcome is authoritative; duplicate or expired actions are handled safely |
| Driver | Refresh/reconnect during a trip | Duty, offer, trip phase, destination and GPS freshness recover from REST |
| Driver | Pickup, hospital arrival and completion | Only legal backend transitions are available; no arrival is inferred from map proximity |
| Provider | View fleet, drivers, requests and trips | Counts and records originate from the provider-scoped APIs; loading/error states remain explicit |
| Provider | Assign a driver or ambulance | Only backend-authorized eligible resources are offered; failed operations do not show success |
| Hospital | Receive assignment and lifecycle updates | Persisted inbox recovers missed realtime events; acknowledgement and unread count survive refresh |
| Hospital | Open an emergency from another hospital | API denies access; no patient or ambulance detail is leaked |
| Hospital | View ambulance GPS | Only the selected hospital's current trip is shown; freshness is visible and stale is not live |
| Admin | Open overview, queue, directory, fleet and analytics | All metrics come from admin APIs; empty/error states are not represented as zero-valued success |
| Admin | Change verification/account status | Backend authorization and transition rules are enforced; failures remain visible |

## Cross-role resilience tests

1. Directly navigate to each role route as an unauthenticated user, then as the wrong role. Verify redirect/denial without rendering protected data.
2. Expire access authentication, reload a protected route, and verify refresh-cookie handling or a clean return to login. No repeated request loop.
3. Throttle the network to Slow 3G. Verify loading indicators, disabled duplicate submissions, and no false success before the server response.
4. Force API 401, 403, 404, 409, 429 and 500 responses. Verify actionable messages, permission denial, and retry only where safe.
5. Disable network connectivity while a dashboard is open. The shared offline banner must appear, realtime must not be presented as healthy, and the UI must recover when connectivity returns.
6. Disconnect Socket.IO while REST remains available. Display connection degradation and recover from a REST snapshot on reconnect; do not rely on an in-memory event queue.
7. Open multiple tabs for the same role and verify subscriptions are cleaned up on unmount and no duplicate mutations are sent.
8. Test narrow mobile widths (320, 375 and 430 CSS px), tablet, and desktop. No horizontal page overflow, inaccessible controls, or clipped live-map/status content.
9. Use keyboard-only navigation and screen-reader announcements for loading, offline, error and mutation feedback. Verify visible focus and accessible names for icon-only controls.
10. Confirm all operational lists have distinct loading, error and genuine empty states. Never render a failed query as a valid empty queue or zero-count dashboard.

## Execution record

Record each scenario as PASS, FAIL or BLOCKED with account role, browser/device, build SHA, API SHA, request/response status (excluding secrets and patient data), and reproducible steps. A skipped database integration test is BLOCKED, not PASS.

This checklist is not evidence that browser or staging tests have already run. Complete it before declaring the frontend production-ready.
