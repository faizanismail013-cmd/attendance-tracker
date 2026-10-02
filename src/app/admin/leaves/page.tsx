'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LeaveRequest, Profile } from '@/types';
import { formatDate } from '@/lib/utils/date';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AdminLeavesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchLeaves = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setAdminUser(profile);

      const res = await fetch('/api/leaves');
      const data = await res.json();
      if (res.ok) {
        setLeaves(data.leaves || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  const handleReviewLeave = async (status: 'approved' | 'rejected') => {
    if (!selectedLeave) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/leaves/${selectedLeave.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          admin_notes: adminNotes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Review failed');

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: `Leave Request ${status.toUpperCase()}`,
        description: `Leave request for ${(selectedLeave.employee || selectedLeave.profiles)?.full_name || 'Employee'} updated.`,
      });

      setSelectedLeave(null);
      setAdminNotes('');
      fetchLeaves();
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Error',
        description: err instanceof Error ? err.message : 'Action failed',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading leave requests..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 lg:pb-0">
      <Navbar user={adminUser} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar role="admin" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Calendar className="w-6 h-6 text-blue-600" /> Leave Management
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review, approve, or reject employee leave applications
            </p>
          </div>

          <Card className="p-5">
            <CardHeader className="mb-4">
              <CardTitle className="text-base">Leave Requests</CardTitle>
              <CardDescription>Employee leave requests pending decision or historical decision</CardDescription>
            </CardHeader>
            <CardContent>
              {leaves.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-500">No leave requests found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Department</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Dates</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaves.map((leave) => (
                        <tr key={leave.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{(leave.employee || leave.profiles)?.full_name || 'Staff'}</p>
                            <p className="text-[10px] text-slate-400">{(leave.employee || leave.profiles)?.email}</p>
                          </td>
                          <td className="py-3 px-3 text-slate-700">{(leave.employee || leave.profiles)?.department || 'General'}</td>
                          <td className="py-3 px-3 capitalize font-medium">{leave.leave_type}</td>
                          <td className="py-3 px-3 font-medium">
                            {formatDate(leave.start_date)} - {formatDate(leave.end_date)}
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate">{leave.reason}</td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                leave.status === 'approved'
                                  ? 'success'
                                  : leave.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                              }
                              className="text-[10px] py-0.5 px-2 capitalize"
                            >
                              {leave.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                              {leave.status === 'rejected' && <XCircle className="w-3 h-3 mr-1 inline" />}
                              {leave.status === 'pending' && <Clock className="w-3 h-3 mr-1 inline" />}
                              {leave.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3">
                            {leave.status === 'pending' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedLeave(leave);
                                  setAdminNotes('');
                                }}
                              >
                                Review
                              </Button>
                            ) : (
                              <span className="text-[10px] text-slate-400">Decided</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Review Modal */}
      {selectedLeave && (
        <Modal
          isOpen={!!selectedLeave}
          onClose={() => setSelectedLeave(null)}
          title="Review Leave Application"
        >
          <div className="space-y-4 pt-2">
            <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 space-y-1.5 font-medium">
              <p><strong className="font-bold text-slate-900">Employee:</strong> <span className="text-slate-900">{(selectedLeave.employee || selectedLeave.profiles)?.full_name}</span></p>
              <p><strong className="font-bold text-slate-900">Leave Period:</strong> <span className="text-slate-900">{formatDate(selectedLeave.start_date)} to {formatDate(selectedLeave.end_date)}</span></p>
              <p><strong className="font-bold text-slate-900">Type:</strong> <span className="capitalize text-slate-900 font-semibold">{selectedLeave.leave_type}</span></p>
              <p><strong className="font-bold text-slate-900">Reason:</strong> <span className="text-slate-900">{selectedLeave.reason}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5">
                Admin Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Enter notes or reason for approval / rejection..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white rounded-lg border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 focus:outline-none placeholder:text-slate-400"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="danger"
                size="sm"
                isLoading={isSubmitting}
                onClick={() => handleReviewLeave('rejected')}
              >
                Reject Request
              </Button>
              <Button
                variant="success"
                size="sm"
                isLoading={isSubmitting}
                onClick={() => handleReviewLeave('approved')}
              >
                Approve Request
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <MobileNav role="admin" />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
