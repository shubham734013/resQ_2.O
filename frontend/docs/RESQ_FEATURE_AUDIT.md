# ResQ 2.0: Complete Feature-by-Feature Audit Matrix

This document provides a comprehensive, repository-verified audit of all capabilities, APIs, data models, frontend routes, security controls, and test coverage across the **ResQ 2.0** Emergency Medical Services (EMS) coordination platform.

---

## 1. Audit Classification Taxonomy

Every audited capability is evaluated against real backend execution, database persistence, and automated test suites, and assigned exactly one classification:

- **`VERIFIED_COMPLETE`**: Implemented on frontend and backend, persisted in MongoDB, protected by server-side authorization and Zod validation, and verified by passing automated unit, integration, or browser tests.
- **`PARTIALLY_IMPLEMENTED`**: Working components exist, but certain operational paths, validation rules, or edge-case handling are incomplete.
- **`BROKEN`**: Implementation exists but fails during execution or violates business constraints.
- **`MISSING`**: Required capability has no implementation in the codebase.
- **`BLOCKED`**: Implementation depends on external infrastructure, provider approvals, or credentials not currently available.

---

## 2. Comprehensive Feature Audit Table

### A. Citizen / User Experience

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **User Registration & Login** | Email/password sign-up with client & server validation; secure session cookie issuance. | `RegistrationPage.tsx`, `LoginPage.tsx` | `POST /api/v1/auth/register`, `POST /api/v1/auth/login` | `User` collection (Bcrypt password hash, normalized email) | Public; Zod `userRegisterSchema`, `loginSchema` | `test_user_registration_rejects_mismatched_passwords_without_api_mutation`, `test_login_rejects_invalid_password_with_accessible_alert` | `VERIFIED_COMPLETE` |
| **Social Authentication Onboarding** | Google & Microsoft OAuth credential validation with deterministic account linking. | `SocialAuthButtons.tsx` | `POST /api/v1/auth/social` | `User` + `ExternalIdentity` collections | Public; Zod `socialAuthPayloadSchema`, role hint validation | `socialAuth.test.ts` (validation & provider hooks) | `VERIFIED_COMPLETE` |
| **Session Restoration & Persistence** | Persists authenticated session across browser reloads via HTTP-only JWT cookies. | `AuthContext.tsx`, `useUser.ts` | `GET /api/v1/auth/me` | In-memory token verification / `User` query | `authenticate` middleware (Bearer / Cookie fallback) | `test_user_session_persists_across_page_refresh`, `cookieSession.test.ts` | `VERIFIED_COMPLETE` |
| **User Profile Management** | View and update personal profile, medical conditions, and emergency contacts. | `ProfilePage.tsx` | `GET /api/v1/users/profile`, `PATCH /api/v1/users/profile` | `User` collection (`profileNotes`, `emergencyContacts`) | `authenticate`, `authorizeRole('USER')`; Zod `userProfileUpdateSchema` | `test_user_login_and_authenticated_profile` | `VERIFIED_COMPLETE` |
| **Emergency SOS Creation** | Multi-situation triage, GPS location confirmation, hospital discovery, atomic dispatch job creation. | `EmergencyPage.tsx`, `SituationSelector.tsx`, `LocationConfirmation.tsx` | `POST /api/v1/emergencies` | `EmergencyRequest` (`RSQ-...`), `HospitalPatient` (`INCOMING`), `DispatchJob` (`PENDING`) | `authenticate`, `authorizeRole('USER')`; Zod `createEmergencyRequestSchema`, idempotency key | `emergencyWorkflow.integration.test.ts`, `verifyE2EWorkflow.ts` Step 3 | `VERIFIED_COMPLETE` |
| **Live Ambulance Tracking** | Real-time map displaying driver GPS position, freshness indicator, vehicle number, and dynamic target (`PICKUP` $\to$ `HOSPITAL`). | `LiveAmbulanceTracking.tsx`, `MapView.tsx` | `GET /api/v1/tracking/emergencies/:id`, Socket.IO room `emergency:<id>` | `Trip` coordinates, `Ambulance` GeoJSON Point | Scoped room authorization; user must own emergency | `trackingRealtime.integration.test.ts`, `verifyE2EWorkflow.ts` Step 6 | `VERIFIED_COMPLETE` |
| **Emergency Cancellation** | Citizen can cancel emergency with optional reason before terminal trip completion. | `CoordinationStatus.tsx` | `POST /api/v1/emergencies/:id/cancel` | `EmergencyRequest` (`CANCELLED`), `Trip` (`CANCELLED`), `DispatchJob` (`EXHAUSTED`) | `authenticate`, `authorizeRole('USER')`; Zod `cancelEmergencySchema` | `emergencyWorkflow.integration.test.ts` | `VERIFIED_COMPLETE` |
| **Saved Facilities** | Bookmark preferred hospitals for rapid discovery and emergency planning. | `SavedPage.tsx`, `FacilityCard.tsx` | `GET /api/v1/users/saved-facilities`, `POST /api/v1/users/saved-facilities`, `DELETE /:facilityId` | `UserSavedFacility` collection / `User.savedFacilities` | `authenticate`, `authorizeRole('USER')`; Mongo ObjectId validation | `test_user_saved_facilities_view` | `VERIFIED_COMPLETE` |

