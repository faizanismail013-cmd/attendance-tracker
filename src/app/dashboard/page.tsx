'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Attendance, AttendanceType, Profile } from '@/types';
import { formatDate, formatTime, calculateWorkingHours, getTodayISODate } from '@/lib/utils/date';
import { getCurrentPosition, getGoogleMapsUrl } from '@/lib/utils/geo';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import {
  MapPin,
  Clock,
  CheckCircle2,
  Building2,
  Compass,
  Home,
  Calendar,
  Timer,
  ExternalLink,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface DateGroup {
  date: string;
  sessions: Attendance[];
  totalHours: number;
  totalMinutes: number;
}

export default function EmployeeDashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [todaySessions, setTodaySessions] = useState<Attendance[]>([]);
  const [recentAttendance, setRecentAttendance] = useState<Attendance[]>([]);
  const [monthlyStats, setMonthlyStats] = useState({ present: 0, late: 0, totalHours: 0 });

  const [attendanceType, setAttendanceType] = useState<AttendanceType>('office');
  const [fieldNotes, setFieldNotes] = useState('');
  const [wfhReason, setWfhReason] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  // Live timer tick for active check-in
  const [liveDuration, setLiveDuration] = useState('0h 0m 0s');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Expandable date rows in history
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

  useEffect(() => {
    let ignore = false;
    async function fetchDashboard() {
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
        if (profileError) throw profileError;
        setUserProfile(profile);

        const todayDate = getTodayISODate();

        // Fetch ALL sessions for today
        const { data: todayRecs } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', user.id)
          .eq('attendance_date', todayDate)
          .order('created_at', { ascending: false });

        if (ignore) return;
        const sessions = todayRecs || [];
        setTodaySessions(sessions);

        if (sessions.length > 0 && sessions[0]?.attendance_type) {
          setAttendanceType(sessions[0].attendance_type);
        }

        // Fetch history
        const { data: history } = await supabase
          .from('attendance')
          .select('*')
          .eq('employee_id', user.id)
          .order('attendance_date', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(100);

        if (ignore) return;
        const attendanceList = history || [];
        setRecentAttendance(attendanceList);

        // Monthly stats
        let presentDays = new Set<string>();
        let lateDays = new Set<string>();
        let totalMinutesWorked = 0;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        attendanceList.forEach((rec) => {
          const d = new Date(rec.attendance_date);
          if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
            if (rec.status === 'present' || rec.status === 'late') presentDays.add(rec.attendance_date);
            if (rec.status === 'late') lateDays.add(rec.attendance_date);

            if (rec.check_in_time) {
              const { hours, minutes } = calculateWorkingHours(rec.check_in_time, rec.check_out_time);
              totalMinutesWorked += hours * 60 + minutes;
            }
          }
        });

        setMonthlyStats({
          present: presentDays.size,
          late: lateDays.size,
          totalHours: Math.round((totalMinutesWorked / 60) * 10) / 10,
        });
      } catch (err) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : 'Failed to load dashboard data.';
        setErrorMessage(msg);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchDashboard();
    return () => {
      ignore = true;
    };
  }, [router, supabase, refreshTrigger]);

  // Get the active session (most recent un-checked-out)
  const activeSession = todaySessions.find((s) => s.check_in_time && !s.check_out_time);
  const latestSession = todaySessions[0] || null;
  const isCheckedIn = !!activeSession;
  const isAllCheckedOut = todaySessions.length > 0 && !activeSession;

  // Live timer tick effect
  useEffect(() => {
    if (!activeSession?.check_in_time) return;

    const interval = setInterval(() => {
      const start = new Date(activeSession.check_in_time!).getTime();
      const now = Date.now();
      const diffMs = Math.max(0, now - start);

      const totalSeconds = Math.floor(diffMs / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;

      setLiveDuration(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [activeSession]);

  // Group history by date
  const groupedHistory: DateGroup[] = React.useMemo(() => {
    const groups: Record<string, Attendance[]> = {};
    recentAttendance.forEach((rec) => {
      if (!groups[rec.attendance_date]) {
        groups[rec.attendance_date] = [];
      }
      groups[rec.attendance_date].push(rec);
    });

    return Object.entries(groups).map(([date, sessions]) => {
      let totalMin = 0;
      sessions.forEach((s) => {
        if (s.check_in_time) {
          const { hours, minutes } = calculateWorkingHours(s.check_in_time, s.check_out_time);
          totalMin += hours * 60 + minutes;
        }
      });
      return {
        date,
        sessions,
        totalHours: Math.floor(totalMin / 60),
        totalMinutes: totalMin % 60,
      };
    });
  }, [recentAttendance]);

  const toggleDateExpand = (date: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  // Calculate total hours for today across all sessions
  const todayTotalMinutes = todaySessions.reduce((acc, s) => {
    if (s.check_in_time) {
      const { hours, minutes } = calculateWorkingHours(s.check_in_time, s.check_out_time);
      return acc + hours * 60 + minutes;
    }
    return acc;
  }, 0);

  // Handle Check In
  const handleCheckIn = async () => {
    setIsSubmitting(true);
    setLocationStatus({ type: 'info', message: 'Acquiring high-accuracy GPS coordinates...' });

    const geoResult = await getCurrentPosition();

    if (geoResult.error) {
      setLocationStatus({ type: 'error', message: geoResult.error.message });
      if (attendanceType === 'office') {
        setIsSubmitting(false);
        setToast({
          id: Date.now().toString(),
          type: 'error',
          title: 'GPS Location Required',
          description: geoResult.error.message,
        });
        return;
      }
    }

    const lat = geoResult.result?.latitude || null;
    const lng = geoResult.result?.longitude || null;
    const acc = geoResult.result?.accuracy || null;

    try {
      const res = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
          attendance_type: attendanceType,
          field_notes: attendanceType === 'field' ? fieldNotes : null,
          wfh_reason: attendanceType === 'work_from_home' ? wfhReason : null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errText = typeof data.error === 'string' ? data.error : data.error?.message || 'Check-in failed';
        throw new Error(errText);
      }

      setLocationStatus({ type: 'success', message: 'GPS coordinates verified!' });
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Checked In Successfully!',
        description: `Marked as ${data.attendance.status.toUpperCase()} at ${formatTime(data.attendance.check_in_time)}`,
      });

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check-in error';
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Check-In Failed',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Check Out
  const handleCheckOut = async () => {
    setIsSubmitting(true);
    setLocationStatus({ type: 'info', message: 'Acquiring GPS coordinates for check-out...' });

    const geoResult = await getCurrentPosition();
    const lat = geoResult.result?.latitude || null;
    const lng = geoResult.result?.longitude || null;
    const acc = geoResult.result?.accuracy || null;

    try {
      const res = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          accuracy: acc,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errText = typeof data.error === 'string' ? data.error : data.error?.message || 'Check-out failed';
        throw new Error(errText);
      }

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Checked Out Successfully!',
        description: `Check-out recorded at ${formatTime(data.attendance.check_out_time)}`,
      });

      setRefreshTrigger((prev) => prev + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Check-out error';
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Check-Out Failed',
        description: msg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={userProfile} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading your attendance dashboard..." />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={userProfile} />
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorState message={errorMessage} onRetry={() => setRefreshTrigger((prev) => prev + 1)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 lg:pb-0">
      <Navbar user={userProfile} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar role={userProfile?.role} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Welcome Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/10">
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                {formatDate(new Date().toISOString())}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold mt-1 tracking-tight">
                Welcome, {userProfile?.full_name || 'Team Member'}!
              </h1>
              <p className="text-xs text-blue-100 mt-1">
                Dept: <span className="font-semibold">{userProfile?.department || 'General'}</span> | Code: <span className="font-mono font-semibold">{userProfile?.employee_code || '--'}</span>
              </p>
            </div>
            <div className="mt-2 sm:mt-0 self-start sm:self-center">
              <Badge variant="indigo" className="bg-white/20 text-white border-white/30 backdrop-blur-xs py-1 px-3">
                {userProfile?.status === 'active' ? 'Active Status' : 'Inactive'}
              </Badge>
            </div>
          </div>

          {/* Today's Action Card */}
          <Card className="border-blue-100 bg-white p-6 shadow-md">
            <CardHeader className="mb-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-600" /> Today&apos;s Attendance
                </CardTitle>
                <CardDescription>
                  Capture GPS verification &amp; mark check-in/out — you can check in multiple times per day
                </CardDescription>
              </div>

              {isCheckedIn ? (
                <Badge variant="warning" className="py-1 px-3 animate-pulse">Working Now</Badge>
              ) : isAllCheckedOut ? (
                <Badge variant="success" className="py-1 px-3">Session Complete</Badge>
              ) : (
                <Badge variant="neutral" className="py-1 px-3">Not Checked In</Badge>
              )}
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Today's sessions summary */}
              {todaySessions.length > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Today&apos;s Sessions ({todaySessions.length})
                    </p>
                    <p className="text-xs font-semibold text-blue-600">
                      Total: {Math.floor(todayTotalMinutes / 60)}h {todayTotalMinutes % 60}m
                    </p>
                  </div>
                  <div className="space-y-2">
                    {todaySessions.map((session, idx) => (
                      <div key={session.id} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-slate-100 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400 font-mono w-5">#{todaySessions.length - idx}</span>
                          <span className="font-semibold text-slate-900">
                            {formatTime(session.check_in_time)}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className={`font-semibold ${session.check_out_time ? 'text-slate-900' : 'text-amber-600'}`}>
                            {session.check_out_time ? formatTime(session.check_out_time) : 'Active'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 capitalize">{session.attendance_type.replace(/_/g, ' ')}</span>
                          <Badge
                            variant={session.check_out_time ? 'success' : 'warning'}
                            className="text-[10px] py-0 px-1.5"
                          >
                            {session.check_out_time
                              ? calculateWorkingHours(session.check_in_time, session.check_out_time).formatted
                              : 'Working'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ACTIVE SESSION — show timer & check-out button */}
              {isCheckedIn && activeSession && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4 rounded-xl bg-blue-50/60 p-4 border border-blue-100">
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Current Session</p>
                      <p className="text-lg font-bold text-slate-900 mt-0.5">
                        {formatTime(activeSession.check_in_time)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 font-medium">Active Duration</p>
                      <p className="text-lg font-mono font-bold text-blue-700 mt-0.5 flex items-center gap-1">
                        <Timer className="w-4 h-4 text-blue-600" />
                        {liveDuration}
                      </p>
                    </div>
                  </div>

                  {activeSession.check_in_latitude && activeSession.check_in_longitude && (
                    <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                      <div className="flex items-center gap-2 text-slate-600">
                        <MapPin className="w-4 h-4 text-blue-600" />
                        <span>GPS Verified ({activeSession.check_in_accuracy ? `±${Math.round(activeSession.check_in_accuracy)}m` : 'Captured'})</span>
                      </div>
                      <a
                        href={getGoogleMapsUrl(activeSession.check_in_latitude, activeSession.check_in_longitude)}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline flex items-center gap-1 font-semibold"
                      >
                        View Map <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {locationStatus && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                        locationStatus.type === 'error'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{locationStatus.message}</span>
                    </div>
                  )}

                  <Button
                    variant="danger"
                    size="lg"
                    className="w-full font-semibold shadow-lg shadow-rose-500/20 py-4 text-base"
                    onClick={handleCheckOut}
                    isLoading={isSubmitting}
                    leftIcon={<Clock className="w-5 h-5" />}
                  >
                    CHECK OUT NOW
                  </Button>
                </div>
              )}

              {/* NOT CHECKED IN or ALL SESSIONS COMPLETED — show check-in form */}
              {!isCheckedIn && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Select Attendance Type
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { type: 'office', label: 'Office (Geofenced)', icon: Building2 },
                        { type: 'field', label: 'Field Visit', icon: Compass },
                        { type: 'work_from_home', label: 'Work From Home', icon: Home },
                      ].map((item) => {
                        const Icon = item.icon;
                        const isSelected = attendanceType === item.type;
                        return (
                          <button
                            key={item.type}
                            type="button"
                            onClick={() => setAttendanceType(item.type as AttendanceType)}
                            className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition-all ${
                              isSelected
                                ? 'border-blue-600 bg-blue-50/80 text-blue-700 shadow-xs'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <Icon className={`w-5 h-5 mb-1 ${isSelected ? 'text-blue-600' : 'text-slate-400'}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Contextual Inputs */}
                  {attendanceType === 'field' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Field Work Notes / Destination Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Client meeting at Downtown Tech Park"
                        value={fieldNotes}
                        onChange={(e) => setFieldNotes(e.target.value)}
                        className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {attendanceType === 'work_from_home' && (
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-slate-700">
                        Work From Home Reason
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Approved remote day / Personal obligation"
                        value={wfhReason}
                        onChange={(e) => setWfhReason(e.target.value)}
                        className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  )}

                  {locationStatus && (
                    <div
                      className={`p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
                        locationStatus.type === 'error'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : locationStatus.type === 'success'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}
                    >
                      {locationStatus.type === 'error' ? (
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      ) : (
                        <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      )}
                      <span>{locationStatus.message}</span>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full font-semibold shadow-lg shadow-blue-500/20 py-4 text-base"
                    onClick={handleCheckIn}
                    isLoading={isSubmitting}
                    leftIcon={<CheckCircle2 className="w-5 h-5" />}
                  >
                    {todaySessions.length > 0 ? 'CHECK IN AGAIN' : 'CHECK IN NOW'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Monthly Summary Cards */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-4 text-center border-slate-200">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Days Present</p>
              <p className="text-2xl font-bold text-slate-900 mt-1">{monthlyStats.present}</p>
            </Card>
            <Card className="p-4 text-center border-slate-200">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Late Days</p>
              <p className="text-2xl font-bold text-amber-600 mt-1">{monthlyStats.late}</p>
            </Card>
            <Card className="p-4 text-center border-slate-200">
              <p className="text-[11px] font-semibold uppercase text-slate-500">Total Hours</p>
              <p className="text-2xl font-bold text-blue-600 mt-1">{monthlyStats.totalHours}h</p>
            </Card>
          </div>

          {/* Attendance History — Grouped by Date */}
          <Card className="p-5">
            <CardHeader className="mb-3">
              <CardTitle className="text-base">Attendance History</CardTitle>
              <CardDescription>Click on a date to view all sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {groupedHistory.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No attendance records found yet.</p>
              ) : (
                <div className="space-y-1">
                  {groupedHistory.map((group) => {
                    const isExpanded = expandedDates.has(group.date);
                    const hasMultipleSessions = group.sessions.length > 1;
                    const firstSession = group.sessions[group.sessions.length - 1]; // earliest session

                    return (
                      <div key={group.date} className="border border-slate-100 rounded-xl overflow-hidden">
                        {/* Date row — clickable */}
                        <button
                          onClick={() => toggleDateExpand(group.date)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50/80 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                            <div>
                              <p className="text-xs font-bold text-slate-900">{formatDate(group.date)}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5">
                                {group.sessions.length} session{group.sessions.length > 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            {!hasMultipleSessions && (
                              <span className="text-[11px] text-slate-500 font-mono">
                                {formatTime(firstSession.check_in_time)} → {firstSession.check_out_time ? formatTime(firstSession.check_out_time) : 'Active'}
                              </span>
                            )}
                            <span className="text-xs font-semibold text-blue-600">
                              {group.totalHours}h {group.totalMinutes}m
                            </span>
                            <Badge
                              variant={
                                firstSession.status === 'present'
                                  ? 'success'
                                  : firstSession.status === 'late'
                                  ? 'warning'
                                  : 'danger'
                              }
                              className="text-[10px] py-0 px-2"
                            >
                              {firstSession.status}
                            </Badge>
                          </div>
                        </button>

                        {/* Expanded sessions */}
                        {isExpanded && (
                          <div className="border-t border-slate-100 bg-slate-50/50">
                            <table className="w-full text-left text-xs text-slate-600">
                              <thead className="bg-slate-100/50 text-slate-500 font-semibold uppercase text-[10px]">
                                <tr>
                                  <th className="py-2 px-4">#</th>
                                  <th className="py-2 px-4">Check In</th>
                                  <th className="py-2 px-4">Check Out</th>
                                  <th className="py-2 px-4">Duration</th>
                                  <th className="py-2 px-4">Type</th>
                                  <th className="py-2 px-4">GPS</th>
                                  <th className="py-2 px-4">Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {[...group.sessions].reverse().map((rec, idx) => (
                                  <tr key={rec.id} className="hover:bg-white/80">
                                    <td className="py-2.5 px-4 text-slate-400 font-mono">{idx + 1}</td>
                                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                                      {formatTime(rec.check_in_time)}
                                    </td>
                                    <td className="py-2.5 px-4 font-semibold text-slate-900">
                                      {rec.check_out_time ? formatTime(rec.check_out_time) : (
                                        <span className="text-amber-600">Active</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-4 font-medium text-blue-600">
                                      {calculateWorkingHours(rec.check_in_time, rec.check_out_time).formatted}
                                    </td>
                                    <td className="py-2.5 px-4 capitalize">
                                      {rec.attendance_type.replace(/_/g, ' ')}
                                    </td>
                                    <td className="py-2.5 px-4">
                                      {rec.check_in_latitude && rec.check_in_longitude ? (
                                        <a
                                          href={getGoogleMapsUrl(rec.check_in_latitude, rec.check_in_longitude)}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-blue-600 hover:underline flex items-center gap-1 font-medium"
                                        >
                                          <MapPin className="w-3 h-3 text-blue-500" /> Map
                                        </a>
                                      ) : (
                                        <span className="text-slate-400">N/A</span>
                                      )}
                                    </td>
                                    <td className="py-2.5 px-4">
                                      <Badge
                                        variant={
                                          rec.status === 'present'
                                            ? 'success'
                                            : rec.status === 'late'
                                            ? 'warning'
                                            : 'danger'
                                        }
                                        className="text-[10px] py-0 px-2"
                                      >
                                        {rec.status}
                                      </Badge>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      <MobileNav role={userProfile?.role} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
