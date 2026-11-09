# ResQ 2.0: Technical Implementation and Code Changes Report

This report documents all architectural repairs, functional completions, security hardening measures, and test framework implementations executed in **ResQ 2.0**.

---

## 1. Critical Fix: E2E Database Isolation & Safety Guards

### Problem Statement
Previously, the verification script `server/src/scripts/verifyE2EWorkflow.ts` imported `connectDatabase()` from `database.ts`, which connected directly to `env.MONGODB_URI`. If an engineer executed `npm run test:e2e` without explicit test environment overrides, the destructive test workflow ran directly against their primary development database (`.../ResQ`), resetting shared records and leaving transient test records.

### Implementation Details

#### 1. Created Dedicated Test Database Configuration Module
File: [`server/src/config/testDatabase.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/config/testDatabase.ts)

- **Target Database Validation**:
  `validateTestDatabaseTarget(uri)` verifies that the target URI is valid, non-empty, and uses `mongodb:` or `mongodb+srv:`.
- **Prohibited Target Blacklist**:
  Strictly blocks targets named `resq`, `production`, `prod`, `live`, `master`, and `main` (case-insensitive, including suffixes like `_db`).
- **Required Positive Name Criteria**:
  Enforces that the database name must explicitly contain the word `test` (e.g. `resq_automated_test`).
- **Fail-Closed URI Resolution**:
  `resolveTestDatabaseUri()` checks `TEST_MONGODB_URI` and `E2E_TEST_MONGODB_URI`. It **never** silently falls back to `MONGODB_URI`. If unconfigured, execution halts immediately with an explanatory error.
- **Connection Handshake Verification**:
  `connectTestDatabase()` connects and then verifies `mongoose.connection.name` against the validated test database name, disconnecting immediately if any mismatch is detected.

#### 2. Hardened End-to-End Verification Acceptance Script
File: [`server/src/scripts/verifyE2EWorkflow.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/scripts/verifyE2EWorkflow.ts)

- **Connection Guard**: Replaced `connectDatabase()` with `connectTestDatabase()`.
- **Self-Seeding Fixture Isolation**: Added `ensureDemoAccountsExist()` so isolated test databases (e.g., `resq_automated_test`) automatically seed required demo entities without depending on the development database.
- **Unique Test Run Identifier**:
  Generated unique test ID `testRunId = 'e2e-' + randomUUID()`, ensuring all created records (idempotency key, emergency request, dispatch job, trip, patient coordination) are uniquely tagged.
- **Demo State Preservation**:
  Recorded `initialAmbulanceStatus` and `initialDriverStatus` before execution and restored them in `finally`, avoiding indiscriminate resets of shared demo accounts.
- **Explicit Cleanup Ownership**:
  `finally` block deletes **only** records matching `emergencyId`, `tripId`, and `testRunId`, leaving unrelated test or demo records intact.
- **Always-Safe Disconnection**:
  Guaranteed `disconnectDatabase()` execution in `finally` to prevent connection leaks.

#### 3. Automated Isolation Unit Tests
File: [`server/src/tests/testDatabaseIsolation.test.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/tests/testDatabaseIsolation.test.ts)

Added 12 unit tests verifying:
- Rejection of undefined, empty, or whitespace-only URIs.
- Rejection of malformed URIs and unsupported protocols.
- Rejection of missing database names.
- Strict rejection of prohibited database names (`ResQ`, `production`, etc.).
- Rejection of database names lacking `test`.
- Acceptance of valid isolated test database URIs.
- Fail-closed behavior when environment variables are missing.
- Resolution precedence of explicit parameters and environment variables.

---

## 2. Full Emergency Lifecycle & Dynamic Target Transition

### Functional Enhancements
1. **Multi-Document ACID Dispatch Reservation**:
   - In [`server/src/services/dispatchService.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/services/dispatchService.ts), `acceptDispatchOffer` executes within a MongoDB transaction session:
     - Transitions `DispatchJob` to `ACCEPTED`.
     - Creates `Trip` record with initial status `ACCEPTED`.
     - Sets `Ambulance` and `AmbulanceDriver` to `BUSY`.
     - Transitions `EmergencyRequest` to `AMBULANCE_COORDINATION`.
     - Automatically expires competing offers.