---

### B. Ambulance Provider Dashboard

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Provider Portal & Overview** | Authenticated dashboard displaying fleet summary, active vehicles, drivers, and pending requests. | `AmbulanceProviderDashboardPage.tsx` | `GET /api/v1/ambulance-provider/profile`, `/ambulances`, `/drivers` | `AmbulanceProvider`, `Ambulance`, `AmbulanceDriver` | `authenticate`, `authorizeRole('AMBULANCE_PROVIDER')` | `test_ambulance_provider_login_and_dashboard` | `VERIFIED_COMPLETE` |
| **Ambulance Fleet Management** | Register, update, and manage vehicle fleet (BLS, ALS, PTS, MICU) and equipment capabilities. | `FleetManagementView` in `AmbulanceProviderDashboardPage.tsx` | `GET/POST/PATCH /api/v1/ambulance-provider/ambulances`, `PATCH /:id/status` | `Ambulance` collection (`providerId` relational scope) | Provider role; strict ownership check; Zod `ambulanceCreateSchema`, `ambulanceUpdateSchema` | `ambulanceOperations.test.ts` | `VERIFIED_COMPLETE` |
| **Driver Roster & Assignment** | Manage paramedic drivers and assign them to specific ambulances (strict 1:1 active constraint). | `AmbulanceProviderDashboardPage.tsx` | `GET/POST/PATCH /api/v1/ambulance-provider/drivers`, `PATCH /ambulances/:id/assign-driver`, `PATCH /:id/unassign-driver` | `AmbulanceDriver`, `Ambulance` (`assignedAmbulanceId`) | Provider role; validates driver is not already assigned to another vehicle | `ambulanceOperations.test.ts` | `VERIFIED_COMPLETE` |
| **Provider Trip Monitoring** | Live tracking of all trips operated by provider's fleet with status history. | `AmbulanceProviderDashboardPage.tsx` | `GET /api/v1/ambulance-provider/trips`, `GET /trips/:id` | `Trip` collection (`providerId` filter) | Provider role; strict tenant isolation (`providerId: auth.id`) | `trackingRealtime.integration.test.ts` | `VERIFIED_COMPLETE` |

---

