-- Migration: 002_phase2_schema.sql
-- Description: Phase 2 schema additions for geofencing, field notes, WFH, corrections, and leave management

-- 1. ENHANCE office_settings TABLE
ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS wfh_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS office_latitude NUMERIC DEFAULT 28.6139,
  ADD COLUMN IF NOT EXISTS office_longitude NUMERIC DEFAULT 77.2090,
  ADD COLUMN IF NOT EXISTS radius_meters NUMERIC DEFAULT 100,
  ADD COLUMN IF NOT EXISTS location_accuracy_threshold NUMERIC NOT NULL DEFAULT 100;

-- 2. ENHANCE attendance TABLE
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS field_notes TEXT,
  ADD COLUMN IF NOT EXISTS wfh_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN NOT NULL DEFAULT false;

-- 3. ATTENDANCE CORRECTIONS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_id UUID REFERENCES public.attendance(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requested_check_in TIMESTAMPTZ,
    requested_check_out TIMESTAMPTZ,
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_notes TEXT,
    admin_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 4. LEAVE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('casual', 'sick', 'earned', 'paid', 'unpaid', 'other')) DEFAULT 'casual',
    reason TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    admin_notes TEXT,
    admin_comment TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT valid_leave_dates CHECK (end_date >= start_date)
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_corrections_employee_id ON public.attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_corrections_attendance_id ON public.attendance_corrections(attendance_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON public.attendance_corrections(status);
CREATE INDEX IF NOT EXISTS idx_leave_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON public.leave_requests(start_date, end_date);

-- 6. UPDATED_AT TRIGGERS
CREATE OR REPLACE TRIGGER set_corrections_updated_at
    BEFORE UPDATE ON public.attendance_corrections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 7. ROW LEVEL SECURITY
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- Attendance Corrections Policies
CREATE POLICY "Users view own corrections or admins view all"
    ON public.attendance_corrections FOR SELECT
    USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users create own corrections"
    ON public.attendance_corrections FOR INSERT
    WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins can update corrections"
    ON public.attendance_corrections FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete corrections"
    ON public.attendance_corrections FOR DELETE
    USING (public.is_admin());

-- Leave Requests Policies
CREATE POLICY "Users view own leave or admins view all"
    ON public.leave_requests FOR SELECT
    USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users create own leave requests"
    ON public.leave_requests FOR INSERT
    WITH CHECK (employee_id = auth.uid());

CREATE POLICY "Admins can update leave requests"
    ON public.leave_requests FOR UPDATE
    USING (public.is_admin());

CREATE POLICY "Admins can delete leave requests"
    ON public.leave_requests FOR DELETE
    USING (public.is_admin());