2. **Dynamic Route Target Switching**:
   - In [`server/src/services/trackingService.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/services/trackingService.ts), route destination is dynamically evaluated based on persisted trip milestones:
     - When trip status is `ACCEPTED`, `TO_PICKUP`, or `AT_PICKUP`, route target is `PICKUP`.
     - When paramedic executes `POST /patient-picked-up` ($\to$ `PATIENT_ONBOARD`), target dynamically switches to `HOSPITAL`.
3. **Emergency Handover & Resolution**:
   - In [`server/src/services/ambulanceOperationsService.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/services/ambulanceOperationsService.ts), `completeTrip` atomically:
     - Sets `Trip` status to `COMPLETED`.
     - Resolves `EmergencyRequest` to `RESOLVED`.
     - Resolves `HospitalPatient` to `RESOLVED`.
     - Restores `Ambulance` to `AVAILABLE`.

---

## 3. Automated Selenium Browser Suite Expansion

### Problem Statement
The existing browser tests covered only public pages and unauthenticated redirects, leaving authenticated dashboard workflows across the 5 user roles (`USER`, `HOSPITAL`, `AMBULANCE_DRIVER`, `AMBULANCE_PROVIDER`, `ADMIN`) unverified in the browser.

### Implementation Details
File: [`tests/selenium/test_authenticated_workflow.py`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/tests/selenium/test_authenticated_workflow.py)

1. **Role Switcher Synchronization**:
   - In [`src/pages/LoginPage.tsx`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/src/pages/LoginPage.tsx), the role selector sets `aria-pressed="true"`.
   - In the Selenium runner, `self.driver.execute_script("arguments[0].click();", role_btn)` with `self.wait.until(lambda d: role_btn.get_attribute("aria-pressed") == "true")` guarantees React hydration and state updates complete before credential submission.
2. **Admin Session Initialization Guard**:
   - In [`src/pages/LoginPage.tsx`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/src/pages/LoginPage.tsx), added `localStorage.setItem('resq_has_session', 'true')` before `refreshUser()` to eliminate an authentication race condition.
3. **Graceful CI Skip**:
   - In `setUpClass`, added an HTTP probe to `http://localhost:5001/api/v1/health`. If the backend is unreachable (e.g. running in a static preview CI environment without backend services), the authenticated suite raises `unittest.SkipTest` gracefully instead of throwing 11 false failures.
4. **Complete Role Test Coverage (11 Tests)**:
   - `test_admin_login_and_dashboard_access`: Verifies admin KPI metrics and user oversight.
   - `test_admin_reports_and_analytics_views`: Verifies report generation, date pickers, and analytics charts.
   - `test_ambulance_driver_login_and_duty_interface`: Verifies driver duty toggle and assigned vehicle interface.
   - `test_ambulance_provider_login_and_dashboard`: Verifies provider fleet management and request queues.
   - `test_hospital_login_and_emergencies_view`: Verifies hospital incoming emergency queue.
   - `test_hospital_patients_and_profile_views`: Verifies patient pre-admission cases and facility profile.
   - `test_user_login_and_authenticated_profile`: Verifies citizen profile details.
   - `test_user_saved_facilities_view`: Verifies citizen saved hospital bookmarks.
   - `test_user_session_persists_across_page_refresh`: Verifies session preservation across browser reload.
   - `test_login_rejects_invalid_password_with_accessible_alert`: Verifies accessible error alerts.
   - `test_role_guard_blocks_user_from_accessing_admin_portal`: Verifies RBAC route boundaries.

---

## 4. Rate Limiting Test Exemption

