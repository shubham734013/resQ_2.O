# ResQ SOS workflow acceptance checklist

Run against a dedicated staging/test database and a staging API with the Google Routes API configured. Do not run destructive fixtures or database resets against production. The automated unit coverage lives in `server/src/emergencyWorkflow.test.ts`.

## Preconditions
- Sign in as a normal `USER`; hospital/admin/driver identities must not access user SOS endpoints.
- Prepare verified, active hospitals with GeoJSON coordinates, declared emergency services/capabilities, and availability set to `AVAILABLE` or `LIMITED`.
- Also prepare one unverified hospital, one unavailable hospital, one hospital without valid coordinates, and one verified hospital with no capability match.
- Ensure a staging Google Routes key is available, then test once with routing intentionally unavailable (for example, a staging key restriction or disabled route service), never by exposing the key.

## Acceptance cases

1. **Successful SOS:** choose an emergency type, confirm a real GPS/geocoded pickup, choose a matching hospital, review details, confirm SOS. Expect one persisted `EmergencyRequest`, a unique `id` and `requestCode`, `RECEIVED` status history, linked hospital patient case, server-computed driving distance/ETA when Routes succeeds, and no ambulance/trip assignment created.
2. **Duplicate submission:** send the same payload twice with the same `Idempotency-Key`. Expect the same request ID/code and exactly one request/case. Reusing the same key with a different hospital, category, or coordinates must return `409 IDEMPOTENCY_KEY_REUSED`.
3. **Invalid coordinates/category/hospital ID:** send out-of-range coordinates, missing coordinates, unknown category, or malformed hospital ID. Expect a validation error and no database writes.
4. **Hospital unavailable/unverified/inactive:** attempt creation using each ineligible hospital ID. Expect `409 HOSPITAL_NOT_OPERATIONAL` or `409 HOSPITAL_NO_LONGER_ELIGIBLE`, with no request, patient case, or dispatch side effects.
5. **Capability mismatch:** select a verified hospital that lacks declared matching services/capabilities. Expect `409 HOSPITAL_CAPABILITY_MISMATCH` and no request.
6. **Empty discovery:** use a test coordinate/category with no eligible hospital inside the radius. Expect an empty list, an explicit empty state, radius broadening, and a persistent Call 112 action.
7. **Location denied/unavailable:** deny browser GPS permission or simulate unavailable GPS. Expect an actionable retry/address-entry path; no discovery or SOS submit may use the fallback `0,0` placeholder.
8. **Routing failure:** make Routes unavailable. Expect an explicitly labelled straight-line fallback distance, no fabricated driving ETA, a warning, and the ability to save a valid hospital request while keeping direct emergency calling available.
9. **Unauthorized cancellation:** attempt cancellation as a non-user role and as a different user for another user's request. Expect authorization denial/404 and no status/history mutation.
10. **Recovery after refresh/navigation:** create an active request, refresh `/sos` or leave and return. Expect the existing request/code/status to be restored from the authenticated API, with no second request created. Status polling failure must retain the request ID and provide a retry action.
11. **Cancellation transition:** cancel an owned request in a user-cancellable state. Expect `CANCELLED` plus a history entry with previous status and actor; attempts after transport starts or after terminal status must be rejected.

## Production index rollout

Production database connections disable Mongoose automatic index creation. Before enabling the SOS endpoint in production, run the index check in an authorized environment:

```bash
cd server
npm run ensure:emergency-idempotency-index
npm run ensure:emergency-idempotency-index -- --apply
```

The first command is a dry run. The second creates only the sparse unique idempotency-key index after checking for duplicate key values. It does not modify request documents or drop/replace existing indexes. Review the dry-run result before applying.

## Commands

From the repository root:

```bash
npm run typecheck
npm run lint
npm run build
```

Backend:

```bash
cd server
npm run typecheck
npm run lint
npm test
npm run build
```

The workflow's static checks do not replace the staging database/API acceptance cases above. Record test-environment, request ID/code, and outcome without logging user location, phone numbers, cookies, or secrets.
