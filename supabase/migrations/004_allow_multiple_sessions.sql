-- Migration: 004_allow_multiple_sessions.sql
-- Description: Remove the unique constraint on (employee_id, attendance_date) to allow multiple check-in/out sessions per day

-- Drop the unique constraint that prevents multiple sessions per day
ALTER TABLE public.attendance DROP CONSTRAINT IF EXISTS unique_employee_attendance_per_date;
