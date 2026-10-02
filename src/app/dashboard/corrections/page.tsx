'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { AttendanceCorrection, Profile } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/date';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { FileCheck, Plus, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function EmployeeCorrectionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [correctionDate, setCorrectionDate] = useState('');
  const [requestedCheckIn, setRequestedCheckIn] = useState('');
  const [requestedCheckOut, setRequestedCheckOut] = useState('');
  const [reason, setReason] = useState('');

  const fetchCorrections = async () => {
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

      const res = await fetch('/api/attendance/corrections');
      const data = await res.json();

      if (res.ok) {
        setCorrections(data.corrections || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCorrections();
  }, []);

  const handleSubmitCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionDate || (!requestedCheckIn && !requestedCheckOut) || !reason) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Validation Error',
        description: 'Please select a date, reason, and check-in or check-out time.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const formattedCheckIn = requestedCheckIn
        ? `${correctionDate}T${requestedCheckIn}:00.000Z`
        : null;
      const formattedCheckOut = requestedCheckOut
        ? `${correctionDate}T${requestedCheckOut}:00.000Z`
        : null;

      const res = await fetch('/api/attendance/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requested_check_in: formattedCheckIn,
          requested_check_out: formattedCheckOut,
          reason,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit correction request');
      }

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Request Submitted',
        description: 'Your attendance correction request was submitted to Admin.',
      });

      setIsModalOpen(false);
      setCorrectionDate('');
      setRequestedCheckIn('');
      setRequestedCheckOut('');
      setReason('');
      fetchCorrections();
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Submission Error',
        description: err instanceof Error ? err.message : 'Error submitting correction',
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
          <LoadingState message="Loading your attendance correction records..." />
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
                <FileCheck className="w-6 h-6 text-blue-600" /> Attendance Corrections
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Request corrections for missed check-ins, check-outs, or inaccurate logs
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              leftIcon={<Plus className="w-4 h-4" />}
              onClick={() => setIsModalOpen(true)}
              className="shadow-md shadow-blue-500/20"
            >
              New Correction Request
            </Button>
          </div>

          <Card className="p-5">
            <CardHeader className="mb-4">
              <CardTitle className="text-base">Correction Request History</CardTitle>
              <CardDescription>Status of past attendance adjustment requests</CardDescription>
            </CardHeader>
            <CardContent>
              {corrections.length === 0 ? (
                <div className="text-center py-10">
                  <FileCheck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No correction requests submitted yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Req. Check In</th>
                        <th className="py-2.5 px-3">Req. Check Out</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Admin Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {corrections.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {item.requested_check_in
                              ? `${formatDate(item.requested_check_in)} ${formatTime(item.requested_check_in)}`
                              : '--'}
                          </td>
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {item.requested_check_out
                              ? `${formatDate(item.requested_check_out)} ${formatTime(item.requested_check_out)}`
                              : '--'}
                          </td>
                          <td className="py-3 px-3 max-w-xs truncate">{item.reason}</td>
                          <td className="py-3 px-3">
                            <Badge
                              variant={
                                item.status === 'approved'
                                  ? 'success'
                                  : item.status === 'rejected'
                                  ? 'danger'
                                  : 'warning'
                              }
                              className="text-[10px] py-0.5 px-2 capitalize"
                            >
                              {item.status === 'approved' && <CheckCircle className="w-3 h-3 mr-1 inline" />}
                              {item.status === 'rejected' && <XCircle className="w-3 h-3 mr-1 inline" />}
                              {item.status === 'pending' && <Clock className="w-3 h-3 mr-1 inline" />}
                              {item.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 text-slate-500 italic">
                            {item.admin_notes || item.admin_comment || '--'}
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

      {/* Submit Correction Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Request Attendance Correction">
        <form onSubmit={handleSubmitCorrection} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Target Date</label>
            <input
              type="date"
              required
              value={correctionDate}
              onChange={(e) => setCorrectionDate(e.target.value)}
              className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correct Check-In Time</label>
              <input
                type="time"
                value={requestedCheckIn}
                onChange={(e) => setRequestedCheckIn(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Correct Check-Out Time</label>
              <input
                type="time"
                value={requestedCheckOut}
                onChange={(e) => setRequestedCheckOut(e.target.value)}
                className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Explanation</label>
            <textarea
              required
              rows={3}
              placeholder="e.g. Forgot to press check-out before leaving office / GPS signal issue"
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
              Submit Request
            </Button>
          </div>
        </form>
      </Modal>

      <MobileNav role={userProfile?.role} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
