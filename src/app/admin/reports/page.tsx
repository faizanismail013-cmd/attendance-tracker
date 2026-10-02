'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { formatTime } from '@/lib/utils/date';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Layers,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

interface CalendarDay {
  date: string;
  dayNumber: number;
  dayName: string;
  isWeekend: boolean;
  isFuture: boolean;
  statusLetter: 'P' | 'A' | 'L' | 'LV' | 'W' | '-';
  statusLabel: string;
  sessions: any[];
  workHours: number;
}

interface EmployeeMonthlySummary {
  employee: Profile;
  total_present: number;
  late_days: number;
  office_days: number;
  field_days: number;
  wfh_days: number;
  leave_days: number;
  total_work_hours: number;
  calendarDays: CalendarDay[];
}

interface MonthlyReportResponse {
  month: number;
  year: number;
  startDate: string;
  endDate: string;
  summaries: EmployeeMonthlySummary[];
}

export default function AdminReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [reportData, setReportData] = useState<MonthlyReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Expandable employee calendar state
  const [expandedEmpIds, setExpandedEmpIds] = useState<Set<string>>(new Set());
  const [selectedDayDetails, setSelectedDayDetails] = useState<{
    empName: string;
    day: CalendarDay;
  } | null>(null);

  const toggleEmpExpand = (empId: string) => {
    setExpandedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId);
      else next.add(empId);
      return next;
    });
  };

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setAdminUser(profile);

      const res = await fetch(`/api/admin/reports/monthly?month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();

      if (res.ok) {
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear]);

  const handleExportCSV = () => {
    if (!reportData) return;
    const exportUrl = `/api/admin/reports/export-csv?startDate=${reportData.startDate}&endDate=${reportData.endDate}`;
    window.open(exportUrl, '_blank');
  };

  const monthsList = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 lg:pb-0 w-full max-w-full overflow-x-hidden">
      <Navbar user={adminUser} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto min-w-0">
        <Sidebar role="admin" />

        <main className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-6 lg:p-8 space-y-5 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" /> Monthly Reports &amp; CSV Export
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Aggregated monthly attendance, unique days present, and employee calendar breakdown
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
              className="shadow-md shadow-blue-500/20"
            >
              Export CSV Report
            </Button>
          </div>

          {/* Month / Year Filters */}
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-bold text-slate-800 flex items-center gap-1">
                <Filter className="w-4 h-4 text-blue-600" /> Select Reporting Period:
              </span>

              <div className="flex items-center gap-2">
                <label className="text-slate-600 font-medium">Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {monthsList.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-slate-600 font-medium">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Legend */}
              <div className="flex flex-wrap items-center gap-3 ml-auto text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1 text-emerald-700">
                  <span className="w-5 h-5 rounded-md bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-[10px]">P</span> Present
                </span>
                <span className="inline-flex items-center gap-1 text-amber-700">
                  <span className="w-5 h-5 rounded-md bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-[10px]">L</span> Late
                </span>
                <span className="inline-flex items-center gap-1 text-rose-700">
                  <span className="w-5 h-5 rounded-md bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-[10px]">A</span> Absent
                </span>
                <span className="inline-flex items-center gap-1 text-purple-700">
                  <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-[10px]">LV</span> Leave
                </span>
                <span className="inline-flex items-center gap-1 text-slate-600">
                  <span className="w-5 h-5 rounded-md bg-slate-100 text-slate-700 flex items-center justify-center font-bold text-[10px]">W</span> Weekend
                </span>
              </div>
            </div>
          </Card>

          {isLoading ? (
            <LoadingState message="Calculating monthly attendance summaries..." />
          ) : (
            <Card className="p-5">
              <CardHeader className="mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Monthly Summary ({monthsList.find((m) => m.value === selectedMonth)?.name} {selectedYear})
                </CardTitle>
                <CardDescription>
                  Click on an employee row to view their complete month attendance calendar (P / A / L / LV / W)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!reportData || reportData.summaries.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-xs text-slate-500">No attendance data found for selected month.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase">
                        <tr>
                          <th className="py-2.5 px-3 w-8"></th>
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Days Present</th>
                          <th className="py-2.5 px-3">Late Days</th>
                          <th className="py-2.5 px-3">Office Days</th>
                          <th className="py-2.5 px-3">Field Days</th>
                          <th className="py-2.5 px-3">WFH Days</th>
                          <th className="py-2.5 px-3">Leave Days</th>
                          <th className="py-2.5 px-3">Total Work Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.summaries.map((s) => {
                          const isExpanded = expandedEmpIds.has(s.employee.id);

                          return (
                            <React.Fragment key={s.employee.id}>
                              <tr
                                onClick={() => toggleEmpExpand(s.employee.id)}
                                className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                              >
                                <td className="py-3 px-3 text-slate-400">
                                  {isExpanded ? (
                                    <ChevronDown className="w-4 h-4 text-blue-600" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-400" />
                                  )}
                                </td>
                                <td className="py-3 px-3">
                                  <p className="font-bold text-slate-900">{s.employee.full_name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">{s.employee.email}</p>
                                </td>
                                <td className="py-3 px-3 font-medium text-slate-700">
                                  {s.employee.department || 'General'}
                                </td>
                                <td className="py-3 px-3 font-black text-emerald-700 text-sm">
                                  {s.total_present}
                                </td>
                                <td className="py-3 px-3 font-bold text-amber-600">
                                  {s.late_days}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-800">
                                  {s.office_days}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-800">
                                  {s.field_days}
                                </td>
                                <td className="py-3 px-3 font-semibold text-slate-800">
                                  {s.wfh_days}
                                </td>
                                <td className="py-3 px-3 font-semibold text-rose-600">
                                  {s.leave_days}
                                </td>
                                <td className="py-3 px-3 font-mono font-bold text-blue-700">
                                  {s.total_work_hours} hrs
                                </td>
                              </tr>

                              {/* Month Attendance Calendar Grid when expanded */}
                              {isExpanded && (
                                <tr>
                                  <td colSpan={10} className="p-0 bg-slate-50/90 border-y border-slate-200">
                                    <div className="p-4 pl-10 space-y-3">
                                      <div className="flex items-center justify-between">
                                        <p className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                          <Calendar className="w-4 h-4 text-blue-600" />
                                          {monthsList.find((m) => m.value === selectedMonth)?.name} {selectedYear} Attendance Calendar — {s.employee.full_name}
                                        </p>
                                        <span className="text-[11px] text-slate-500 font-medium">
                                          Click any day for session details
                                        </span>
                                      </div>

                                      {/* Calendar Day Grid */}
                                      <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 lg:grid-cols-16 gap-1.5">
                                        {s.calendarDays.map((day) => {
                                          let colorClasses = 'bg-white border-slate-200 text-slate-600';

                                          if (day.statusLetter === 'P') {
                                            colorClasses = 'bg-emerald-500 text-white border-emerald-600 shadow-xs';
                                          } else if (day.statusLetter === 'L') {
                                            colorClasses = 'bg-amber-500 text-white border-amber-600 shadow-xs';
                                          } else if (day.statusLetter === 'A') {
                                            colorClasses = 'bg-rose-500 text-white border-rose-600 shadow-xs';
                                          } else if (day.statusLetter === 'LV') {
                                            colorClasses = 'bg-purple-500 text-white border-purple-600 shadow-xs';
                                          } else if (day.statusLetter === 'W') {
                                            colorClasses = 'bg-slate-200 text-slate-500 border-slate-300';
                                          } else if (day.isFuture) {
                                            colorClasses = 'bg-slate-50 text-slate-300 border-dashed border-slate-200';
                                          }

                                          return (
                                            <button
                                              key={day.date}
                                              type="button"
                                              onClick={() =>
                                                setSelectedDayDetails({
                                                  empName: s.employee.full_name,
                                                  day,
                                                })
                                              }
                                              className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-transform hover:scale-105 cursor-pointer ${colorClasses}`}
                                            >
                                              <span className="text-[10px] font-medium opacity-80">{day.dayName}</span>
                                              <span className="text-sm font-extrabold my-0.5">{day.dayNumber}</span>
                                              <span className="text-[11px] font-black uppercase tracking-wider">{day.statusLetter}</span>
                                              {day.workHours > 0 && (
                                                <span className="text-[9px] font-semibold opacity-90">{day.workHours}h</span>
                                              )}
                                            </button>
                                          );
                                        })}
                                      </div>

                                      {/* Selected Day Expanded Info */}
                                      {selectedDayDetails && selectedDayDetails.empName === s.employee.full_name && (
                                        <div className="mt-3 p-3.5 bg-white border border-slate-200 rounded-xl shadow-xs">
                                          <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                              <Clock className="w-3.5 h-3.5 text-blue-600" />
                                              Date: {selectedDayDetails.day.date} ({selectedDayDetails.day.dayName}) — Status:{' '}
                                              <span className="font-extrabold text-blue-600 uppercase">
                                                {selectedDayDetails.day.statusLabel} ({selectedDayDetails.day.statusLetter})
                                              </span>
                                            </p>
                                            <button
                                              onClick={() => setSelectedDayDetails(null)}
                                              className="text-[11px] text-slate-400 hover:text-slate-600"
                                            >
                                              ✕ Close Details
                                            </button>
                                          </div>

                                          {selectedDayDetails.day.sessions.length === 0 ? (
                                            <p className="text-xs text-slate-500 italic">
                                              {selectedDayDetails.day.isWeekend
                                                ? 'Official Weekend'
                                                : selectedDayDetails.day.statusLetter === 'LV'
                                                ? 'Approved Leave for this date'
                                                : selectedDayDetails.day.isFuture
                                                ? 'Upcoming date'
                                                : 'No check-in recorded (Absent)'}
                                            </p>
                                          ) : (
                                            <div className="space-y-1.5">
                                              {selectedDayDetails.day.sessions.map((ses: any, sIdx: number) => (
                                                <div
                                                  key={ses.id}
                                                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs text-slate-700"
                                                >
                                                  <span className="font-semibold text-slate-900">
                                                    Session #{sIdx + 1} ({ses.attendance_type.replace(/_/g, ' ')})
                                                  </span>
                                                  <span className="font-mono text-slate-600">
                                                    {formatTime(ses.check_in_time)} → {ses.check_out_time ? formatTime(ses.check_out_time) : 'Active'}
                                                  </span>
                                                  <span className="text-[11px] text-slate-500 italic">
                                                    {ses.field_notes || ses.wfh_reason || 'Standard Check-in'}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
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
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <MobileNav role="admin" />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