File: [`server/src/middlewares/rateLimit.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/middlewares/rateLimit.ts)

- **Test Bypass**: When `NODE_ENV === 'test'` or `DISABLE_RATE_LIMIT === 'true'`, rate limiting middleware immediately calls `next()`.
- **Development Threshold Relaxation**: In non-production environments, rate limit thresholds are relaxed to `Math.max(max, 1000)` requests per window, preventing rapid automated test iterations from encountering HTTP 429 lockouts.

---

## 5. Facility Search & Spatial Geospatial Hardening

File: [`server/src/schemas/facility.ts`](file:///Users/shubham/Desktop/projectResQ/ResQ/frontend/server/src/schemas/facility.ts)

- **Query Alias Support**: Added support for `?query=` and `?search=` alongside `?q=`:
  ```typescript
  q: z.string().trim().optional(),
  query: z.string().trim().optional(),
  search: z.string().trim().optional(),
  ```
  with `.transform((data) => ({ ...data, q: data.q ?? data.query ?? data.search }))` to prevent 400 Bad Request errors from varied client query conventions.

---

## 6. Workflow B: Direct Hospital Requests & Concurrency-Safe Appointments

### Problem Statement
Citizens needed the capability to send non-emergency requests directly to a specific hospital and book scheduled appointments without routing through or altering the core emergency SOS dispatch engine. Crucially, the Emergency SOS workflow (with ambulance dispatch, priority triage, and pre-arrival coordination) had to remain completely prominent, functional, and unaffected.

### Implementation Architecture & Separation of Concerns

1. **Independent Data Models**:
   - `HospitalCareRequest`: Stores non-emergency consultation requests with human-readable tracking codes (`REQ-...`), preferred timing, contact preferences, and full status history (`PENDING`, `ACCEPTED`, `REJECTED`, `CANCELLED`).
   - `HospitalAppointmentAvailability`: Manages hospital weekly schedules, slot duration, max capacity per slot, and blackout dates per department.
   - `HospitalAppointmentSlot`: Individual capacity buckets with a unique compound index `(hospitalId, department, date, startTime)` and atomic `bookedCount` tracker.
   - `HospitalAppointment`: Citizen appointment records with appointment code (`APT-...`), department, date, time slot, alternative slot proposals, and status history.
   - `HospitalCareNotification`: In-app notification store with delivery tracking and status (`READ` / `UNREAD`).

2. **Atomic Concurrency Control (Zero Double-Booking Guarantee)**:
   - Slot reservations execute via atomic conditional updates:
     ```typescript
     const reservedSlot = await HospitalAppointmentSlotModel.findOneAndUpdate(
       {
         _id: slotDoc._id,
         bookedCount: { $lt: slotDoc.maxCapacity },
         isCancelled: false,
       },
       { $inc: { bookedCount: 1 } },
       { returnDocument: 'after' }
     );
     if (!reservedSlot) {
       throw new AppError('SLOT_UNAVAILABLE', 'The requested time slot has reached full capacity.', 409);
     }
     ```
   - On appointment cancellation or hospital rejection, capacity is atomically released with `{ $inc: { bookedCount: -1 } }` guarded by `{ bookedCount: { $gt: 0 } }`.
   - Verified by automated concurrency integration tests where 3 concurrent callers race for a single slot, resulting in exactly 1 booking and 2 clean 409 rejections.

3. **Prominent Safety Disclaimers**:
   - Both `CareRequestModal.tsx` and `AppointmentBookingModal.tsx` render high-contrast safety warning banners reminding citizens that the flow is for non-emergency care only, with an instant one-click link to the Emergency SOS interface.

4. **Dedicated Frontend Dashboards**:
   - Citizen Portal (`/appointments`): Filterable tabs for scheduled Appointments, submitted Care Requests, and In-App Notifications.
   - Hospital Staff Portal (`/hospital/appointments`): Subtabs for Incoming Care Requests (with Accept/Reject modals), Appointments Schedule (with Alternative Slot Proposal modal), and Availability Configuration.
   - Facility Actions: Clean coexistence on Facility Details pages displaying `Request Care` and `Book Appointment` alongside `Call`, `Directions`, and `Emergency SOS`.

---

## 7. Summary of Changed and Added Files

| File Path | Nature of Change | Purpose |
| :--- | :--- | :--- |
| `server/src/models/HospitalCareRequest.ts` | **Added** | Mongoose schema and model for non-emergency care requests with `REQ-` references and audit history. |
| `server/src/models/HospitalAppointmentAvailability.ts` | **Added** | Hospital schedule configuration (weekly operating hours, slot duration, capacity, blackout dates). |
| `server/src/models/HospitalAppointmentSlot.ts` | **Added** | Individual time-slot capacity counters with atomic reservation support. |
| `server/src/models/HospitalAppointment.ts` | **Added** | Appointment booking schema with `APT-` codes, alternative slot proposals, and lifecycle status. |
| `server/src/models/HospitalCareNotification.ts` | **Added** | In-app notification persistence for users and hospital staff. |
| `server/src/services/hospitalCareRequestService.ts` | **Added** | Business logic for creating, cancelling, listing, and hospital acceptance/rejection of requests. |
| `server/src/services/hospitalAppointmentService.ts` | **Added** | Atomic slot generation, concurrency-safe reservations, capacity release, and alternative slot proposals. |
| `server/src/services/hospitalCareNotificationService.ts` | **Added** | In-app notification creation, retrieval, mark-as-read, and channel broadcasting. |
| `server/src/routes/hospitalCareRequestRoutes.ts` | **Added** | Express router for `/api/v1/hospital-requests`. |
| `server/src/routes/hospitalAppointmentRoutes.ts` | **Added** | Express routers for citizen (`/api/v1/appointments`) and hospital (`/api/v1/hospital-appointments`). |
| `server/src/tests/hospitalCareRequestAndAppointments.test.ts` | **Added** | 18 automated integration tests covering requests, concurrency, capacity release, and SOS regression. |
| `src/services/hospitalCareRequestApi.ts` | **Added** | Frontend REST API client for hospital care requests. |
| `src/services/hospitalAppointmentApi.ts` | **Added** | Frontend REST API client for appointments and schedule management. |
| `src/services/hospitalCareNotificationApi.ts` | **Added** | Frontend REST API client for in-app notifications. |
| `src/hooks/useHospitalCareRequests.ts` | **Added** | TanStack Query hooks for care request mutations and queries. |
| `src/hooks/useHospitalAppointments.ts` | **Added** | TanStack Query hooks for appointment booking, availability, and alternative proposals. |
| `src/components/facility/CareRequestModal.tsx` | **Added** | Non-emergency care request dialog with safety disclaimer and department selector. |
| `src/components/facility/AppointmentBookingModal.tsx` | **Added** | Interactive calendar & slot booking dialog with atomic reservation handling. |
| `src/components/facility/FacilityActions.tsx` | **Updated** | Added Request Care and Book Appointment buttons alongside Call, Directions, and SOS. |
| `src/pages/CitizenAppointmentsPage.tsx` | **Added** | Citizen dashboard for appointments, care requests, and notifications. |
| `src/pages/HospitalAppointmentsPage.tsx` | **Added** | Hospital staff portal for request triage, appointment management, and availability configuration. |
| `src/components/hospital/HospitalLayout.tsx` | **Updated** | Added Care & Appointments sidebar navigation item for hospital staff. |
| `tests/selenium/test_hospital_requests_and_appointments.py` | **Added** | 4 Selenium browser tests verifying UI flows, tabs, and emergency SOS coexistence. |
| `server/src/config/testDatabase.ts` | **Added** | Strict test database isolation guards, prohibited target blacklisting, fail-closed target validation. |
| `server/src/tests/testDatabaseIsolation.test.ts` | **Added** | 12 automated unit tests verifying database safety rules and resolution precedence. |
| `server/src/scripts/verifyE2EWorkflow.ts` | **Updated** | Switched to `connectTestDatabase()`, added unique `testRunId`, self-seeding fixtures, demo state preservation, and explicit ownership cleanup. |
| `server/src/middlewares/rateLimit.ts` | **Updated** | Supported test bypass and relaxed dev thresholds to eliminate false 429 errors. |
| `server/src/schemas/facility.ts` | **Updated** | Added `query` and `search` query parameter aliases for robust full-text search. |
| `src/pages/LoginPage.tsx` | **Updated** | Added session flag initialization before refreshUser to resolve admin login race condition. |
| `tests/selenium/test_authenticated_workflow.py` | **Added** | 11 authenticated browser tests covering all 5 user roles and protected dashboard workflows. |
| `docs/RESQ_FEATURE_AUDIT.md` | **Updated** | Comprehensive feature-by-feature audit matrix across all modules including Workflow B. |
| `docs/RESQ_IMPLEMENTATION_REPORT.md` | **Updated** | Detailed architectural and code changes documentation. |
| `docs/RESQ_TEST_EVIDENCE.md` | **Updated** | Comprehensive verification log and execution evidence for all test suites. |
| `docs/RESQ_DEPLOYMENT_CHECKLIST.md` | **Updated** | Production configuration, security checklist, and deployment prerequisites. |
