# ResQ 2.0 — Comprehensive Manual Testing Guide & End-to-End Test Plan

**Document Version:** 2.0  
**Target Environment:** Local Development / Staging  
**Platform URL:** `http://localhost:5173` (Frontend) | `http://localhost:5001` (Backend API)

---

## 1. Quick-Start Setup & Prerequisites

### 1.1 Start Backend and Frontend
Open two separate terminal windows:

**Terminal 1 (Backend API):**
```bash
cd /Users/shubham/Desktop/projectResQ/ResQ/frontend/server
npm run dev
# Expected output:
# Server listening on port 5001
# Connected to MongoDB: ResQ
```

**Terminal 2 (Frontend Client):**
```bash
cd /Users/shubham/Desktop/projectResQ/ResQ/frontend
npm run dev
# Expected output:
# VITE v8.3.2 ready in 150 ms
# ➜ Local: http://localhost:5173/
```

### 1.2 Seed Test Accounts
If your database has not yet been seeded, run the demo seeding script from the `server` folder:
```bash
cd server
npm run seed:demo
```

### 1.3 Verified Test Credentials Matrix

| Role | Portal URL | Test Email | Test Password | Primary Function |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Admin** | `http://localhost:5173/admin/login` | `admin@resq.local` | `Shubh@m2006734013` | System oversight, audit logs, entity verification |
| **Citizen (User)** | `http://localhost:5173/login` | `demo.user@resq.local` | `Password@123` | SOS emergency, ambulance booking, hospital search |
| **Hospital Admin** | `http://localhost:5173/login` | `demo.hospital@resq.local` | `Password@123` | Emergency triage, bed capacity, appointments |
| **Paramedic Driver**| `http://localhost:5173/login` | `demo.driver@resq.local` | `Password@123` | Shift on/off duty, dispatch trips, GPS navigation |
| **Ambulance Provider**| `http://localhost:5173/login`| `demo.provider@resq.local`| `Password@123` | Fleet registration, driver roster, fleet tracking |

> **Tip for Multi-Role Testing:** Open two distinct browser profiles or one normal window and one Incognito/Private window (e.g. Chrome normal for Citizen, Chrome Incognito for Paramedic Driver, Firefox for Hospital Admin) so cookie sessions do not overwrite each other.

---

## 2. Test Scenario 1: End-to-End Emergency SOS & Live Ambulance Dispatch

**Objective:** Verify that a citizen triggering an emergency causes an immediate dispatch assignment to an on-duty paramedic driver, with real-time GPS tracking updates and hospital arrival coordination.

### Step-by-Step Execution:

1. **Prepare Paramedic Driver (Window A - Incognito):**
   - Navigate to `http://localhost:5173/login`.
   - Sign in as `demo.driver@resq.local` / `Password@123`.
   - On the Driver Dashboard (`/driver/dashboard`), check the **Duty Status** toggle.
   - Switch status to **ON DUTY** (Badge should turn emerald green: `ON DUTY`).
   - Leave this window open on `/driver/dashboard` or `/driver/assignments`.

2. **Trigger SOS as Citizen (Window B - Normal Browser):**
   - Navigate to `http://localhost:5173/login`.
   - Sign in as `demo.user@resq.local` / `Password@123`.
   - You are redirected to `/user/dashboard`.
   - Click the prominent red **"SOS EMERGENCY"** button in the header or the hero banner.
   - On the emergency modal, choose your situation type (e.g. *Severe Trauma / Cardiac Arrest*), confirm location, and click **"Dispatch Ambulance Immediately"**.

3. **Verify Driver Assignment (Window A):**
   - Within 2–5 seconds, the driver portal receives the dispatch offer.
   - Click **"Accept Assignment"** before the countdown timer expires.
   - The driver UI automatically transitions to the active navigation screen (`/driver/navigation/:id`).

