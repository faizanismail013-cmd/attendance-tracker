export type UserRole = 'admin' | 'employee';
export type UserStatus = 'active' | 'inactive';
export type AttendanceType = 'office' | 'field' | 'work_from_home';
export type AttendanceStatus = 'present' | 'late' | 'incomplete' | 'absent';
export type CorrectionStatus = 'pending' | 'approved' | 'rejected';
export type LeaveType = 'casual' | 'sick' | 'paid' | 'unpaid' | 'other';
export type LeaveStatus = 'pending' | 'approved' | 'rejected';

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  employee_code: string | null;
  department: string | null;
  joining_date: string | null;
  status: UserStatus;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_accuracy: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_out_accuracy: number | null;
  attendance_type: AttendanceType;
  status: AttendanceStatus;
  field_notes?: string | null;
  wfh_reason?: string | null;
  is_corrected?: boolean;
  created_at: string;
  updated_at: string;
  // Join fields
  profiles?: Profile | null;
  employee?: Profile | null;
}

export interface OfficeSettings {
  id: string;
  office_name: string;
  latitude: number;
  longitude: number;
  office_latitude: number;
  office_longitude: number;
  radius_meters: number;
  allowed_radius_meters: number;
  geofence_enabled: boolean;
  working_start_time: string;
  working_end_time: string;
  grace_period_minutes: number;
  wfh_allowed: boolean;
  location_accuracy_threshold?: number;
  created_at: string;
  updated_at: string;
}

export interface AttendanceCorrection {
  id: string;
  attendance_id: string | null;
  employee_id: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  status: CorrectionStatus;
  admin_notes?: string | null;
  admin_comment?: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  // Join fields
  profiles?: Profile | null;
  employee?: Profile | null;
  attendance?: Attendance | null;
}

export interface LeaveRequest {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  leave_type: LeaveType;
  reason: string;
  status: LeaveStatus;
  admin_notes?: string | null;
  admin_comment?: string | null;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  // Join fields
  profiles?: Profile | null;
  employee?: Profile | null;
}

export interface DailySummary {
  totalEmployees: number;
  presentToday: number;
  currentlyWorking: number;
  absentToday: number;
  lateToday: number;
  wfhToday?: number;
  fieldToday?: number;
}

export interface MonthlyEmployeeSummary {
  employee: Profile;
  total_present: number;
  present_days: number;
  late_days: number;
  office_days: number;
  field_days: number;
  wfh_days: number;
  leave_days: number;
  total_work_hours: number;
}

export interface MonthlyReport {
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  summaries: MonthlyEmployeeSummary[];
}
