import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/utils/audit';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('office_settings')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return NextResponse.json({ settings: data || null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch office settings';
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

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const {
      company_name = 'PulseEnterprise Corp',
      office_latitude = 28.6139,
      office_longitude = 77.2090,
      radius_meters = 100,
      geofence_enabled = true,
      wfh_allowed = true,
      allow_field = true,
      require_location = true,
      working_start_time = '09:00',
      working_end_time = '18:00',
      grace_period_minutes = 15,
      min_working_hours = 8,
      late_threshold_minutes = 15,
    } = body;

    // Fetch existing settings ID if available
    const { data: existing } = await supabase
      .from('office_settings')
      .select('id')
      .limit(1)
      .single();

    const payload = {
      company_name,
      office_latitude: parseFloat(office_latitude),
      office_longitude: parseFloat(office_longitude),
      radius_meters: parseInt(radius_meters, 10),
      geofence_enabled: Boolean(geofence_enabled),
      wfh_allowed: Boolean(wfh_allowed),
      allow_field: Boolean(allow_field),
      require_location: Boolean(require_location),
      working_start_time,
      working_end_time,
      grace_period_minutes: parseInt(grace_period_minutes, 10),
      min_working_hours: parseFloat(min_working_hours),
      late_threshold_minutes: parseInt(late_threshold_minutes, 10),
      updated_at: new Date().toISOString(),
    };

    let result;
    if (existing?.id) {
      result = await supabase
        .from('office_settings')
        .update(payload)
        .eq('id', existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from('office_settings')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    // Audit Log
    await logAuditAction({
      actor_user_id: user.id,
      action: 'settings_updated',
      entity_type: 'office_settings',
      entity_id: result.data.id,
      metadata: { company_name, geofence_enabled, wfh_allowed },
    });

    return NextResponse.json({
      message: 'Office & company settings updated successfully',
      settings: result.data,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save settings';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
