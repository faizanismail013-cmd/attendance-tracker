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
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = supabase
      .from('attendance')
      .select(`
        *,
        employee:profiles!attendance_employee_id_fkey(full_name, email, department)
      `)
      .order('attendance_date', { ascending: false });

    if (startDate) query = query.gte('attendance_date', startDate);
    if (endDate) query = query.lte('attendance_date', endDate);

    const { data: records, error } = await query;
    if (error) throw error;

    // Generate CSV String
    const headers = [
      'Date',
      'Employee Name',
      'Email',
      'Department',
      'Type',
      'Status',
      'Check-in Time',
      'Check-out Time',
      'Check-in Lat',
      'Check-in Lng',
      'Field Notes / WFH Reason',
      'Is Corrected',
    ];

    const rows = (records || []).map((r) => {
      const emp = r.employee as { full_name?: string; email?: string; department?: string } | null;
      return [
        `"${r.attendance_date}"`,
        `"${emp?.full_name || ''}"`,
        `"${emp?.email || ''}"`,
        `"${emp?.department || ''}"`,
        `"${r.attendance_type || 'office'}"`,
        `"${r.status || 'present'}"`,
        `"${r.check_in_time ? new Date(r.check_in_time).toLocaleString() : ''}"`,
        `"${r.check_out_time ? new Date(r.check_out_time).toLocaleString() : ''}"`,
        `"${r.check_in_latitude ?? ''}"`,
        `"${r.check_in_longitude ?? ''}"`,
        `"${r.field_notes || r.wfh_reason || ''}"`,
        `"${r.is_corrected ? 'Yes' : 'No'}"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="attendance_report_${startDate || 'all'}_to_${endDate || 'all'}.csv"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'CSV export failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
