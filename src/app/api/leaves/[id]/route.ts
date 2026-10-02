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

    const { data: updatedLeave, error: updateError } = await supabase
      .from('leave_requests')
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
      console.error('Leave review error:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update leave request' },
        { status: 400 }
      );
    }

    await logAuditAction({
      actor_user_id: user.id,
      action: `leave_${status}`,
      entity_type: 'leave_requests',
      entity_id: id,
      metadata: { status, admin_notes },
    });

    return NextResponse.json({
      message: `Leave request ${status} successfully`,
      leave: updatedLeave,
    });
  } catch (error: any) {
    console.error('Leave review exception:', error);
    const message = error?.message || 'Failed to review leave request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
