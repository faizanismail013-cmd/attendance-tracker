-- ==============================================================================
-- PULSE ATTENDANCE - COMPLETE CONSOLIDATED MIGRATION
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query -> Run)
-- Enables: Multi-session Check-In/Out, Leaves Management, Corrections, Audit Logs
-- ==============================================================================

-- 1. DROP UNIQUE ATTENDANCE CONSTRAINT (Allows multiple check-ins/outs on the same day)
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS unique_employee_attendance_per_date;

-- 2. ENHANCE attendance TABLE
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS field_notes TEXT,
  ADD COLUMN IF NOT EXISTS wfh_reason TEXT,
  ADD COLUMN IF NOT EXISTS is_corrected BOOLEAN NOT NULL DEFAULT false;

-- 3. ENHANCE office_settings TABLE
ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT 'PulseEnterprise Corp',
  ADD COLUMN IF NOT EXISTS geofence_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS wfh_allowed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_field BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_location BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS office_latitude NUMERIC DEFAULT 28.6139,
  ADD COLUMN IF NOT EXISTS office_longitude NUMERIC DEFAULT 77.2090,
  ADD COLUMN IF NOT EXISTS radius_meters NUMERIC DEFAULT 200,
  ADD COLUMN IF NOT EXISTS location_accuracy_threshold NUMERIC NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS min_working_hours NUMERIC NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS late_threshold_minutes INT NOT NULL DEFAULT 15;

-- 4. ATTENDANCE CORRECTIONS TABLE
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
    updated_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- 5. LEAVE REQUESTS TABLE
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
    updated_at TIMESTAMPTZ DEFAULT now(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT valid_leave_dates CHECK (end_date >= start_date)
);

-- 6. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. INDEXES
CREATE INDEX IF NOT EXISTS idx_corrections_employee_id ON public.attendance_corrections(employee_id);
CREATE INDEX IF NOT EXISTS idx_corrections_attendance_id ON public.attendance_corrections(attendance_id);
CREATE INDEX IF NOT EXISTS idx_corrections_status ON public.attendance_corrections(status);

CREATE INDEX IF NOT EXISTS idx_leave_employee_id ON public.leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_dates ON public.leave_requests(start_date, end_date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 8. UPDATED_AT TRIGGERS
DROP TRIGGER IF EXISTS set_corrections_updated_at ON public.attendance_corrections;
CREATE TRIGGER set_corrections_updated_at
    BEFORE UPDATE ON public.attendance_corrections
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_leaves_updated_at ON public.leave_requests;
CREATE TRIGGER set_leaves_updated_at
    BEFORE UPDATE ON public.leave_requests
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. ENABLE ROW LEVEL SECURITY
ALTER TABLE public.attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 10. POLICIES: ATTENDANCE CORRECTIONS
DROP POLICY IF EXISTS "Users view own corrections or admins view all" ON public.attendance_corrections;
CREATE POLICY "Users view own corrections or admins view all"
    ON public.attendance_corrections FOR SELECT
    USING (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users create own corrections" ON public.attendance_corrections;
CREATE POLICY "Users create own corrections"
    ON public.attendance_corrections FOR INSERT
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update corrections" ON public.attendance_corrections;
CREATE POLICY "Admins can update corrections"
    ON public.attendance_corrections FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete corrections" ON public.attendance_corrections;
CREATE POLICY "Admins can delete corrections"
    ON public.attendance_corrections FOR DELETE
    USING (public.is_admin());

-- 11. POLICIES: LEAVE REQUESTS
DROP POLICY IF EXISTS "Users view own leave or admins view all" ON public.leave_requests;
CREATE POLICY "Users view own leave or admins view all"
    ON public.leave_requests FOR SELECT
    USING (employee_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "Users create own leave requests" ON public.leave_requests;
CREATE POLICY "Users create own leave requests"
    ON public.leave_requests FOR INSERT
    WITH CHECK (employee_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update leave requests" ON public.leave_requests;
CREATE POLICY "Admins can update leave requests"
    ON public.leave_requests FOR UPDATE
    USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete leave requests" ON public.leave_requests;
CREATE POLICY "Admins can delete leave requests"
    ON public.leave_requests FOR DELETE
    USING (public.is_admin());

-- 12. POLICIES: AUDIT LOGS
DROP POLICY IF EXISTS "Admins can view all audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users and system can insert audit logs" ON public.audit_logs;
CREATE POLICY "Authenticated users and system can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL OR public.is_admin());

-- 13. NOTIFY PostgREST TO RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
