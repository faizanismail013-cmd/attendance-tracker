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
      .from('leave_requests')
      .select(`
        *,
        employee:profiles!leave_requests_employee_id_fkey(full_name, email, department),
        reviewer:profiles!leave_requests_reviewed_by_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    // Non-admins can only see their own leave requests
    if (profile?.role !== 'admin') {
      query = query.eq('employee_id', user.id);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ leaves: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch leave requests';
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
    const { leave_type, start_date, end_date, reason } = body;

    if (!leave_type || !start_date || !end_date || !reason) {
      return NextResponse.json(
        { error: 'Leave type, start date, end date, and reason are required.' },
        { status: 400 }
      );
    }

    if (new Date(end_date) < new Date(start_date)) {
      return NextResponse.json(
        { error: 'End date cannot be before start date.' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('leave_requests')
      .insert({
        employee_id: user.id,
        leave_type,
        start_date,
        end_date,
        reason,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      message: 'Leave request submitted successfully.',
      leave: data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit leave request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
