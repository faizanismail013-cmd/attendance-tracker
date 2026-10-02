'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/date';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/LoadingState';
import { ShieldAlert, User, Clock, FileText } from 'lucide-react';

interface AuditLogItem {
  id: string;
  actor_user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: any;
  created_at: string;
  actor?: {
    full_name: string;
    email: string;
    role: string;
  } | null;
}

export default function AdminAuditLogsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAuditLogs = async () => {
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

      const res = await fetch('/api/admin/audit-logs');
      const data = await res.json();
      if (res.ok) {
        setLogs(data.auditLogs || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading system audit logs..." />
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
              <ShieldAlert className="w-6 h-6 text-blue-600" /> System Audit Trail
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Security log of administrative actions, policy edits, and status changes
            </p>
          </div>

          <Card className="p-5">
            <CardHeader className="mb-4">
              <CardTitle className="text-base">Audit Trail</CardTitle>
              <CardDescription>Most recent system actions recorded for compliance</CardDescription>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <div className="text-center py-10">
                  <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">No audit logs recorded yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Actor</th>
                        <th className="py-2.5 px-3">Action</th>
                        <th className="py-2.5 px-3">Target Entity</th>
                        <th className="py-2.5 px-3">Metadata</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-mono text-slate-700 whitespace-nowrap">
                            <Clock className="w-3 h-3 text-slate-400 inline mr-1" />
                            {formatDate(log.created_at)} {formatTime(log.created_at)}
                          </td>
                          <td className="py-3 px-3">
                            <p className="font-bold text-slate-900">{log.actor?.full_name || 'System / Admin'}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{log.actor?.email}</p>
                          </td>
                          <td className="py-3 px-3">
                            <Badge variant="purple" className="font-mono text-[10px] py-0.5 px-2">
                              {log.action}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 font-medium capitalize text-slate-800">
                            {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ''}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-slate-500 max-w-xs truncate">
                            {log.metadata ? JSON.stringify(log.metadata) : '--'}
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

      <MobileNav role="admin" />
    </div>
  );
}