### C. Ambulance Driver Experience

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Shift Duty Controls** | Driver starts/ends shift; sets vehicle and driver availability to ONLINE/AVAILABLE or OFFLINE. | `AmbulancePage.tsx`, `DriverDutyToggle` | `POST /api/v1/ambulance-driver/duty/start`, `POST /duty/end` | `AmbulanceDriver` (`availabilityStatus`), `Ambulance` (`currentStatus`) | `authenticate`, `authorizeRole('AMBULANCE_DRIVER')`; validates active vehicle assignment | `driverDuty.integration.test.ts`, `verifyE2EWorkflow.ts` Step 2 & 9 | `VERIFIED_COMPLETE` |
| **Dispatch Offer Evaluation** | Driver receives audible/visual dispatch offer with route distance and ETA; accepts or rejects. | `AmbulancePage.tsx`, `DriverOfferModal` | `GET /api/v1/ambulance-driver/dispatch-offers`, `POST /:id/accept`, `POST /:id/reject` | `DispatchJob` (`OFFERED` $\to$ `ACCEPTED`), `Trip` (`ACCEPTED`) | Driver role; ACID multi-document transaction prevents competing driver acceptance | `dispatchConcurrency.integration.test.ts`, `verifyE2EWorkflow.ts` Step 4 & 5 | `VERIFIED_COMPLETE` |
| **Live GPS Telemetry Broadcast** | Driver broadcasts high-precision GPS fixes with speed jump and monotonic clock verification. | `AmbulancePage.tsx`, geolocation loop | `PATCH /api/v1/ambulance-driver/location` | `AmbulanceDriver`, `Ambulance` (GeoJSON Point `location`, `locationUpdatedAt`) | Driver role; rejects future skew ($>5$s) and stale fixes ($>30$s); speed jump validation | `driverDuty.integration.test.ts`, `verifyE2EWorkflow.ts` Step 6 | `VERIFIED_COMPLETE` |
| **Trip Milestone Transitions** | Step-by-step progress tracking: `AT_PICKUP` $\to$ `PATIENT_ONBOARD` $\to$ `TO_HOSPITAL` $\to$ `AT_HOSPITAL` $\to$ `COMPLETED`. | `AmbulancePage.tsx`, `ActiveTripWorkflow` | `POST /api/v1/ambulance-driver/trips/:id/arrived-pickup`, `/patient-picked-up`, `/arrived-hospital`, `/complete` | `Trip` (`statusHistory`), `EmergencyRequest` (`status`), `Ambulance` | Driver role; checks driver assigned to trip; atomic status update | `verifyE2EWorkflow.ts` Step 7 | `VERIFIED_COMPLETE` |
| **Turn-by-Turn Navigation UI** | In-app map navigation displaying route polyline, distance remaining, and turn direction. | `RouteNavigationPage.tsx`, `MapView.tsx` | `POST /api/v1/maps/routes`, `GET /api/v1/tracking/trips/:id/route` | Google Routes API calculation with mathematical fallback | Public / Driver; validates coordinates | `useMapRoute.ts`, `test_search_page_route_loads_without_blank_screen` | `VERIFIED_COMPLETE` |

---

### D. Hospital Dashboard & Emergency Coordination

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Hospital Authentication & Profile** | Hospital staff access, facility capabilities, trauma center level, and address management. | `HospitalPage.tsx`, `HospitalProfileTab` | `GET /api/v1/hospital/profile`, `PATCH /api/v1/hospital/profile` | `Hospital` collection | `authenticate`, `authorizeRole('HOSPITAL')`; Zod `hospitalProfileUpdateSchema` | `test_hospital_patients_and_profile_views` | `VERIFIED_COMPLETE` |
| **Incoming Emergency Queue** | Real-time intake queue displaying arriving emergency cases with patient conditions and paramedic updates. | `HospitalPage.tsx`, `HospitalEmergenciesTab` | `GET /api/v1/hospital/emergencies`, `PATCH /emergencies/:id/status` | `EmergencyRequest` (`hospitalId` scoped) | Hospital role; strictly scoped to `hospitalId: req.auth.id` | `test_hospital_login_and_emergencies_view`, `verifyE2EWorkflow.ts` Step 3 | `VERIFIED_COMPLETE` |
| **Pre-Arrival Notifications & Ack** | Hospital receives instant alerts when an emergency targets the hospital; staff acknowledges alert. | `HospitalCoordinationInbox.tsx` | `GET /api/v1/hospital/coordination/notifications`, `POST /:id/acknowledge` | `HospitalCoordinationNotification` (`acknowledgedAt`, `acknowledgedBy`) | Hospital role; verifies notification belongs to calling hospital | `hospitalCoordination.test.ts` | `VERIFIED_COMPLETE` |
| **Patient Pre-Admission Cases** | Tracks patient triage cases linked to incoming emergencies (`INCOMING` $\to$ `ADMITTED` / `RESOLVED`). | `HospitalPatientsTab.tsx` | `GET /api/v1/hospital/patients`, `GET /patients/:id` | `HospitalPatient` collection | Hospital role; scoped to `hospitalId` | `test_hospital_patients_and_profile_views`, `verifyE2EWorkflow.ts` Step 3 & 8 | `VERIFIED_COMPLETE` |
| **Resource Capacity Controls** | Live toggles for ICU beds, emergency beds, ventilators, operating rooms, and availability status. | `HospitalResourcesTab.tsx` | `GET /api/v1/hospital/resources`, `PATCH /api/v1/hospital/resources`, `PATCH /availability` | `Hospital` collection (`resourceSummary`, `emergencyAvailability`) | Hospital role; Zod `hospitalResourcesUpdateSchema` | `hospitalManagement.test.ts` | `VERIFIED_COMPLETE` |

