import { createClient } from '@/lib/supabase/server';
import { getTodayISODate } from '@/lib/utils/date';
import { haversineDistance } from '@/lib/utils/geo';
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
    const {
      latitude = null,
      longitude = null,
      accuracy = null,
      attendance_type = 'office',
      field_notes = null,
      wfh_reason = null,
    } = body;

    const todayDate = getTodayISODate();
    const now = new Date();

    // 1. Check if employee has an ACTIVE (not checked out) attendance for today
    const { data: todayRecords, error: fetchError } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', user.id)
      .eq('attendance_date', todayDate)
      .order('created_at', { ascending: false });

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Fetch attendance error:', fetchError);
    }

    const records = todayRecords || [];

    // Check if there's an active session (checked in but not checked out)
    const activeSession = records.find(
      (r) => r.check_in_time && !r.check_out_time
    );

    if (activeSession) {
      return NextResponse.json(
        { error: 'You have an active session. Please check out first before checking in again.' },
        { status: 400 }
      );
    }

    // 2. Fetch office settings
    const { data: officeSettings } = await supabase
      .from('office_settings')
      .select('*')
      .limit(1)
      .maybeSingle();

    const officeLat = officeSettings?.office_latitude ?? officeSettings?.latitude ?? 28.6139;
    const officeLng = officeSettings?.office_longitude ?? officeSettings?.longitude ?? 77.2090;
    const allowedRadius = officeSettings?.radius_meters ?? officeSettings?.allowed_radius_meters ?? 200;
    const isGeofenceEnabled = officeSettings?.geofence_enabled ?? true;
    const isWfhAllowed = officeSettings?.wfh_allowed ?? true;

    // 3. Check WFH permission if attendance_type is work_from_home
    if (attendance_type === 'work_from_home') {
      if (isWfhAllowed === false) {
        return NextResponse.json(
          { error: 'Work from home is currently disabled by office policy.' },
          { status: 400 }
        );
      }
    }

    // 4. Geofence enforcement for office check-in
    if (attendance_type === 'office' && isGeofenceEnabled) {
      if (latitude === null || longitude === null) {
        return NextResponse.json(
          { error: 'GPS location is required for Office check-in. Please enable location access.' },
          { status: 400 }
        );
      }

      const distance = haversineDistance(latitude, longitude, officeLat, officeLng);

      if (distance > allowedRadius) {
        return NextResponse.json(
          {
            error: `Outside office geofence zone. You are ${Math.round(distance)}m away from office (allowed radius: ${allowedRadius}m).`,
          },
          { status: 400 }
        );
      }
    }

    // 5. Determine working status ('present' vs 'late')
    let calculatedStatus: 'present' | 'late' = 'present';
    const startTimeStr = officeSettings?.working_start_time || '09:00:00';
    if (startTimeStr) {
      const parts = startTimeStr.split(':').map(Number);
      const startHour = parts[0] || 9;
      const startMinute = parts[1] || 0;
      const graceMinutes = officeSettings?.grace_period_minutes || 15;

      const expectedStart = new Date(now);
      expectedStart.setHours(startHour, startMinute + graceMinutes, 0, 0);

      // Only mark first session of the day as late
      if (now > expectedStart && records.length === 0) {
        calculatedStatus = 'late';
      }
    }

    // 6. Always INSERT a new session record (supports multiple sessions per day)
    const attendancePayload: Record<string, any> = {
      employee_id: user.id,
      attendance_date: todayDate,
      check_in_time: now.toISOString(),
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      check_in_accuracy: accuracy,
      attendance_type,
      status: calculatedStatus,
    };

    if (field_notes) attendancePayload.field_notes = field_notes;
    if (wfh_reason) attendancePayload.wfh_reason = wfh_reason;

    let { data: newAttendance, error: insertError } = await supabase
      .from('attendance')
      .insert(attendancePayload)
      .select()
      .single();

    // Fallback if schema does not have field_notes / wfh_reason columns yet
    if (insertError && (insertError.message.includes('field_notes') || insertError.message.includes('wfh_reason'))) {
      delete attendancePayload.field_notes;
      delete attendancePayload.wfh_reason;

      const fallbackResult = await supabase
        .from('attendance')
        .insert(attendancePayload)
        .select()
        .single();

      newAttendance = fallbackResult.data;
      insertError = fallbackResult.error;
    }

    if (insertError) {
      console.error('Check-in insert error:', insertError);
      return NextResponse.json(
        { error: insertError.message || insertError.details || 'Database check-in failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: 'Checked in successfully',
      attendance: newAttendance,
    });
  } catch (error: any) {
    console.error('Check-in exception:', error);
    const message = typeof error === 'string' ? error : error?.message || 'Check-in failed. Please try again.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
