import { createClient } from '@/lib/supabase/server';
import { getTodayISODate } from '@/lib/utils/date';
import { NextResponse } from 'next/server';

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
    const { latitude = null, longitude = null, accuracy = null } = body;

    const todayDate = getTodayISODate();
    const now = new Date();

    // 1. Fetch the ACTIVE (checked in but not checked out) session for today
    const { data: todayRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('attendance_date', todayDate)
      .is('check_out_time', null)
      .not('check_in_time', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('Fetch attendance error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch attendance records.' },
        { status: 500 }
      );
    }

    const activeSession = todayRecords?.[0];

    if (!activeSession) {
      return NextResponse.json(
        { error: 'No active check-in session found for today. Please check in first.' },
        { status: 400 }
      );
    }

    // 2. Update the active session with check-out time
    const { data: updatedAttendance, error: updateError } = await supabase
      .from('attendance')
      .update({
        check_out_time: now.toISOString(),
        check_out_latitude: latitude,
        check_out_longitude: longitude,
        check_out_accuracy: accuracy,
      })
      .eq('id', activeSession.id)
      .select()
      .single();

    if (updateError) {
      console.error('Check-out error:', updateError);
      return NextResponse.json(
        { error: updateError.message || updateError.details || 'Check-out failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Checked out successfully',
      attendance: updatedAttendance,
    });
  } catch (error: any) {
    console.error('Check-out exception:', error);
    const message = typeof error === 'string' ? error : error?.message || 'Check-out failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