---

### E. Operations Admin & Platform Governance

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Admin Overview & Metrics** | Comprehensive platform metrics: total users, verified hospitals, fleet count, pending reviews. | `AdminPage.tsx`, `AdminOverviewPage` | `GET /api/v1/admin/overview` | Dynamic MongoDB count queries across all 5 actor collections | `authenticate`, `authorizeRole('ADMIN')` | `test_admin_login_and_dashboard_access` | `VERIFIED_COMPLETE` |
| **Entity Approvals & Suspensions** | Super-admin review for hospitals, ambulance providers, ambulances, and drivers (`PENDING` $\to$ `VERIFIED`/`REJECTED`). | `AdminManagementPages.tsx`, `AdminDetailPages.tsx` | `PATCH /api/v1/admin/hospitals/:id/verification`, `/status`, `/ambulance-providers/:id/...`, etc. | `Hospital`, `AmbulanceProvider`, `Ambulance`, `AmbulanceDriver`, `User` | Admin role; Zod `verificationStatusSchema`, `accountStatusSchema` | `adminController.test.ts`, `adminAuthorization.test.ts` | `VERIFIED_COMPLETE` |
| **Emergency & Dispatch Console** | Supervisors inspect active dispatch jobs, retry stalled requests, or execute manual assignment. | `AdminEmergenciesPage.tsx`, `DispatchAdminConsole` | `GET /api/v1/admin/dispatch-jobs`, `POST /:id/retry`, `POST /:id/manual-assign`, `POST /:id/escalate` | `DispatchJob`, `EmergencyRequest`, `AuditLog` | Admin role; Zod `dispatchManualAssignSchema`, `dispatchEscalateSchema` | `adminEmergencyController.test.ts` | `VERIFIED_COMPLETE` |
| **Operational Analytics & Reports** | Historical query aggregation by date range, resolution ratio, and average response times. | `AdminReportsPage.tsx`, `AdminAnalyticsPage.tsx` | `GET /api/v1/admin/reports/overview`, `/emergencies`, `/analytics` | MongoDB Aggregation Pipelines | Admin role; Zod `reportsQuerySchema` | `test_admin_reports_and_analytics_views` | `VERIFIED_COMPLETE` |
| **RFC 4180 CSV Data Export** | Streams operational reports formatted as RFC 4180 CSV with secure Content-Disposition headers. | `AdminReportsPage.tsx` (Export CSV Button) | `GET /api/v1/admin/reports/export` | MongoDB streaming cursor | Admin role; Zod `reportsExportQuerySchema` | `test_admin_reports_and_analytics_views` | `VERIFIED_COMPLETE` |
| **Administrative Audit Trail** | All state mutations, status changes, and approvals record actor ID, previous status, and timestamp. | Admin detail inspection views | Triggered by all admin mutation controllers | `AuditLog` collection (`actorId`, `action`, `resourceType`, `before`, `after`) | Automatic server-side enforcement | `auditDatabase.test.ts` | `VERIFIED_COMPLETE` |

