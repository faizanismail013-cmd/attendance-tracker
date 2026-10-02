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

    let query = supabase
      .from('attendance_corrections')
      .select(`
        *,
        employee:profiles!attendance_corrections_employee_id_fkey(full_name, email, department),
        reviewer:profiles!attendance_corrections_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    // Non-admins can only see their own requests
    if (profile?.role !== 'admin') {
      query = query.eq('employee_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ corrections: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch correction requests';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      attendance_id = null,
      requested_check_in,
      requested_check_out,
      reason,
    } = body;

    if (!reason || (!requested_check_in && !requested_check_out)) {
      return NextResponse.json(
        { error: 'Please provide a reason and at least one time correction.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('attendance_corrections')
      .insert({
        employee_id: user.id,
        attendance_id: attendance_id || null,
        requested_check_in: requested_check_in || null,
        requested_check_out: requested_check_out || null,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Attendance correction request submitted successfully.',
      correction: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit correction request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
