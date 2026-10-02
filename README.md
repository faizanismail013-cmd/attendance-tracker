# PulseAttendance — Enterprise Employee Portal & Attendance Tracker

PulseAttendance is a production-grade, Progressive Web App (PWA) attendance management system built with Next.js 15, TypeScript, Tailwind CSS, and Supabase.

It supports high-accuracy GPS verification, office geofencing, field visits, Work From Home (WFH) tracking, attendance correction workflows, leave management, monthly reports with CSV export, audit logging, and role-based access control.

---

## 🌟 Key Features

### Employee Experience
- **PWA & Mobile-First**: Installable as a standalone app on Android & iOS devices.
- **GPS Check-In & Check-Out**: Touch-optimized large action buttons with location verification.
- **Attendance Modes**:
  - **Office**: Verified against configured GPS office coordinates and geofence radius.
  - **Field Visit**: Captures destination notes and coordinates.
  - **Work From Home (WFH)**: Validates company policy and logs justification.
- **Live Shift Timer**: Real-time ticker for active working hours.
- **Leave Management**: Apply for Casual, Sick, Earned, or Unpaid leaves.
- **Attendance Corrections**: Request adjustments for missed check-ins/outs.
- **Personal Profile**: View and safely update contact information.

### Admin Experience
- **Real-Time Overview**: Live metrics for present, late, absent, working, WFH, and field employees.
- **Office & Policy Settings**: Configure company name, office coordinates (lat/lng), radius (meters), shift start/end times, grace period, minimum working hours, and WFH/Field policy toggles.
- **Leave & Correction Approvals**: Review pending requests with admin notes; automatic attendance record updates upon approval.
- **Monthly Reports & CSV Export**: Detailed employee summaries and instant CSV exports.
- **Audit Logs**: Full audit trail recording all administrative updates and policy modifications.
- **Employee Management**: Provision accounts, toggle active/inactive status, and manage staff roles.

---

## 🏗️ Architecture & Technology Stack

- **Framework**: Next.js 15 (App Router with Turbopack)
- **Language**: TypeScript
- **Database & Auth**: Supabase (PostgreSQL with Row Level Security & Auth triggers)
- **Styling**: Tailwind CSS & Lucide Icons
- **PWA**: Web App Manifest, Service Worker caching, and Mobile Meta Viewport
- **Timezone**: Asia/Kolkata (IST) display formatting with ISO UTC database storage

---

## 🔐 Security & Privacy Model

1. **Row Level Security (RLS)**: Strictly enforced across all tables (`profiles`, `attendance`, `office_settings`, `attendance_corrections`, `leave_requests`, `audit_logs`).
2. **Role Authorization**: `public.is_admin()` helper function ensures security definer validation without recursion.
3. **Location Privacy**: GPS location is captured **only** at the explicit instant of Check In or Check Out. No continuous background tracking.
4. **Secret Isolation**: `SUPABASE_SERVICE_ROLE_KEY` is restricted strictly to server side code and never exposed to the client.

---

## 🗄️ Database Schemas & Migrations

All migrations are located in `supabase/migrations/`:
- `001_initial_schema.sql`: Profiles, attendance, office settings, RLS policies, signup trigger.
- `002_phase2_schema.sql`: Attendance corrections, leave requests, geofence radius additions.
- `003_phase3_schema.sql`: Audit logs table, company policy settings.

---

## 🚀 Local Development Setup

1. **Clone the Repository**:
   ```bash
   git clone <repo-url>
   cd ppr-attendance
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-url.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
   ```

4. **Run Database Migrations**:
   Execute `001_initial_schema.sql`, `002_phase2_schema.sql`, and `003_phase3_schema.sql` in your Supabase SQL Editor.

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your browser.

---

## ☁️ Deployment to Vercel

1. **Push to GitHub**:
   ```bash
   git add .
   git commit -m "Production release"
   git push origin main
   ```

2. **Deploy via Vercel CLI / Dashboard**:
   ```bash
   npx vercel --prod
   ```

3. **Configure Environment Variables on Vercel**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 🧪 Production Verification Checklist

- [x] Next.js build (`npm run build`) passes cleanly.
- [x] Admin login & Employee login authentication flows.
- [x] GPS location capture with accuracy threshold and geofence check.
- [x] Leave and Correction application & approval workflows.
- [x] Monthly report calculations and CSV export download.
- [x] PWA installation on mobile browsers.
