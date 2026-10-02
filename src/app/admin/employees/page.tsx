'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole, UserStatus } from '@/types';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/LoadingState';
import { ErrorState } from '@/components/ui/ErrorState';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import {
  UserPlus,
  Search,
  Edit2,
  CheckCircle2,
  XCircle,
  User,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Lock,
  Hash,
  Trash2,
} from 'lucide-react';

export default function AdminEmployeesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Profile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    employee_code: '',
    department: 'Engineering',
    joining_date: new Date().toISOString().split('T')[0],
    role: 'employee' as UserRole,
    status: 'active' as UserStatus,
  });

  useEffect(() => {
    let ignore = false;
    async function fetchEmployees() {
      setErrorMessage(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (ignore) return;
        if (!user) {
          router.push('/login');
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (ignore) return;
        if (profile?.role !== 'admin') {
          router.push('/dashboard');
          return;
        }
        setAdminUser(profile);

        const res = await fetch('/api/admin/employees');
        const data = await res.json();

        if (ignore) return;
        if (!res.ok) throw new Error(data.error || 'Failed to fetch employees');
        setEmployees(data.employees || []);
      } catch (err) {
        if (ignore) return;
        const msg = err instanceof Error ? err.message : 'Error loading employees';
        setErrorMessage(msg);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }

    fetchEmployees();
    return () => {
      ignore = true;
    };
  }, [router, supabase, refreshTrigger]);

  const handleOpenAddModal = () => {
    setFormData({
      full_name: '',
      email: '',
      password: '',
      phone: '',
      employee_code: `EMP-${Math.floor(1000 + Math.random() * 9000)}`,
      department: 'General',
      joining_date: new Date().toISOString().split('T')[0],
      role: 'employee',
      status: 'active',
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (emp: Profile) => {
    setSelectedEmployee(emp);
    setFormData({
      full_name: emp.full_name,
      email: emp.email,
      password: '',
      phone: emp.phone || '',
      employee_code: emp.employee_code || '',
      department: emp.department || 'General',
      joining_date: emp.joining_date || new Date().toISOString().split('T')[0],
      role: emp.role,
      status: emp.status,
    });
    setFormError(null);
    setIsEditModalOpen(true);
  };

  // Submit Add Employee
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to create employee');

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Employee Added!',
        description: `${formData.full_name} has been added to staff roster.`,
      });

      setIsAddModalOpen(false);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error adding employee';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Edit Employee
  const handleEditEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch(`/api/admin/employees/${selectedEmployee.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to update employee');

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Employee Updated!',
        description: `${formData.full_name}'s profile was updated successfully.`,
      });

      setIsEditModalOpen(false);
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error editing employee';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Employee Status
  const handleToggleStatus = async (emp: Profile) => {
    const newStatus: UserStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      setToast({
        id: Date.now().toString(),
        type: 'info',
        title: 'Status Updated',
        description: `${emp.full_name} marked as ${newStatus.toUpperCase()}`,
      });

      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error updating status';
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Error',
        description: msg,
      });
    }
  };

  // Delete Employee completely (from Auth + Profiles)
  const handleDeleteEmployee = async (emp: Profile) => {
    if (!confirm(`Are you sure you want to completely delete ${emp.full_name}? This will remove their user credentials and attendance records permanently.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/employees/${emp.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete employee');

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Employee Deleted',
        description: `${emp.full_name} was removed completely from the system.`,
      });
      setRefreshTrigger((p) => p + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to delete employee';
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Delete Failed',
        description: msg,
      });
    }
  };

  const filteredEmployees = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.employee_code && e.employee_code.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (e.department && e.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Fetching employee directory..." />
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <ErrorState message={errorMessage} onRetry={() => setRefreshTrigger((p) => p + 1)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 lg:pb-0 w-full max-w-full overflow-x-hidden">
      <Navbar user={adminUser} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto min-w-0">
        <Sidebar role="admin" />

        <main className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-6 lg:p-8 space-y-5 overflow-x-hidden">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">Employee Management</h1>
              <p className="text-xs text-slate-500">Manage employee accounts, roles &amp; status</p>
            </div>
            <Button
              variant="primary"
              onClick={handleOpenAddModal}
              leftIcon={<UserPlus className="w-4 h-4" />}
              className="shadow-md shadow-blue-500/20"
            >
              Add New Employee
            </Button>
          </div>

          {/* Search bar */}
          <Card className="p-4">
            <div className="max-w-md">
              <Input
                placeholder="Search by name, email, code or department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
              />
            </div>
          </Card>

          {/* Employees Directory Table */}
          <Card className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="py-3 px-3">Code</th>
                    <th className="py-3 px-3">Full Name</th>
                    <th className="py-3 px-3">Email</th>
                    <th className="py-3 px-3">Department</th>
                    <th className="py-3 px-3">Role</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-3 font-mono font-semibold text-slate-800">
                        {emp.employee_code || '--'}
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-900">{emp.full_name}</td>
                      <td className="py-3 px-3">{emp.email}</td>
                      <td className="py-3 px-3">{emp.department || 'General'}</td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={emp.role === 'admin' ? 'purple' : 'info'}
                          className="text-[10px] py-0 px-2"
                        >
                          {emp.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-3">
                        <Badge
                          variant={emp.status === 'active' ? 'success' : 'danger'}
                          className="text-[10px] py-0 px-2"
                        >
                          {emp.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3 text-right space-x-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenEditModal(emp)}
                          leftIcon={<Edit2 className="w-3 h-3" />}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={emp.status === 'active' ? 'outline' : 'success'}
                          size="sm"
                          onClick={() => handleToggleStatus(emp)}
                          leftIcon={
                            emp.status === 'active' ? (
                              <XCircle className="w-3 h-3 text-rose-600" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            )
                          }
                        >
                          {emp.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        {emp.role !== 'admin' && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDeleteEmployee(emp)}
                            leftIcon={<Trash2 className="w-3 h-3" />}
                          >
                            Delete
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </main>
      </div>

      {/* Add Employee Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Employee"
        description="Create credentials & profile for a new team member."
        maxWidth="lg"
      >
        <form onSubmit={handleAddEmployee} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              leftIcon={<User className="w-4 h-4" />}
            />
            <Input
              label="Email Address *"
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              leftIcon={<Mail className="w-4 h-4" />}
            />
            <Input
              label="Initial Password *"
              type="password"
              required
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              leftIcon={<Phone className="w-4 h-4" />}
            />
            <Input
              label="Employee Code"
              value={formData.employee_code}
              onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
              leftIcon={<Hash className="w-4 h-4" />}
            />
            <Input
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              leftIcon={<Briefcase className="w-4 h-4" />}
            />
            <Input
              label="Joining Date"
              type="date"
              value={formData.joining_date}
              onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                System Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Create Employee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Employee Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Employee Details"
        description="Update profile, department or credentials."
        maxWidth="lg"
      >
        <form onSubmit={handleEditEmployee} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 text-rose-700 border border-rose-200 text-xs rounded-lg">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Full Name *"
              required
              value={formData.full_name}
              onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              leftIcon={<User className="w-4 h-4" />}
            />
            <Input
              label="Email (Read-only)"
              disabled
              value={formData.email}
              leftIcon={<Mail className="w-4 h-4" />}
            />
            <Input
              label="Reset Password (Optional)"
              type="password"
              placeholder="Leave blank to keep unchanged"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              leftIcon={<Lock className="w-4 h-4" />}
            />
            <Input
              label="Phone Number"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              leftIcon={<Phone className="w-4 h-4" />}
            />
            <Input
              label="Employee Code"
              value={formData.employee_code}
              onChange={(e) => setFormData({ ...formData, employee_code: e.target.value })}
              leftIcon={<Hash className="w-4 h-4" />}
            />
            <Input
              label="Department"
              value={formData.department}
              onChange={(e) => setFormData({ ...formData, department: e.target.value })}
              leftIcon={<Briefcase className="w-4 h-4" />}
            />
            <Input
              label="Joining Date"
              type="date"
              value={formData.joining_date}
              onChange={(e) => setFormData({ ...formData, joining_date: e.target.value })}
              leftIcon={<Calendar className="w-4 h-4" />}
            />
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                System Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      <MobileNav role="admin" />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
