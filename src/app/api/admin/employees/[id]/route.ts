import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// PATCH /api/admin/employees/[id]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: employeeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!adminProfile || adminProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const {
      full_name,
      phone,
      role,
      employee_code,
      department,
      joining_date,
      status,
      password,
    } = body;

    const adminSupabase = createAdminClient();

    // If password provided, update auth user password and flag for mandatory change on login
    if (password && password.trim().length >= 6) {
      await adminSupabase.auth.admin.updateUserById(employeeId, {
        password: password.trim(),
        user_metadata: { must_change_password: true },
      });
    }

    // Update profile
    const updateData: Record<string, unknown> = {};
    if (full_name !== undefined) updateData.full_name = full_name;
    if (phone !== undefined) updateData.phone = phone;
    if (role !== undefined) updateData.role = role;
    if (employee_code !== undefined) updateData.employee_code = employee_code;
    if (department !== undefined) updateData.department = department;
    if (joining_date !== undefined) updateData.joining_date = joining_date;
    if (status !== undefined) updateData.status = status;

    const { data: updatedProfile, error: updateError } = await adminSupabase
      .from('profiles')
      .update(updateData)
      .eq('id', employeeId)
      .select()
      .single();

    if (updateError) throw updateError;

    return NextResponse.json({ employee: updatedProfile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update employee';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