4. **Verify Citizen Live Tracking (Window B):**
   - The citizen's browser transitions to `/user/tracking/:requestId`.
   - **Check:**
     - Ambulance details (License plate, driver name, vehicle model) appear.
     - The map displays the ambulance marker moving toward the patient pickup location.
     - Live ETA badge is calculated and visible.

5. **Execute Driver Trip Milestones (Window A):**
   - Click **"Arrived at Patient"** (State: `AT_PICKUP`).
   - Click **"Patient Onboard"** (State: `PATIENT_ONBOARD`). Navigation switches destination to the receiving hospital.
   - Click **"Arrived at Hospital"** (State: `AT_HOSPITAL`).
   - Click **"Trip Completed"** (State: `COMPLETED`).

6. **Verify Resolution (Both Windows):**
   - In Window B, the citizen tracking page marks the trip as `COMPLETED` and prompts for emergency service feedback.
   - In Window A, the driver returns to available status.

---

## 3. Test Scenario 2: Hospital Discovery & Direct Care Intake

**Objective:** Verify that a citizen can find an accredited hospital by specialty, inspect bed availability, and submit a non-emergency care request.

### Step-by-Step Execution:

1. **Citizen Search & Request (Window B):**
   - Go to `http://localhost:5173/user/hospitals`.
   - Type `"Memorial"` or `"General"` in the search bar.
   - Select the filter for `"Cardiology"` or `"Emergency Care"`.
   - Click on the hospital card to open the Facility Detail Page (`/user/hospitals/:id`).
   - Verify that bed counts (ICU, Emergency, General Ward) and doctor specializations render.
   - Click **"Submit Direct Care Request"**.
   - Fill in patient complaint (e.g. *"High persistent fever and chest discomfort"*) and submit.

2. **Hospital Reception & Review (Window C - Second Browser Profile):**
   - Sign in to `http://localhost:5173/login` as `demo.hospital@resq.local` / `Password@123`.
   - Navigate to **"Emergency & Care Requests"** (`/hospital/requests`).
   - The newly submitted care request appears in the queue with status `RECEIVED`.
   - Click on the request. Review patient details.
   - Click **"Accept Patient"** or **"Prepare Intake"**.

3. **Citizen Confirmation (Window B):**
   - In the citizen portal, check **"Notifications"** (`/user/notifications`) or **"My Requests"**.
   - Verify the request status updates to `ACCEPTED` with hospital preparation notes.

---

## 4. Test Scenario 3: Concurrency-Safe Hospital Appointment Booking

**Objective:** Verify that doctor appointment scheduling calculates slots accurately and atomically rejects over-booking when capacity is 1.

### Step-by-Step Execution:

1. **Citizen Appointment Booking:**
   - Logged in as `demo.user@resq.local`, navigate to `http://localhost:5173/user/appointments`.
   - Click **"Book New Appointment"**.
   - Select hospital, department (e.g. *Cardiology*), and date.
   - Available time slots are dynamically queried from `HospitalAppointmentAvailabilityModel`.
   - Select a time slot and confirm booking.
   - Verify immediate confirmation card with Appointment ID, QR code, and department instructions.

2. **Concurrency Verification (Simulated Race Condition):**
   - Open a slot with capacity `1`.
   - Attempt to book the same slot simultaneously from two separate browser sessions.
   - **Expected Behavior:** Session 1 receives HTTP 201 Created. Session 2 receives an alert: *"Selected slot is fully booked. Please choose an alternative time."*
   - Verify in MongoDB: `bookedCount` equals `1` and does not exceed `maxCapacity`.

---

## 5. Test Scenario 4: Ambulance Fleet & Paramedic Management

**Objective:** Verify that an ambulance fleet provider can register vehicles and inspect driver rosters.

### Step-by-Step Execution:

1. **Sign in as Ambulance Provider:**
   - Navigate to `http://localhost:5173/login`.
   - Sign in as `demo.provider@resq.local` / `Password@123`.
   - Redirects to `/provider/dashboard`.

