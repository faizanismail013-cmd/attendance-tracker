-- Migration: 001_initial_schema.sql
-- Description: Core tables, constraints, indexes, triggers, and RLS policies for Attendance System

-- 1. ENUMS / CHECKS
-- Table: profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin', 'employee')) DEFAULT 'employee',
    employee_code TEXT UNIQUE,
    department TEXT,
    joining_date DATE DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Table: attendance
CREATE TABLE IF NOT EXISTS public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIMESTAMPTZ,
    check_out_time TIMESTAMPTZ,
    check_in_latitude NUMERIC,
    check_in_longitude NUMERIC,
    check_in_accuracy NUMERIC,
    check_out_latitude NUMERIC,
    check_out_longitude NUMERIC,
    check_out_accuracy NUMERIC,
    attendance_type TEXT NOT NULL CHECK (attendance_type IN ('office', 'field', 'work_from_home')) DEFAULT 'office',
    status TEXT NOT NULL CHECK (status IN ('present', 'late', 'incomplete', 'absent')) DEFAULT 'present',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_employee_attendance_per_date UNIQUE(employee_id, attendance_date)
);

-- Table: office_settings
CREATE TABLE IF NOT EXISTS public.office_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    office_name TEXT NOT NULL DEFAULT 'Headquarters Office',
    latitude NUMERIC DEFAULT 28.6139,
    longitude NUMERIC DEFAULT 77.2090,
    allowed_radius_meters NUMERIC DEFAULT 200,
    working_start_time TIME NOT NULL DEFAULT '09:00:00',
    working_end_time TIME NOT NULL DEFAULT '18:00:00',
    grace_period_minutes INT NOT NULL DEFAULT 15,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_created_at ON public.attendance(created_at);

-- 3. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE TRIGGER set_office_settings_updated_at
    BEFORE UPDATE ON public.office_settings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. SECURITY DEFINER HELPER FUNCTION FOR ADMIN CHECK (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- 5. AUTOMATIC PROFILE CREATION TRIGGER FOR AUTH USER SIGNUP
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email, role, employee_code, department, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'role', 'employee'),
        COALESCE(NEW.raw_user_meta_data->>'employee_code', 'EMP-' || SUBSTRING(NEW.id::text, 1, 6)),
        COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
        'active'
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_settings ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Users can view own profile or admins view all"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can insert profiles"
    ON public.profiles FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "Users update own profile or admins update any profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Admins can delete profiles"
    ON public.profiles FOR DELETE
    USING (public.is_admin());

-- Attendance Policies
CREATE POLICY "Users view own attendance or admins view all"
    ON public.attendance FOR SELECT
    USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users create own attendance or admins create for anyone"
    ON public.attendance FOR INSERT
    WITH CHECK (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "Users update own attendance or admins update all"
    ON public.attendance FOR UPDATE
    USING (employee_id = auth.uid() OR public.is_admin());

CREATE POLICY "Admins can delete attendance"
    ON public.attendance FOR DELETE
    USING (public.is_admin());

-- Office Settings Policies
CREATE POLICY "Authenticated users can view office settings"
    ON public.office_settings FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Admins can manage office settings"
    ON public.office_settings FOR ALL
    USING (public.is_admin());

-- 7. INITIAL SEED DATA FOR OFFICE SETTINGS
INSERT INTO public.office_settings (office_name, latitude, longitude, allowed_radius_meters, working_start_time, working_end_time, grace_period_minutes)
SELECT 'Headquarters Office', 28.6139, 77.2090, 200, '09:00:00', '18:00:00', 15
WHERE NOT EXISTS (SELECT 1 FROM public.office_settings);
