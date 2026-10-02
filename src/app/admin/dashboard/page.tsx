'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, Attendance, DailySummary } from '@/types';
import { formatDate, formatTime, calculateWorkingHours, getTodayISODate } from '@/lib/utils/date';
import { getGoogleMapsUrl } from '@/lib/utils/geo';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import {
  Users,
  UserCheck,
  Clock,
  UserX,
  AlertTriangle,
  Search,
  RefreshCw,
  Calendar,
  Home,
  Compass,
  ChevronDown,
  ChevronRight,
  Layers,
  MapPin,
} from 'lucide-react';

type MetricKey = 'total' | 'present' | 'working' | 'late' | 'absent' | 'wfh' | 'field';

interface MetricModalData {
  title: string;
  employees: {
    employee: Profile;
    sessions: Attendance[];
    totalMinutes: number;
    primaryStatus: string;
  }[];
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [todayAttendances, setTodayAttendances] = useState<Attendance[]>([]);
  const [summary, setSummary] = useState<DailySummary>({
    totalEmployees: 0,
    presentToday: 0,
    currentlyWorking: 0,
    absentToday: 0,
    lateToday: 0,
    wfhToday: 0,
    fieldToday: 0,
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Expanded employee IDs in Today's Employee Roster
  const [expandedEmpIds, setExpandedEmpIds] = useState<Set<string>>(new Set());

  // Modal state for clickable metric cards
  const [metricModal, setMetricModal] = useState<MetricModalData | null>(null);

  useEffect(() => {
    let ignore = false;
    async function fetchAdminData() {
      setErrorMessage(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (ignore) return;
        if (authError || !user) {
          router.push('/login');
          return;
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (ignore) return;
        if (profileError || profile?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
        setAdminUser(profile);

        const { data: allProfiles, error: employeesError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });

        if (ignore) return;
        if (employeesError) throw employeesError;
        const empList = allProfiles || [];
        setEmployees(empList);

        const todayDate = getTodayISODate();
        const { data: attList, error: attError } = await supabase
          .from('attendance')
          .select('*, profiles(*)')
          .eq('attendance_date', todayDate)
          .order('check_in_time', { ascending: true });

        if (ignore) return;
        if (attError) throw attError;
        const attendances = attList || [];
        setTodayAttendances(attendances);

        const activeEmployees = empList.filter((e) => e.status === 'active');
        const totalEmpCount = activeEmployees.length;

        // Accurate UNIQUE employee counts (an employee who checked in 2 times is still 1 Present employee)
        const presentEmployeeIds = new Set(
          attendances.filter((a) => a.check_in_time).map((a) => a.employee_id)
        );
        const presentCount = presentEmployeeIds.size;

        const workingEmployeeIds = new Set(
          attendances
            .filter((a) => a.check_in_time && !a.check_out_time)
            .map((a) => a.employee_id)
        );
        const currentlyWorkingCount = workingEmployeeIds.size;

        const lateEmployeeIds = new Set(
          attendances.filter((a) => a.status === 'late').map((a) => a.employee_id)
        );
        const lateCount = lateEmployeeIds.size;

        const absentCount = Math.max(0, totalEmpCount - presentCount);

        const wfhEmployeeIds = new Set(
          attendances
            .filter((a) => a.attendance_type === 'work_from_home')
            .map((a) => a.employee_id)
        );
        const wfhCount = wfhEmployeeIds.size;

        const fieldEmployeeIds = new Set(
          attendances
            .filter((a) => a.attendance_type === 'field')
            .map((a) => a.employee_id)
        );
        const fieldCount = fieldEmployeeIds.size;

        setSummary({
          totalEmployees: totalEmpCount,
          presentToday: presentCount,
          currentlyWorking: currentlyWorkingCount,
          absentToday: absentCount,
          lateToday: lateCount,
          wfhToday: wfhCount,
          fieldToday: fieldCount,
        });
      } catch (err) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : 'Failed to load admin metrics.';
        setErrorMessage(msg);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchAdminData();
    return () => {
      ignore = true;
    };
  }, [router, supabase, refreshTrigger]);

  const toggleEmpExpand = (empId: string) => {
    setExpandedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  // Build employee roster data grouped per unique employee
  const employeeRoster = employees.map((emp) => {
    const sessions = todayAttendances.filter((a) => a.employee_id === emp.id);

    let totalMinutes = 0;
    sessions.forEach((s) => {
      if (s.check_in_time) {
        const { hours, minutes } = calculateWorkingHours(s.check_in_time, s.check_out_time);
        totalMinutes += hours * 60 + minutes;
      }
    });

    const hasActiveSession = sessions.some((s) => s.check_in_time && !s.check_out_time);
    const isLate = sessions.some((s) => s.status === 'late');
    const isPresent = sessions.length > 0;

    let primaryStatus: 'working' | 'present' | 'late' | 'absent' = 'absent';
    if (hasActiveSession) primaryStatus = 'working';
    else if (isLate) primaryStatus = 'late';
    else if (isPresent) primaryStatus = 'present';

    const latestSession = sessions[sessions.length - 1] || null;

    return {
      employee: emp,
      sessions,
      totalMinutes,
      totalHoursStr: `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`,
      primaryStatus,
      latestSession,
    };
  });

  const handleMetricClick = (metric: MetricKey) => {
    let title = '';
    let filtered = employeeRoster;

    switch (metric) {
      case 'total':
        title = 'All Staff Members';
        filtered = employeeRoster.filter((d) => d.employee.status === 'active');
        break;
      case 'present':
        title = 'Present Employees Today';
        filtered = employeeRoster.filter((d) => d.sessions.length > 0);
        break;
      case 'working':
        title = 'Currently Working Staff';
        filtered = employeeRoster.filter((d) =>
          d.sessions.some((s) => s.check_in_time && !s.check_out_time)
        );
        break;
      case 'late':
        title = 'Late Arrivals Today';
        filtered = employeeRoster.filter((d) =>
          d.sessions.some((s) => s.status === 'late')
        );
        break;
      case 'absent':
        title = 'Absent Employees Today';
        filtered = employeeRoster.filter(
          (d) => d.employee.status === 'active' && d.sessions.length === 0
        );
        break;
      case 'wfh':
        title = 'Work From Home Today';
        filtered = employeeRoster.filter((d) =>
          d.sessions.some((s) => s.attendance_type === 'work_from_home')
        );
        break;
      case 'field':
        title = 'Field Visit Today';
        filtered = employeeRoster.filter((d) =>
          d.sessions.some((s) => s.attendance_type === 'field')
        );
        break;
    }

    setMetricModal({ title, employees: filtered });
  };

  const filteredRoster = employeeRoster.filter(({ employee, primaryStatus }) => {
    const matchesSearch =
      employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (employee.employee_code && employee.employee_code.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'present') return primaryStatus === 'present' || primaryStatus === 'working';
    if (filterStatus === 'working') return primaryStatus === 'working';
    if (filterStatus === 'absent') return primaryStatus === 'absent';
    if (filterStatus === 'late') return primaryStatus === 'late';

    return true;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading admin dashboard statistics..." />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorState message={errorMessage} onRetry={() => setRefreshTrigger((p) => p + 1)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 lg:pb-0">
      <Navbar user={adminUser} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar role="admin" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
                <Calendar className="w-4 h-4" />
                <span>Today: {formatDate(new Date().toISOString())}</span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Admin Overview</h1>
              <p className="text-xs text-slate-500">
                Live attendance metrics &amp; employee status — click any card to view detailed list
              </p>
            </div>
            <button
              onClick={() => setRefreshTrigger((p) => p + 1)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer transition"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
            </button>
          </div>

          {/* Metric Cards Grid — Clickable to open Modal */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer hover:border-blue-300 group"
              onClick={() => handleMetricClick('total')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-blue-600 transition-colors">Total Staff</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">{summary.totalEmployees}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>

            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer hover:border-emerald-300 group"
              onClick={() => handleMetricClick('present')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Present</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-2">{summary.presentToday}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>

            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer hover:border-sky-300 group"
              onClick={() => handleMetricClick('working')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-sky-600 transition-colors">Working</span>
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-2xl font-black text-sky-600 mt-2">{summary.currentlyWorking}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>

            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer hover:border-amber-300 group"
              onClick={() => handleMetricClick('late')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-600 transition-colors">Late</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-600 mt-2">{summary.lateToday}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>

            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md col-span-2 sm:col-span-1 cursor-pointer hover:border-rose-300 group"
              onClick={() => handleMetricClick('absent')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-600 transition-colors">Absent</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-600 mt-2">{summary.absentToday}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>
          </div>

          {/* WFH & Field mini row */}
          <div className="grid grid-cols-2 gap-4">
            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer hover:border-violet-300 group"
              onClick={() => handleMetricClick('wfh')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-violet-600 transition-colors">Work From Home (WFH)</span>
                <Home className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-2xl font-black text-violet-600 mt-2">{summary.wfhToday}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>

            <div
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs transition-all duration-200 hover:shadow-md cursor-pointer hover:border-teal-300 group"
              onClick={() => handleMetricClick('field')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-teal-600 transition-colors">Field Visits</span>
                <Compass className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-black text-teal-600 mt-2">{summary.fieldToday}</p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">Click to view list</p>
            </div>
          </div>

          {/* Today's Live Attendance Table with Expandable Session Bifurcation */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Today&apos;s Employee Roster</h3>
                <p className="text-xs text-slate-500">
                  Click on an employee to expand and view multiple check-in/out session details
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="w-full sm:w-64">
                  <Input
                    placeholder="Search name, code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    leftIcon={<Search className="w-4 h-4" />}
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="working">Currently Working</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            {filteredRoster.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No employees matching criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-700">
                    <tr>
                      <th className="py-3 px-3 w-8"></th>
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Total Time</th>
                      <th className="py-3 px-3">Sessions Today</th>
                      <th className="py-3 px-3">Latest Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredRoster.map(({ employee, sessions, totalHoursStr, primaryStatus, latestSession }) => {
                      const isExpanded = expandedEmpIds.has(employee.id);
                      const hasSessions = sessions.length > 0;

                      return (
                        <React.Fragment key={employee.id}>
                          <tr
                            onClick={() => hasSessions && toggleEmpExpand(employee.id)}
                            className={`transition-colors ${
                              hasSessions ? 'cursor-pointer hover:bg-slate-50/80' : 'opacity-80'
                            }`}
                          >
                            <td className="py-3 px-3 text-slate-400">
                              {hasSessions ? (
                                isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-blue-600" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400" />
                                )
                              ) : (
                                <span className="w-4 inline-block"></span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <div>
                                <p className="font-bold text-slate-900">{employee.full_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {employee.employee_code || employee.email}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-700">
                              {employee.department || 'General'}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-900">
                              {hasSessions ? totalHoursStr : '--'}
                            </td>
                            <td className="py-3 px-3">
                              {hasSessions ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                                  <Layers className="w-3 h-3 text-blue-500" />
                                  {sessions.length} session{sessions.length > 1 ? 's' : ''}
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-400 italic">No check-in</span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {hasSessions ? (
                                <Badge
                                  variant={
                                    primaryStatus === 'working'
                                      ? 'info'
                                      : primaryStatus === 'late'
                                      ? 'warning'
                                      : 'success'
                                  }
                                  className="text-[10px] py-0.5 px-2 capitalize font-semibold"
                                >
                                  {primaryStatus === 'working' ? 'Working Now' : primaryStatus}
                                </Badge>
                              ) : (
                                <Badge variant="neutral" className="text-[10px] py-0.5 px-2 font-semibold">
                                  Absent
                                </Badge>
                              )}
                            </td>
                          </tr>

                          {/* Bifurcation Sub-Table when employee row is clicked */}
                          {isExpanded && hasSessions && (
                            <tr>
                              <td colSpan={6} className="p-0 bg-slate-50/70 border-y border-slate-200">
                                <div className="p-3.5 pl-10 space-y-2">
                                  <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    Sessions for {employee.full_name} ({sessions.length} recorded today)
                                  </p>
                                  <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-xs">
                                    <table className="w-full text-left text-xs">
                                      <thead className="bg-slate-100/70 text-slate-600 font-semibold uppercase text-[10px] border-b border-slate-200">
                                        <tr>
                                          <th className="py-2.5 px-3">#</th>
                                          <th className="py-2.5 px-3">Check In</th>
                                          <th className="py-2.5 px-3">Check Out</th>
                                          <th className="py-2.5 px-3">Duration</th>
                                          <th className="py-2.5 px-3">Type</th>
                                          <th className="py-2.5 px-3">Location / GPS</th>
                                          <th className="py-2.5 px-3">Notes</th>
                                          <th className="py-2.5 px-3">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100 text-slate-700">
                                        {sessions.map((s, idx) => {
                                          const dur = calculateWorkingHours(s.check_in_time, s.check_out_time);
                                          return (
                                            <tr key={s.id} className="hover:bg-slate-50/60">
                                              <td className="py-2.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                                              <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                                                {formatTime(s.check_in_time)}
                                              </td>
                                              <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">
                                                {s.check_out_time ? (
                                                  formatTime(s.check_out_time)
                                                ) : (
                                                  <span className="text-amber-600 font-bold">In Progress</span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 font-medium text-blue-600">
                                                {dur.formatted}
                                              </td>
                                              <td className="py-2.5 px-3 capitalize font-medium">
                                                {s.attendance_type.replace(/_/g, ' ')}
                                              </td>
                                              <td className="py-2.5 px-3">
                                                {s.check_in_latitude && s.check_in_longitude ? (
                                                  <a
                                                    href={getGoogleMapsUrl(s.check_in_latitude, s.check_in_longitude)}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-blue-600 hover:underline flex items-center gap-1 font-semibold text-[11px]"
                                                  >
                                                    <MapPin className="w-3 h-3 text-blue-500" />
                                                    {Number(s.check_in_latitude).toFixed(3)}, {Number(s.check_in_longitude).toFixed(3)}
                                                  </a>
                                                ) : (
                                                  <span className="text-slate-400 text-[10px]">No GPS</span>
                                                )}
                                              </td>
                                              <td className="py-2.5 px-3 text-slate-600 italic text-[11px]">
                                                {s.field_notes || s.wfh_reason || '--'}
                                              </td>
                                              <td className="py-2.5 px-3">
                                                <Badge
                                                  variant={
                                                    s.status === 'present'
                                                      ? 'success'
                                                      : s.status === 'late'
                                                      ? 'warning'
                                                      : 'danger'
                                                  }
                                                  className="text-[10px] py-0 px-2"
                                                >
                                                  {s.status}
                                                </Badge>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* Metric Detail Modal with Dark Visible Text */}
      {metricModal && (
        <Modal
          isOpen={!!metricModal}
          onClose={() => setMetricModal(null)}
          title={metricModal.title}
          description={`${metricModal.employees.length} employee${metricModal.employees.length !== 1 ? 's' : ''} — ${formatDate(new Date().toISOString())}`}
          maxWidth="lg"
        >
          <div className="max-h-[60vh] overflow-y-auto">
            {metricModal.employees.length === 0 ? (
              <div className="text-center py-8">
                <UserX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs text-slate-500 font-medium">No employees found in this category.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Sessions Today</th>
                    <th className="py-2.5 px-3">Total Time</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metricModal.employees.map(({ employee, sessions, totalMinutes, primaryStatus }) => (
                    <tr key={employee.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{employee.full_name}</p>
                        <p className="text-[10px] text-slate-500 font-mono">
                          {employee.employee_code || employee.email}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-medium">
                        {employee.department || 'General'}
                      </td>
                      <td className="py-3 px-3 font-semibold text-slate-800">
                        {sessions.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700">
                            {sessions.length} session{sessions.length > 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-semibold text-blue-600">
                        {sessions.length > 0
                          ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
                          : '--'}
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={
                            primaryStatus === 'working'
                              ? 'info'
                              : primaryStatus === 'present'
                              ? 'success'
                              : primaryStatus === 'late'
                              ? 'warning'
                              : 'neutral'
                          }
                          className="text-[10px] py-0.5 px-2 capitalize font-semibold"
                        >
                          {primaryStatus}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      <MobileNav role="admin" />
    </div>
  );
}
