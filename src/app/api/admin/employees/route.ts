import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// GET /api/admin/employees
export async function GET() {
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

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { data: employees, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ employees });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch employees';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST /api/admin/employees
export async function POST(request: Request) {
  try {
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
      email,
      password,
      phone,
      role = 'employee',
      employee_code,
      department,
      joining_date,
    } = body;

    if (!full_name || !email || !password) {
      return NextResponse.json(
        { error: 'Full name, email, and initial password are required' },
        { status: 400 }
      );
    }

    const adminSupabase = createAdminClient();

    // 1. Create auth user using admin client
    const { data: newUser, error: createAuthError } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
        employee_code,
        department,
      },
    });

    if (createAuthError) {
      return NextResponse.json({ error: createAuthError.message }, { status: 400 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create authentication user' }, { status: 500 });
    }

    // 2. Ensure profiles record exists / is updated
    const { data: profile, error: profileError } = await adminSupabase
      .from('profiles')
      .upsert({
        id: newUser.user.id,
        full_name,
        email,
        phone: phone || null,
        role,
        employee_code: employee_code || `EMP-${newUser.user.id.substring(0, 6)}`,
        department: department || 'General',
        joining_date: joining_date || new Date().toISOString().split('T')[0],
        status: 'active',
      })
      .select()
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ employee: profile }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create employee';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
