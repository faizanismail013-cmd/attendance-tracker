'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, Attendance, DailySummary } from '@/types';
import { formatDate, formatTime, calculateWorkingHours, getTodayISODate } from '@/lib/utils/date';
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
} from 'lucide-react';

type MetricKey = 'total' | 'present' | 'working' | 'late' | 'absent' | 'wfh' | 'field';

interface MetricModalData {
  title: string;
  employees: { employee: Profile; attendance: Attendance | null }[];
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
          .eq('attendance_date', todayDate);

        if (ignore) return;
        if (attError) throw attError;
        const attendances = attList || [];
        setTodayAttendances(attendances);

        const activeEmployees = empList.filter((e) => e.status === 'active');
        const totalEmpCount = activeEmployees.length;

        const checkedInToday = attendances.filter((a) => a.check_in_time);
        const presentCount = checkedInToday.length;

        const currentlyWorkingCount = attendances.filter(
          (a) => a.check_in_time && !a.check_out_time
        ).length;

        const lateCount = attendances.filter((a) => a.status === 'late').length;
        const absentCount = Math.max(0, totalEmpCount - presentCount);

        const wfhCount = attendances.filter((a) => a.attendance_type === 'work_from_home').length;
        const fieldCount = attendances.filter((a) => a.attendance_type === 'field').length;

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

  // Build employee-attendance map for modal
  const getEmployeeAttendanceList = () => {
    return employees.map((emp) => {
      const attRecord = todayAttendances.find((a) => a.employee_id === emp.id);
      return { employee: emp, attendance: attRecord || null };
    });
  };

  const handleMetricClick = (metric: MetricKey) => {
    const allData = getEmployeeAttendanceList();

    let title = '';
    let filtered: typeof allData = [];

    switch (metric) {
      case 'total':
        title = 'All Staff';
        filtered = allData.filter((d) => d.employee.status === 'active');
        break;
      case 'present':
        title = 'Present Today';
        filtered = allData.filter((d) => !!d.attendance?.check_in_time);
        break;
      case 'working':
        title = 'Currently Working';
        filtered = allData.filter(
          (d) => !!d.attendance?.check_in_time && !d.attendance?.check_out_time
        );
        break;
      case 'late':
        title = 'Late Today';
        filtered = allData.filter((d) => d.attendance?.status === 'late');
        break;
      case 'absent':
        title = 'Absent Today';
        filtered = allData.filter(
          (d) => d.employee.status === 'active' && !d.attendance?.check_in_time
        );
        break;
      case 'wfh':
        title = 'Work From Home Today';
        filtered = allData.filter((d) => d.attendance?.attendance_type === 'work_from_home');
        break;
      case 'field':
        title = 'Field Visit Today';
        filtered = allData.filter((d) => d.attendance?.attendance_type === 'field');
        break;
    }

    setMetricModal({ title, employees: filtered });
  };

