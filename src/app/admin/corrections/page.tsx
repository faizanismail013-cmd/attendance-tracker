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
import { FileCheck, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function AdminCorrectionsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCorrection, setSelectedCorrection] = useState<AttendanceCorrection | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

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

      if (profile?.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      setAdminUser(profile);

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

  const handleReviewCorrection = async (status: 'approved' | 'rejected') => {
    if (!selectedCorrection) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/attendance/corrections/${selectedCorrection.id}`, {
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
        title: `Correction Request ${status.toUpperCase()}`,
        description: `Correction for ${(selectedCorrection.employee || selectedCorrection.profiles)?.full_name || 'Employee'} updated.`,
      });

      setSelectedCorrection(null);
      setAdminNotes('');
      fetchCorrections();
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
          <LoadingState message="Loading attendance corrections..." />
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
              <FileCheck className="w-6 h-6 text-blue-600" /> Attendance Corrections
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Review employee time adjustment requests and update attendance logs
            </p>
          </div>

          <Card className="p-5">
            <CardHeader className="mb-4">
              <CardTitle className="text-base">Correction Requests</CardTitle>
              <CardDescription>Submitted time correction requests</CardDescription>
            </CardHeader>
            <CardContent>
              {corrections.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-xs text-slate-500">No correction requests found.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Req. Check In</th>
                        <th className="py-2.5 px-3">Req. Check Out</th>
                        <th className="py-2.5 px-3">Reason</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {corrections.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{(item.employee || item.profiles)?.full_name || 'Staff'}</p>
                            <p className="text-[10px] text-slate-400">{(item.employee || item.profiles)?.email}</p>
                          </td>
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
                          <td className="py-3 px-3">
                            {item.status === 'pending' ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedCorrection(item);
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
      {selectedCorrection && (
        <Modal
          isOpen={!!selectedCorrection}
          onClose={() => setSelectedCorrection(null)}
          title="Review Correction Request"
        >
          <div className="space-y-4 pt-2">
            <div className="bg-slate-100 p-3.5 rounded-xl border border-slate-200 text-xs text-slate-900 space-y-1.5 font-medium">
              <p><strong className="font-bold text-slate-900">Employee:</strong> <span className="text-slate-900">{(selectedCorrection.employee || selectedCorrection.profiles)?.full_name}</span></p>
              <p><strong className="font-bold text-slate-900">Req. Check In:</strong> <span className="text-slate-900">{selectedCorrection.requested_check_in ? `${formatDate(selectedCorrection.requested_check_in)} ${formatTime(selectedCorrection.requested_check_in)}` : 'N/A'}</span></p>
              <p><strong className="font-bold text-slate-900">Req. Check Out:</strong> <span className="text-slate-900">{selectedCorrection.requested_check_out ? `${formatDate(selectedCorrection.requested_check_out)} ${formatTime(selectedCorrection.requested_check_out)}` : 'N/A'}</span></p>
              <p><strong className="font-bold text-slate-900">Reason:</strong> <span className="text-slate-900">{selectedCorrection.reason}</span></p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1.5">
                Admin Notes (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Enter notes or reason for decision..."
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
                onClick={() => handleReviewCorrection('rejected')}
              >
                Reject Request
              </Button>
              <Button
                variant="success"
                size="sm"
                isLoading={isSubmitting}
                onClick={() => handleReviewCorrection('approved')}
              >
                Approve &amp; Update Record
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
