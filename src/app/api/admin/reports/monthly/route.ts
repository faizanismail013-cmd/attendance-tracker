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

    // 1. Fetch all active employees
    const { data: employees, error: empErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, department, role, status')
      .eq('status', 'active')
      .order('full_name');

    if (empErr) throw empErr;

    // 2. Fetch all attendance records for this month
    const { data: records, error: attErr } = await supabase
      .from('attendance')
      .select('*')
      .gte('attendance_date', startDate)
      .lte('attendance_date', endDate);

    if (attErr) throw attErr;

    // 3. Fetch approved leaves for this month
    const { data: leaves, error: leaveErr } = await supabase
      .from('leave_requests')
      .select('*')
      .eq('status', 'approved')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (leaveErr) throw leaveErr;

    // Aggregate monthly report per employee
    const summaries = employees.map((emp) => {
      const empAttendance = (records || []).filter((r) => r.employee_id === emp.id);
      const empLeaves = (leaves || []).filter((l) => l.employee_id === emp.id);

      const present_days = empAttendance.filter((r) => r.status === 'present').length;
      const late_days = empAttendance.filter((r) => r.status === 'late').length;

      const office_days = empAttendance.filter((r) => r.attendance_type === 'office').length;
      const field_days = empAttendance.filter((r) => r.attendance_type === 'field').length;
      const wfh_days = empAttendance.filter((r) => r.attendance_type === 'work_from_home').length;

      let leave_days = 0;
      empLeaves.forEach((l) => {
        const start = new Date(l.start_date);
        const end = new Date(l.end_date);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        leave_days += diffDays;
      });

      let total_hours = 0;
      empAttendance.forEach((r) => {
        if (r.check_in_time && r.check_out_time) {
          const inTime = new Date(r.check_in_time).getTime();
          const outTime = new Date(r.check_out_time).getTime();
          total_hours += Math.max(0, (outTime - inTime) / (1000 * 60 * 60));
        }
      });

      return {
        employee: emp,
        total_present: present_days + late_days,
        present_days,
        late_days,
        office_days,
        field_days,
        wfh_days,
        leave_days,
        total_work_hours: parseFloat(total_hours.toFixed(1)),
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
