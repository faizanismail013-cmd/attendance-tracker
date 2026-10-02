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
import { Calendar, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function EmployeeLeavesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [leaveType, setLeaveType] = useState<'sick' | 'casual' | 'earned' | 'unpaid'>('casual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');

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
      setUserProfile(profile);

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

  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate || !reason) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Validation Error',
        description: 'Please fill in all required fields.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/leaves', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit leave request');
      }

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Request Submitted',
        description: 'Your leave request has been submitted for admin approval.',
      });

      setIsModalOpen(false);
      setStartDate('');
      setEndDate('');
      setReason('');
      fetchLeaves();
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Submission Error',
        description: err instanceof Error ? err.message : 'Error submitting request',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={userProfile} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading your leave records..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-24 lg:pb-0 w-full max-w-full overflow-x-hidden">
      <Navbar user={userProfile} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto min-w-0">
        <Sidebar role={userProfile?.role} />

        <main className="flex-1 min-w-0 w-full max-w-full p-3 sm:p-6 lg:p-8 space-y-5 overflow-x-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <Calendar className="w-6 h-6 text-blue-600" /> My Leave Applications
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Apply for time off and track status of pending leave requests
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
              className="shadow-md shadow-blue-500/20"
            >
              Apply for Leave
            </Button>
          </div>

          <Card className="p-5">
            <CardHeader className="mb-4">
              <CardTitle className="text-base">Leave Application History</CardTitle>
              <CardDescription>All submitted leave applications</CardDescription>
            </CardHeader>
            <CardContent>
              {leaves.length === 0 ? (
                <div className="text-center py-10">
                  <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No leave requests recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">End Date</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Admin Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaves.map((leave) => (
                        <tr key={leave.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-semibold text-slate-900 capitalize">
                            {leave.leave_type} Leave
                          </td>
                          <td className="py-3 px-3 font-medium">{formatDate(leave.start_date)}</td>
                          <td className="py-3 px-3 font-medium">{formatDate(leave.end_date)}</td>
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
                          <td className="py-3 px-3 text-slate-500 italic">
                            {leave.admin_notes || leave.admin_comment || '--'}
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

      {/* Apply Leave Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Apply for Leave">
        <form onSubmit={handleSubmitLeave} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Leave Type</label>
            <select
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as any)}
              className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="casual">Casual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="earned">Earned / Paid Leave</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">End Date</label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason for Leave</label>
            <textarea
              required
              rows={3}
              placeholder="Provide details about your leave application..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting}>
              Submit Application
            </Button>
          </div>
        </form>
      </Modal>

      <MobileNav role={userProfile?.role} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