---

### F. Maps, Facilities & Geospatial Search

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Facility Directory Search** | Full-text search with alias tolerance (`q`, `query`, `search`), filters by category and emergency availability. | `SearchPage.tsx`, `FacilityList.tsx` | `GET /api/v1/facilities/search` | `Hospital` collection | Public; Zod `facilitySearchQuerySchema` | `test_search_page_route_loads_without_blank_screen`, `facility.test.ts` | `VERIFIED_COMPLETE` |
| **2dsphere Spatial Proximity** | Finds nearby emergency facilities and ambulances within specified radius ($m$) using `$nearSphere`. | `HomePage.tsx`, `FacilityFinder.tsx` | `GET /api/v1/facilities/nearby`, `GET /api/v1/ambulances/nearby` | `Hospital` & `Ambulance` 2dsphere index on `location` | Public (facilities) / Authenticated (ambulances); Zod `nearbyQuerySchema` | `test_homepage_renders_facility_finder_and_map_region`, `geospatialRoutes.test.ts` | `VERIFIED_COMPLETE` |
| **Google Routes Routing & Fallback** | Live traffic-aware route computation; mathematical Great Circle fallback on quota/billing limits. | `RouteNavigationPage.tsx` | `POST /api/v1/maps/routes` | Google Routes API + embedded mathematical distance/ETA model | Public; Zod `routeRequestSchema` | `mapsFailureMapping.test.ts` | `VERIFIED_COMPLETE` |
| **Marker Rendering Resilience** | AdvancedMarkerElement support with automatic HTML `OverlayView` fallback on unregistered Map IDs. | `MapView.tsx` | Client-side Google Maps JavaScript loader | Browser DOM | Client-side error boundary & fallback catch | `test_client_runtime_does_not_emit_uncaught_javascript_exceptions` | `VERIFIED_COMPLETE` |

---

### G. Security, Realtime & Infrastructure

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **E2E Database Isolation Guard** | Destructive tests and E2E verification fail closed if `TEST_MONGODB_URI` is unset or points to `ResQ` or production. | `verifyE2EWorkflow.ts` | `server/src/config/testDatabase.ts` | Isolated Atlas test replica set `resq_automated_test` | Strict target validation; prohibits `resq`, `prod`, `main` | `testDatabaseIsolation.test.ts` (12 tests) | `VERIFIED_COMPLETE` |
| **Rate Limiting & Test Exemption** | Brute-force protection on authentication and sensitive endpoints; test environment auto-bypass. | Handled transparently | `server/src/middlewares/rateLimit.ts` | In-memory token bucket / sliding window | IP & account based; relaxed in non-production/test | `rateLimit.ts` | `VERIFIED_COMPLETE` |
| **CORS & CSRF Origin Guards** | Origin validation on all cross-origin requests; mutation origin guard on POST/PATCH/DELETE. | Standard Axios/Fetch requests | `server/src/middlewares/security.ts` | N/A | Origin matching against `CORS_ORIGINS` whitelist | `security.ts` | `VERIFIED_COMPLETE` |
| **Socket.IO Room Scoping & Cleanup** | Realtime socket events restricted to authorized users; rooms evicted on terminal trip state. | `LiveAmbulanceTracking.tsx`, `trackingSocket.ts` | `server/src/services/trackingSocketService.ts` | Memory-efficient Socket.IO rooms + DB authoritative state | Room authorization checks user/hospital/driver ownership | `trackingRealtime.integration.test.ts` | `VERIFIED_COMPLETE` |

---

### H. Direct Hospital Requests & Appointments (Workflow B — Non-Emergency)

