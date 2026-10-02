# PPR Attendance Tracker — Complete Handover & Delivery Manual

**Production Application Link**: [https://ppr-attendance.vercel.app](https://ppr-attendance.vercel.app)

---

## 📌 Executive Summary

**PPR Attendance Tracker** is a high-reliability, mobile-first, Progressive Web App (PWA) designed for modern workforce attendance management. It features:
- **Instant Geofencing & GPS Verification**: Enforces physical presence at headquarters while enabling legitimate Field Visits and Work From Home (WFH).
- **Multi-Session Attendance Support**: Employees can check in, check out, and check in again on the same day (e.g., morning office shift + afternoon field visit), with all sessions clearly bifurcated under that single date.
- **Enterprise Security & Privacy**: Location coordinates are captured only at the instant of check-in/out. Initial/temporary passwords trigger mandatory password changes upon first login.
- **Automated Reporting**: Monthly breakdown counting unique days present, clickable day-by-day month calendars (P/A/L/LV/W), and instant CSV export for payroll.

---

## 👑 Part 1: Administrator Operations Manual

### 1. Logging In as Admin
1. Open [https://ppr-attendance.vercel.app/login](https://ppr-attendance.vercel.app/login).
2. Enter your Admin credentials.
3. You will be automatically routed to the **Admin Dashboard** (`/admin/dashboard`).

### 2. Configuring Office Location & Geofencing
1. In the sidebar, navigate to **Office Settings** (`/admin/settings`).
2. Set your office location:
   - **Office Latitude & Longitude**: Enter your coordinates, or click **"Use My Current GPS Position"** while standing at the office.
   - **Allowed Radius**: Set allowed check-in radius (e.g., `100` to `200` meters).
   - **Enable GPS Geofencing**: Check to enforce proximity checks for office check-ins.
   - **Shift Hours & Grace Period**: Set official start time (e.g., `09:00:00`), end time, and grace period (e.g., `15` minutes). Check-ins after this are flagged **Late**.
   - **Work Policies**: Toggle WFH and Field Visit availability.
3. Click **Save Settings**.

### 3. Adding New Employees
1. In the sidebar, navigate to **Employees** (`/admin/employees`).
2. Click **"+ Add New Employee"**.
3. Fill in:
   - Full Name
   - Email Address
   - Initial Temporary Password (e.g., `Ppr@2026`)
   - Employee Code (e.g., `EMP-101`)
   - Department & Joining Date
4. Click **Create Employee**.
   > *Note:* If an employee email was registered earlier or their profile was previously removed, the system will automatically re-link, reset their password to the one you specified, and restore their profile without errors.
5. The employee is automatically flagged with **Mandatory Password Change**. When they first log in, they will be required to choose their own personal password.

### 4. Live Dashboard & Interactive Popups
1. On **Admin Overview** (`/admin/dashboard`):
   - **Total Staff**: All active employees.
   - **Present**: Unique employees who checked in today.
   - **Working**: Employees currently on an active session.
   - **Late**: Employees who checked in after the grace period.
   - **Absent**: Employees who have not checked in today.
   - **WFH & Field**: Real-time count of remote and on-site staff.
2. **Interactive Popups**: Click on any metric card to open a full popup list of matching staff members, their departments, session counts, and work status.
3. **Session Bifurcation**: In **Today's Employee Roster**, click on any employee row to expand an accordion below them, displaying each separate session (Check-In, Check-Out, Duration, Work Type, GPS Map link, and Notes).

### 5. Reviewing Leaves & Attendance Corrections
- **Leave Requests** (`/admin/leaves`): Review staff applications for Casual, Sick, or Earned leaves. Approve or reject with optional admin comments.
- **Corrections** (`/admin/corrections`): When an employee forgets to check out or needs a time adjustment, review their request and approve to automatically update the official attendance log.

### 6. Monthly Reports & Payroll CSV Export
1. In the sidebar, open **Reports & CSV** (`/admin/reports`).
2. Select the **Month** and **Year**.
3. View unique days present, late days, office days, field days, WFH days, and total hours worked.
4. **Month Calendar Drill-down**: Click on any employee row to view their entire month calendar:
   - **[P] Green**: Present (with hours worked)
   - **[L] Amber**: Late arrival
   - **[A] Red**: Absent
   - **[LV] Purple**: Approved Leave
   - **[W] Slate**: Weekend
5. Click **"Export CSV Report"** to download an Excel-ready spreadsheet for payroll processing.

---

## 📱 Part 2: Employee User Guide

### 1. Installing the App (Mobile PWA)
- **On Android (Chrome)**:
  1. Open [https://ppr-attendance.vercel.app](https://ppr-attendance.vercel.app).
  2. Tap the three dots menu (⋮) → tap **"Install App"** or **"Add to Home Screen"**.
  3. The **PPR Attendance Tracker** app icon will appear directly on your home screen.
- **On iPhone (Safari)**:
  1. Open [https://ppr-attendance.vercel.app](https://ppr-attendance.vercel.app).
  2. Tap the **Share** button (box with upward arrow) → tap **"Add to Home Screen"**.
  3. Tap **Add** in the top right.

### 2. First-Time Login & Setting Password
1. Enter your registered company email and the initial temporary password provided by your Admin.
2. Click **Sign In**.
3. You will immediately see the **"Set Your New Password"** screen.
4. Type your new secret password (minimum 6 characters), re-type to confirm, and click **Save New Password & Continue**.

### 3. Recording Attendance (Check-In & Check-Out)
1. On your Dashboard, select your attendance mode:
   - **🏢 Office**: Make sure your phone's GPS/Location is enabled. The app verifies that you are physically within the office geofence zone.
   - **🧭 Field Visit**: Enter your destination notes (e.g., "Client meeting at Tech Park") and click check in.
   - **🏠 Work From Home**: Enter your WFH reason and submit.
2. Click the large blue **CHECK IN NOW** button.
3. While checked in, a real-time live ticker shows your active working duration.
4. At the end of your shift or meeting, click the red **CHECK OUT NOW** button.

### 4. Checking In Multiple Times on the Same Day
- If you work from the office in the morning (10:00 AM – 1:00 PM), check out for lunch, and then go for a field visit in the afternoon (2:00 PM – 5:00 PM):
  - After checking out at 1:00 PM, the button updates to **"CHECK IN AGAIN"**.
  - Choose your next attendance type (e.g. Field Visit) and check in again!
  - Both sessions are recorded and aggregated under today's date.

### 5. Viewing Attendance History
- Under **Attendance History**, each calendar date appears as a single row showing your total hours worked.
- Click on any date to expand all sessions recorded on that day.

### 6. Applying for Leave or Corrections
- Use the bottom navigation bar to open **My Leaves** to request time off, or **Corrections** if you forgot to check out and need a time adjustment.

---

## 🛠️ Part 3: Technical Specifications & Maintenance

### Tech Stack
| Component | Technology | Version / Notes |
| :--- | :--- | :--- |
| **Frontend Framework** | Next.js (App Router, Turbopack) | 16.3.8 |
| **Language** | TypeScript | Strict typing |
| **Styling** | Vanilla CSS + Tailwind CSS | Responsive, Mobile-First |
| **Icons** | Lucide React | High-contrast visual tokens |
| **Backend & Auth** | Supabase (PostgreSQL) | RLS Policies + Admin Auth |
| **Deployment** | Vercel Serverless Platform | Production-grade CDN & SSL |

### Resetting Test Data (Clean Slate for Handover)
To wipe test records and start fresh for company launch:
1. Open **[Supabase Dashboard](https://supabase.com/dashboard)** → Project `urpldlqgwwnfmytyxayq`.
2. Go to **SQL Editor** → **New Query**.
3. Run the following cleanup statement:
```sql
TRUNCATE TABLE public.attendance CASCADE;
TRUNCATE TABLE public.leave_requests CASCADE;
TRUNCATE TABLE public.attendance_corrections CASCADE;
TRUNCATE TABLE public.audit_logs CASCADE;
```
*(Employee login accounts in `profiles` and `auth.users` remain intact, while all test attendance and logs are cleared.)*

---
*Delivered by Antigravity Engineering for PPR Attendance Tracker.*