2. **Register a New Ambulance:**
   - Click **"Ambulances"** in the sidebar (`/provider/ambulances`).
   - Click **"Register Ambulance"**.
   - Enter Vehicle Plate Number (`DL-01-AB-1234`), Type (`ADVANCED_LIFE_SUPPORT`), and VIN.
   - Submit form. Verify the new vehicle appears in the fleet table with status `ACTIVE`.

3. **Inspect Driver Roster:**
   - Click **"Drivers"** (`/provider/drivers`).
   - Inspect active paramedic drivers assigned to the provider.
   - Verify driver phone number, driving license number, and shift history display correctly.

---

## 6. Test Scenario 5: Platform Governance & Immutable System Audit Logs

**Objective:** Verify that super-administrators can monitor system activity and inspect immutable audit trail logs.

### Step-by-Step Execution:

1. **Sign in as Platform Super-Admin:**
   - Navigate to `http://localhost:5173/admin/login`.
   - Enter `admin@resq.local` / `Shubh@m2006734013`.
   - Redirects to `/admin/dashboard`.

2. **Inspect System Audit Logs:**
   - Click **"Audit Logs"** in the sidebar navigation (`/admin/audit-logs`).
   - The table displays chronological audit logs:
     - **Timestamp:** ISO format rendered in local timezone.
     - **Actor Role:** Badged indicator (`ADMIN`, `SYSTEM`, `HOSPITAL`, `AMBULANCE_PROVIDER`).
     - **Action:** Operation performed (e.g. `HOSPITAL_STATUS_UPDATE`, `APPOINTMENT_CANCELLED`).
     - **Entity Type & ID:** Linked target record.
   - Use the **Entity Type** dropdown filter to filter by `User`, `Hospital`, or `EmergencyRequest`.
   - Click **"Refresh"** to pull the latest entries.

---

## 7. Test Scenario 6: Password Reset Security Flow

**Objective:** Verify that the password reset workflow delivers links securely via email, uses cryptographic token hashing, invalidates active sessions, and rejects replays.

### Step-by-Step Execution:

1. **Initiate Reset:**
   - From `http://localhost:5173/login`, click **"Forgot Password?"**.
   - Enter email `demo.user@resq.local` and click **"Send Reset Link"**.
   - The page displays: *"If an account with this email exists, a reset link has been sent."*
   - In local development (console mailer mode), inspect your backend terminal output to view the generated link:
     ```
     [DEV MAILER] Reset Link: http://localhost:5173/reset-password?token=abcdef...
     ```

2. **Complete Password Reset:**
   - Open the link in a new browser tab.
   - Enter a new password (minimum 8 characters) and confirm it.
   - Click **"Update Password"**.
   - Success screen confirms: *"Password updated successfully. You may now sign in."*

3. **Verify Security Invalidation:**
   - Try logging in with the old password (`Password@123`).
   - **Expected:** Login fails with HTTP 401 Unauthorized.
   - Log in with the new password.
   - **Expected:** Login succeeds immediately.
   - Re-open the reset link in your browser and try submitting again.
   - **Expected:** Server rejects with: *"Password reset token is invalid or has expired."* (Replay prevention).

---

## 8. Common Troubleshooting & Manual Testing FAQs

- **Issue:** *Geolocation error: "User denied Geolocation"*
  - **Resolution:** Click the padlock/settings icon in the browser address bar, set Location to "Allow", and reload the page.
- **Issue:** *Map markers do not appear or raster map shows watermark*
  - **Resolution:** Verify `VITE_GOOGLE_MAPS_API_KEY` is present in `.env`. If using local development without internet, map gracefully falls back to offline schematic view.
- **Issue:** *Socket.IO disconnects or shows reconnecting*
  - **Resolution:** Verify backend is running on port 5001 and CORS origins include `http://localhost:5173`.