  const filteredEmployeeAttendance = employees.map((emp) => {
    const attRecord = todayAttendances.find((a) => a.employee_id === emp.id);
    return {
      employee: emp,
      attendance: attRecord || null,
    };
  }).filter(({ employee, attendance }) => {
    const matchesSearch =
      employee.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (employee.employee_code && employee.employee_code.toLowerCase().includes(searchQuery.toLowerCase()));

    if (!matchesSearch) return false;

    if (filterStatus === 'present') return !!attendance?.check_in_time;
    if (filterStatus === 'working') return !!attendance?.check_in_time && !attendance?.check_out_time;
    if (filterStatus === 'absent') return !attendance?.check_in_time;
    if (filterStatus === 'late') return attendance?.status === 'late';

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
              <p className="text-xs text-slate-500">Live attendance metrics &amp; employee status — click any card to view details</p>
            </div>
            <button
              onClick={() => setRefreshTrigger((p) => p + 1)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh Data
            </button>
          </div>

          {/* Metric Cards Grid — now clickable */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card
              className="p-4 border-slate-200 cursor-pointer hover:border-blue-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('total')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-blue-600 transition-colors">Total Staff</span>
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <p className="text-2xl font-black text-slate-900 mt-2">{summary.totalEmployees}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>

            <Card
              className="p-4 border-slate-200 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('present')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-emerald-600 transition-colors">Present</span>
                <UserCheck className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-black text-emerald-600 mt-2">{summary.presentToday}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>

            <Card
              className="p-4 border-slate-200 cursor-pointer hover:border-sky-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('working')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-sky-600 transition-colors">Working</span>
                <Clock className="w-4 h-4 text-sky-600" />
              </div>
              <p className="text-2xl font-black text-sky-600 mt-2">{summary.currentlyWorking}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>

            <Card
              className="p-4 border-slate-200 cursor-pointer hover:border-amber-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('late')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-600 transition-colors">Late</span>
                <AlertTriangle className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-black text-amber-600 mt-2">{summary.lateToday}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>

            <Card
              className="p-4 border-slate-200 col-span-2 sm:col-span-1 cursor-pointer hover:border-rose-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('absent')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-600 transition-colors">Absent</span>
                <UserX className="w-4 h-4 text-rose-600" />
              </div>
              <p className="text-2xl font-black text-rose-600 mt-2">{summary.absentToday}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>
          </div>

          {/* WFH & Field mini row */}
          <div className="grid grid-cols-2 gap-4">
            <Card
              className="p-4 border-slate-200 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('wfh')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-violet-600 transition-colors">WFH</span>
                <Home className="w-4 h-4 text-violet-600" />
              </div>
              <p className="text-2xl font-black text-violet-600 mt-2">{summary.wfhToday}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>

            <Card
              className="p-4 border-slate-200 cursor-pointer hover:border-teal-300 hover:shadow-md transition-all duration-200 group"
              onClick={() => handleMetricClick('field')}
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-teal-600 transition-colors">Field</span>
                <Compass className="w-4 h-4 text-teal-600" />
              </div>
              <p className="text-2xl font-black text-teal-600 mt-2">{summary.fieldToday}</p>
              <p className="text-[10px] text-slate-400 mt-1">Click to view list</p>
            </Card>
          </div>

          {/* Today's Live Attendance Table */}
          <Card className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Today&apos;s Employee Roster</h3>
                <p className="text-xs text-slate-500">Check-in and check-out records for today</p>
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
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Statuses</option>
                  <option value="present">Present</option>
                  <option value="working">Currently Working</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                </select>
              </div>
            </div>

            {filteredEmployeeAttendance.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No employees matching criteria.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Department</th>
                      <th className="py-3 px-3">Check In</th>
                      <th className="py-3 px-3">Check Out</th>
                      <th className="py-3 px-3">Hours</th>
                      <th className="py-3 px-3">Type</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEmployeeAttendance.map(({ employee, attendance }) => {
                      const hoursObj = attendance?.check_in_time
                        ? calculateWorkingHours(attendance.check_in_time, attendance.check_out_time)
                        : { formatted: '--' };

                      return (
                        <tr key={employee.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            <div>
                              <p className="font-bold text-slate-900">{employee.full_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {employee.employee_code || employee.email}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-3 text-slate-700">
                            {employee.department || 'General'}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {attendance?.check_in_time ? formatTime(attendance.check_in_time) : '--:--'}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            {attendance?.check_out_time ? formatTime(attendance.check_out_time) : '--:--'}
                          </td>
                          <td className="py-3 px-3 font-semibold text-slate-800">
                            {hoursObj.formatted}
                          </td>
                          <td className="py-3 px-3 capitalize">
                            {attendance?.attendance_type ? attendance.attendance_type.replace(/_/g, ' ') : '--'}
                          </td>
                          <td className="py-3 px-3">
                            {attendance?.check_in_time ? (
                              <Badge
                                variant={
                                  attendance.status === 'present'
                                    ? 'success'
                                    : attendance.status === 'late'
                                    ? 'warning'
                                    : 'danger'
                                }
                                className="text-[10px] py-0 px-2"
                              >
                                {attendance.status}
                              </Badge>
                            ) : (
                              <Badge variant="neutral" className="text-[10px] py-0 px-2">
                                Absent
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* Metric Detail Modal */}
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
                <p className="text-xs text-slate-500">No employees in this category.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Department</th>
                    <th className="py-2.5 px-3">Check In</th>
                    <th className="py-2.5 px-3">Check Out</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metricModal.employees.map(({ employee, attendance }) => (
                    <tr key={employee.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3">
                        <p className="font-bold text-slate-900">{employee.full_name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {employee.employee_code || employee.email}
                        </p>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {employee.department || 'General'}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {attendance?.check_in_time ? formatTime(attendance.check_in_time) : '--:--'}
                      </td>
                      <td className="py-3 px-3 font-mono">
                        {attendance?.check_out_time ? formatTime(attendance.check_out_time) : '--:--'}
                      </td>
                      <td className="py-3 px-3">
                        {attendance?.check_in_time ? (
                          <Badge
                            variant={
                              attendance.status === 'present'
                                ? 'success'
                                : attendance.status === 'late'
                                ? 'warning'
                                : 'danger'
                            }
                            className="text-[10px] py-0 px-2"
                          >
                            {attendance.status}
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px] py-0 px-2">
                            Absent
                          </Badge>
                        )}
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
