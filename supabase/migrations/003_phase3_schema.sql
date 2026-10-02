-- Migration: 003_phase3_schema.sql
-- Description: Phase 3 schema for audit logs, enhanced company settings & policies

-- 1. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. ENHANCE office_settings TABLE WITH COMPANY SETTINGS & POLICIES
ALTER TABLE public.office_settings
  ADD COLUMN IF NOT EXISTS company_name TEXT NOT NULL DEFAULT 'PulseEnterprise Corp',
  ADD COLUMN IF NOT EXISTS allow_field BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS require_location BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS min_working_hours NUMERIC NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS late_threshold_minutes INT NOT NULL DEFAULT 15;

-- 3. INDEXES FOR AUDIT LOGS
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON public.audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- 4. ROW LEVEL SECURITY FOR AUDIT LOGS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

CREATE POLICY "Authenticated users and system can insert audit logs"
    ON public.audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL OR public.is_admin());