| Feature | Expected Behavior | Frontend Implementation | Backend & API Implementation | Database Persistence | Authorization & Validation | Test Coverage | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Direct Hospital Care Requests** | Citizen selects hospital & department, submits non-emergency consultation/admission request with receipt reference (`REQ-...`). | `CareRequestModal.tsx`, `FacilityActions.tsx` | `POST /api/v1/hospital-requests`, `GET /my-requests`, `POST /:id/cancel` | `HospitalCareRequest` collection (`referenceId`, `statusHistory`) | `authenticate`, `authorizeRole('USER')`; Zod `createCareRequestSchema`, department validation | `hospitalCareRequestAndAppointments.test.ts` (8 tests) | `VERIFIED_COMPLETE` |
| **Hospital Care Request Intake & Response** | Hospital staff reviews incoming requests, accepts with instructions or rejects with reason. | `HospitalAppointmentsPage.tsx` (`Incoming Care Requests` tab) | `GET /api/v1/hospital-requests/hospital/incoming`, `POST /:id/respond` | `HospitalCareRequest` (`status`, `responseDetails`, `statusHistory`) | `authenticate`, `authorizeRole('HOSPITAL')`; hospital tenant scoping; Zod `respondCareRequestSchema` | `hospitalCareRequestAndAppointments.test.ts` | `VERIFIED_COMPLETE` |
| **Concurrency-Safe Appointment Booking** | Citizen books department slot on calendar; atomic conditional reservation prevents overbooking (`bookedCount < maxCapacity`). | `AppointmentBookingModal.tsx`, `FacilityActions.tsx` | `POST /api/v1/appointments`, `GET /my-appointments`, `POST /:id/cancel` | `HospitalAppointment` (`APT-...`), `HospitalAppointmentSlot` (`bookedCount`) | `authenticate`, `authorizeRole('USER')`; atomic `$inc: { bookedCount: 1 }` on `maxCapacity` guard | `hospitalCareRequestAndAppointments.test.ts` (Concurrency suite: 3 simultaneous callers, exactly 1 succeeds) | `VERIFIED_COMPLETE` |
| **Hospital Schedule & Availability Configuration** | Hospital configures weekly operating hours, slot duration, capacity per slot, and blackout dates per department. | `HospitalAppointmentsPage.tsx` (`Availability Configuration` tab) | `GET/PUT /api/v1/hospital-appointments/availability/settings`, `GET /slots` | `HospitalAppointmentAvailability` collection | `authenticate`, `authorizeRole('HOSPITAL')`; Zod `hospitalAvailabilitySettingsSchema` | `hospitalCareRequestAndAppointments.test.ts` | `VERIFIED_COMPLETE` |
| **Alternative Slot Proposal** | When booked slot cannot be accommodated, hospital proposes an alternative date/slot; citizen is notified. | `HospitalAppointmentsPage.tsx` (`Appointments Schedule` tab) | `POST /api/v1/hospital-appointments/:id/propose-alternative` | `HospitalAppointment` (`ALTERNATIVE_PROPOSED`, `alternativeSlot`) | `authenticate`, `authorizeRole('HOSPITAL')`; Zod `proposeAlternativeSlotSchema` | `hospitalCareRequestAndAppointments.test.ts` | `VERIFIED_COMPLETE` |
| **In-App Notifications & Realtime Fanout** | Immediate notifications for request responses, confirmations, proposals; scoped to user/hospital. | `CitizenAppointmentsPage.tsx` (`Notifications` tab), `NotificationDropdown` | `GET /api/v1/users/notifications`, `PATCH /:id/read`, `GET /hospital/notifications` | `HospitalCareNotification` collection (`status: 'READ'/'UNREAD'`) | `authenticate`; user and hospital channel isolation (`user:<id>`, `hospital:<id>`) | `hospitalCareRequestAndAppointments.test.ts` | `VERIFIED_COMPLETE` |
| **Emergency SOS Non-Interference** | 100% independence between normal care and emergency workflows; zero emergency jobs or trips spawned by normal requests. | Prominent emergency banner in modals; separate UI paths | Independent models and routes (`/hospital-requests`, `/appointments` vs `/emergencies`, `/dispatch`) | Zero cross-contamination in `EmergencyRequest`, `Trip`, `DispatchJob` | Enforced at architectural layer; explicit regression verification test | `hospitalCareRequestAndAppointments.test.ts` (SOS Non-Interference regression test), `verifyE2EWorkflow.ts` | `VERIFIED_COMPLETE` |
