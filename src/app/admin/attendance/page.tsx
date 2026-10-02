'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, Attendance } from '@/types';
import { formatDate, formatTime, calculateWorkingHours } from '@/lib/utils/date';
import { getGoogleMapsUrl } from '@/lib/utils/geo';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CalendarCheck, Search, MapPin, ChevronDown, ChevronRight, Clock, Layers } from 'lucide-react';

interface AttendanceGroup {
  key: string;
  date: string;
  employeeId: string;
  employee: Profile | null;
  sessions: Attendance[];
  totalHours: number;
  totalMinutes: number;
  primaryStatus: 'present' | 'late' | 'incomplete' | 'absent';
  primaryType: string;
}

export default function AdminAttendancePage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [attendances, setAttendances] = useState<Attendance[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');

  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let ignore = false;
    async function fetchAttendanceHistory() {
      setErrorMessage(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (ignore) return;
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (ignore) return;
        if (profile?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
        setAdminUser(profile);

        let query = supabase
          .from('attendance')
          .select('*, profiles(*)')
          .order('attendance_date', { ascending: false })
          .order('check_in_time', { ascending: false });

        if (selectedDate) {
          query = query.eq('attendance_date', selectedDate);
        }

        const { data, error } = await query.limit(200);

        if (ignore) return;
        if (error) throw error;
        setAttendances(data || []);
      } catch (err) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : 'Failed to fetch attendance records';
        setErrorMessage(msg);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchAttendanceHistory();
    return () => {
      ignore = true;
    };
  }, [router, selectedDate, supabase, refreshTrigger]);

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Filter records
  const filteredRecords = attendances.filter((rec) => {
    const empName = rec.profiles?.full_name || '';
    const empEmail = rec.profiles?.email || '';
    const empCode = rec.profiles?.employee_code || '';

    const matchesSearch =
      empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      empCode.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (selectedStatus !== 'all' && rec.status !== selectedStatus) return false;
    if (selectedType !== 'all' && rec.attendance_type !== selectedType) return false;

    return true;
  });

  // Group by Date + Employee
  const groupedList: AttendanceGroup[] = [];
  const groupMap = new Map<string, AttendanceGroup>();

  filteredRecords.forEach((rec) => {
    const groupKey = `${rec.attendance_date}_${rec.employee_id}`;
    let existing = groupMap.get(groupKey);

    if (!existing) {
      existing = {
        key: groupKey,
        date: rec.attendance_date,
        employeeId: rec.employee_id,
        employee: rec.profiles || null,
        sessions: [],
        totalHours: 0,
        totalMinutes: 0,
        primaryStatus: rec.status,
        primaryType: rec.attendance_type,
      };
      groupMap.set(groupKey, existing);
      groupedList.push(existing);
    }

    existing.sessions.push(rec);

    if (rec.check_in_time) {
      const { hours, minutes } = calculateWorkingHours(rec.check_in_time, rec.check_out_time);
      existing.totalMinutes += hours * 60 + minutes;
    }
  });

  // Calculate total hours and minutes for each group
  groupedList.forEach((group) => {
    group.totalHours = Math.floor(group.totalMinutes / 60);
    group.totalMinutes = group.totalMinutes % 60;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading attendance archives..." />
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
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 uppercase tracking-wider">
              <CalendarCheck className="w-4 h-4" />
              <span>Historical Records</span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Company Attendance Log</h1>
            <p className="text-xs text-slate-500">
              Grouped by date & employee — click any row to expand and view multiple check-in/out sessions
            </p>
          </div>

          {/* Filters Bar */}
          <Card className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <Input
                placeholder="Search staff name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />

              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                helperText="Filter by Date (Leave empty for all)"
              />

              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="incomplete">Incomplete</option>
                <option value="absent">Absent</option>
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Work Types</option>
                <option value="office">Office</option>
                <option value="field">Field Visit</option>
                <option value="work_from_home">Work From Home</option>
              </select>
            </div>
          </Card>

          {/* Grouped Table */}
          <Card className="p-6">
            {groupedList.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500">
                No attendance logs found matching filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-500">
                    <tr>
                      <th className="py-3 px-3 w-8"></th>
                      <th className="py-3 px-3">Date</th>
                      <th className="py-3 px-3">Employee</th>
                      <th className="py-3 px-3">Sessions</th>
                      <th className="py-3 px-3">Total Time</th>
                      <th className="py-3 px-3">Work Type</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupedList.map((group) => {
                      const isExpanded = expandedKeys.has(group.key);
                      const hasMultiple = group.sessions.length > 1;

                      return (
                        <React.Fragment key={group.key}>
                          <tr
                            onClick={() => toggleExpand(group.key)}
                            className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                          >
                            <td className="py-3 px-3 text-slate-400">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-900">
                              {formatDate(group.date)}
                            </td>
                            <td className="py-3 px-3">
                              <div>
                                <p className="font-bold text-slate-900">
                                  {group.employee?.full_name || 'Unknown'}
                                </p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  {group.employee?.employee_code || group.employee?.email}
                                </p>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                                <Layers className="w-3 h-3 text-slate-500" />
                                {group.sessions.length} session{hasMultiple ? 's' : ''}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-semibold text-blue-600">
                              {group.totalHours}h {group.totalMinutes}m
                            </td>
                            <td className="py-3 px-3 capitalize">
                              {group.primaryType.replace(/_/g, ' ')}
                            </td>
                            <td className="py-3 px-3">
                              <Badge
                                variant={
                                  group.primaryStatus === 'present'
                                    ? 'success'
                                    : group.primaryStatus === 'late'
                                    ? 'warning'
                                    : 'danger'
                                }
                                className="text-[10px] py-0 px-2"
                              >
                                {group.primaryStatus}
                              </Badge>
                            </td>
                          </tr>

                          {/* Expanded sub-table showing all sessions for this date */}
                          {isExpanded && (
                            <tr>
                              <td colSpan={7} className="p-0 bg-slate-50/70 border-y border-slate-200">
                                <div className="p-3 pl-10">
                                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-blue-600" />
                                    Sessions on {formatDate(group.date)} ({group.sessions.length} total)
                                  </p>
                                  <table className="w-full text-left text-xs bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
                                    <thead className="bg-slate-100/70 text-slate-500 font-semibold uppercase text-[10px]">
                                      <tr>
                                        <th className="py-2 px-3">#</th>
                                        <th className="py-2 px-3">Check In</th>
                                        <th className="py-2 px-3">Check Out</th>
                                        <th className="py-2 px-3">Duration</th>
                                        <th className="py-2 px-3">Type</th>
                                        <th className="py-2 px-3">GPS Location</th>
                                        <th className="py-2 px-3">Notes</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                      {[...group.sessions].reverse().map((s, idx) => {
                                        const dur = calculateWorkingHours(s.check_in_time, s.check_out_time);
                                        return (
                                          <tr key={s.id} className="hover:bg-slate-50/50">
                                            <td className="py-2 px-3 text-slate-400 font-mono">{idx + 1}</td>
                                            <td className="py-2 px-3 font-semibold text-slate-900 font-mono">
                                              {formatTime(s.check_in_time)}
                                            </td>
                                            <td className="py-2 px-3 font-semibold text-slate-900 font-mono">
                                              {s.check_out_time ? (
                                                formatTime(s.check_out_time)
                                              ) : (
                                                <span className="text-amber-600 font-semibold">In Progress</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 font-medium text-blue-600">
                                              {dur.formatted}
                                            </td>
                                            <td className="py-2 px-3 capitalize">
                                              {s.attendance_type.replace(/_/g, ' ')}
                                            </td>
                                            <td className="py-2 px-3">
                                              {s.check_in_latitude && s.check_in_longitude ? (
                                                <a
                                                  href={getGoogleMapsUrl(s.check_in_latitude, s.check_in_longitude)}
                                                  target="_blank"
                                                  rel="noreferrer"
                                                  className="text-blue-600 hover:underline flex items-center gap-1 font-medium text-[11px]"
                                                >
                                                  <MapPin className="w-3 h-3 text-blue-500" />
                                                  {Number(s.check_in_latitude).toFixed(3)}, {Number(s.check_in_longitude).toFixed(3)}
                                                </a>
                                              ) : (
                                                <span className="text-slate-400 text-[10px]">No GPS</span>
                                              )}
                                            </td>
                                            <td className="py-2 px-3 text-slate-500 text-[11px] italic">
                                              {s.field_notes || s.wfh_reason || '--'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
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

      <MobileNav role="admin" />
    </div>
  );
}
