import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString(), 10);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString(), 10);

    // Format start and end date of the month
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;

    // 1. Fetch all active employees (excluding administrators)
    const { data: employees, error: empErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, department, role, status')
      .eq('status', 'active')
      .neq('role', 'admin')
      .order('full_name');

    if (empErr) throw empErr;

    // 2. Fetch all attendance records for this month
    const { data: records, error: attErr } = await supabase
      .from('attendance')
      .select('*')
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate)
      .order('check_in_time', { ascending: true });

    if (attErr) throw attErr;

    // 3. Fetch approved leaves for this month
    let leaves: any[] = [];
    try {
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('status', 'approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);
      leaves = leaveData || [];
    } catch {
      leaves = [];
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Aggregate monthly report per employee
    const summaries = (employees || []).map((emp) => {
      const empAttendance = (records || []).filter((r) => r.employee_id === emp.id);
      const empLeaves = (leaves || []).filter((l) => l.employee_id === emp.id);

      // Group sessions by date
      const dateMap = new Map<string, any[]>();
      empAttendance.forEach((r) => {
        const existing = dateMap.get(r.attendance_date) || [];
        existing.push(r);
        dateMap.set(r.attendance_date, existing);
      });

      // Unique present dates
      const uniquePresentDates = Array.from(dateMap.keys());
      const total_present = uniquePresentDates.length;

      let late_days = 0;
      let office_days = 0;
      let field_days = 0;
      let wfh_days = 0;
      let total_hours = 0;

      dateMap.forEach((daySessions) => {
        // Late if any session or first session was marked late
        if (daySessions.some((s) => s.status === 'late')) {
          late_days++;
        }
        if (daySessions.some((s) => s.attendance_type === 'office')) {
          office_days++;
        }
        if (daySessions.some((s) => s.attendance_type === 'field')) {
          field_days++;
        }
        if (daySessions.some((s) => s.attendance_type === 'work_from_home')) {
          wfh_days++;
        }

        daySessions.forEach((r) => {
          if (r.check_in_time && r.check_out_time) {
            const inTime = new Date(r.check_in_time).getTime();
            const outTime = new Date(r.check_out_time).getTime();
            total_hours += Math.max(0, (outTime - inTime) / (1000 * 60 * 60));
          }
        });
      });

      // Calculate leave days
      const leaveDateSet = new Set<string>();
      empLeaves.forEach((l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const cur = new Date(start);
        while (cur <= end) {
          const curStr = cur.toISOString().split('T')[0];
          if (curStr >= startDate && curStr <= endDate) {
            leaveDateSet.add(curStr);
          }
          cur.setDate(cur.getDate() + 1);
        }
      });
      const leave_days = leaveDateSet.size;

      // Build daily calendar list for each day of the month (1..lastDay)
      const calendarDays: any[] = [];
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      for (let day = 1; day <= lastDay; day++) {
        const dateObj = new Date(year, month - 1, day);
        const dayStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const dayOfWeek = dateObj.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
        const daySessions = dateMap.get(dayStr) || [];
        const isLeave = leaveDateSet.has(dayStr);
        const isFuture = dayStr > todayStr;

        let statusLetter: 'P' | 'A' | 'L' | 'LV' | 'W' | '-' = '-';
        let statusLabel = 'No Record';

        if (daySessions.length > 0) {
          const isLate = daySessions.some((s) => s.status === 'late');
          statusLetter = isLate ? 'L' : 'P';
          statusLabel = isLate ? 'Late' : 'Present';
        } else if (isLeave) {
          statusLetter = 'LV';
          statusLabel = 'Approved Leave';
        } else if (isWeekend) {
          statusLetter = 'W';
          statusLabel = 'Weekend';
        } else if (!isFuture) {
          statusLetter = 'A';
          statusLabel = 'Absent';
        } else {
          statusLetter = '-';
          statusLabel = 'Upcoming';
        }

        let dayHours = 0;
        daySessions.forEach((s) => {
          if (s.check_in_time && s.check_out_time) {
            const diff = new Date(s.check_out_time).getTime() - new Date(s.check_in_time).getTime();
            dayHours += Math.max(0, diff / (1000 * 60 * 60));
          }
        });

        calendarDays.push({
          date: dayStr,
          dayNumber: day,
          dayName: dayNames[dayOfWeek],
          isWeekend,
          isFuture,
          statusLetter,
          statusLabel,
          sessions: daySessions,
          workHours: parseFloat(dayHours.toFixed(1)),
        });
      }

      return {
        employee: emp,
        total_present,
        late_days,
        office_days,
        field_days,
        wfh_days,
        leave_days,
        total_work_hours: parseFloat(total_hours.toFixed(1)),
        calendarDays,
      };
    });

    return NextResponse.json({
      month,
      year,
      startDate,
      endDate,
      summaries,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate monthly report';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
