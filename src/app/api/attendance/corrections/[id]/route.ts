import { createClient } from '@/lib/supabase/server';
import { logAuditAction } from '@/lib/utils/audit';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { status, admin_notes } = body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be "approved" or "rejected".' },
        { status: 400 }
      );
    }

    // Fetch the correction request first
    const { data: correctionReq, error: fetchErr } = await supabase
      .from('attendance_corrections')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !correctionReq) {
      return NextResponse.json(
        { error: 'Correction request not found.' },
        { status: 404 }
      );
    }

    // Update the correction request
    const { data: updatedCorrection, error: updateError } = await supabase
      .from('attendance_corrections')
      .update({
        status,
        admin_notes: admin_notes || null,
        admin_comment: admin_notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Correction review error:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update correction request' },
        { status: 400 }
      );
    }

    // If approved, apply the correction to the attendance record
    if (status === 'approved') {
      const updatePayload: Record<string, any> = {
        is_corrected: true,
      };

      if (correctionReq.requested_check_in) {
        updatePayload.check_in_time = correctionReq.requested_check_in;
      }
      if (correctionReq.requested_check_out) {
        updatePayload.check_out_time = correctionReq.requested_check_out;
      }

      // If there's a linked attendance record, update it
      if (correctionReq.attendance_id) {
        await supabase
          .from('attendance')
          .update(updatePayload)
          .eq('id', correctionReq.attendance_id);
      }
    }

    await logAuditAction({
      actor_user_id: user.id,
      action: `correction_${status}`,
      entity_type: 'attendance_corrections',
      entity_id: id,
      metadata: { status, admin_notes },
    });

    return NextResponse.json({
      message: `Correction request ${status} successfully`,
      correction: updatedCorrection,
    });
  } catch (error: any) {
    console.error('Correction review exception:', error);
    const message = error?.message || 'Failed to review correction request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
