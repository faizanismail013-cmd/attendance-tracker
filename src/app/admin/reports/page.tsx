'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, MonthlyReport } from '@/types';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { FileSpreadsheet, Download, Filter, Users, Calendar } from 'lucide-react';

export default function AdminReportsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [reportData, setReportData] = useState<MonthlyReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const fetchReport = async () => {
    setIsLoading(true);
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

      const res = await fetch(`/api/admin/reports/monthly?month=${selectedMonth}&year=${selectedYear}`);
      const data = await res.json();

      if (res.ok) {
        setReportData(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [selectedMonth, selectedYear]);

  const handleExportCSV = () => {
    if (!reportData) return;
    const exportUrl = `/api/admin/reports/export-csv?startDate=${reportData.startDate}&endDate=${reportData.endDate}`;
    window.open(exportUrl, '_blank');
  };

  const monthsList = [
    { value: 1, name: 'January' },
    { value: 2, name: 'February' },
    { value: 3, name: 'March' },
    { value: 4, name: 'April' },
    { value: 5, name: 'May' },
    { value: 6, name: 'June' },
    { value: 7, name: 'July' },
    { value: 8, name: 'August' },
    { value: 9, name: 'September' },
    { value: 10, name: 'October' },
    { value: 11, name: 'November' },
    { value: 12, name: 'December' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 lg:pb-0">
      <Navbar user={adminUser} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar role="admin" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                <FileSpreadsheet className="w-6 h-6 text-blue-600" /> Monthly Reports &amp; CSV Export
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Aggregated monthly employee attendance, working hours, and CSV export
              </p>
            </div>

            <Button
              variant="primary"
              size="md"
              leftIcon={<Download className="w-4 h-4" />}
              onClick={handleExportCSV}
              className="shadow-md shadow-blue-500/20"
            >
              Export CSV Report
            </Button>
          </div>

          {/* Month / Year Filters */}
          <Card className="p-4 bg-white border-slate-200">
            <div className="flex flex-wrap items-center gap-4 text-xs">
              <span className="font-bold text-slate-700 flex items-center gap-1">
                <Filter className="w-4 h-4 text-blue-600" /> Select Reporting Period:
              </span>

              <div className="flex items-center gap-2">
                <label className="text-slate-500">Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                >
                  {monthsList.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-slate-500">Year:</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 font-semibold text-slate-800"
                >
                  {[2024, 2025, 2026, 2027].map((yr) => (
                    <option key={yr} value={yr}>
                      {yr}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {isLoading ? (
            <LoadingState message="Calculating monthly attendance summaries..." />
          ) : (
            <Card className="p-5">
              <CardHeader className="mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-600" />
                  Monthly Summary ({monthsList.find((m) => m.value === selectedMonth)?.name} {selectedYear})
                </CardTitle>
                <CardDescription>
                  Period: {reportData?.startDate} to {reportData?.endDate}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!reportData || reportData.summaries.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-xs text-slate-500">No attendance data found for selected month.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 border-b text-slate-500 font-semibold uppercase">
                        <tr>
                          <th className="py-2.5 px-3">Employee</th>
                          <th className="py-2.5 px-3">Department</th>
                          <th className="py-2.5 px-3">Days Present</th>
                          <th className="py-2.5 px-3">Late Days</th>
                          <th className="py-2.5 px-3">Office Days</th>
                          <th className="py-2.5 px-3">Field Days</th>
                          <th className="py-2.5 px-3">WFH Days</th>
                          <th className="py-2.5 px-3">Leave Days</th>
                          <th className="py-2.5 px-3">Work Hours</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportData.summaries.map((s) => (
                          <tr key={s.employee.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-3">
                              <p className="font-bold text-slate-900">{s.employee.full_name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">{s.employee.email}</p>
                            </td>
                            <td className="py-3 px-3 font-medium text-slate-700">{s.employee.department || 'General'}</td>
                            <td className="py-3 px-3 font-bold text-emerald-700">{s.total_present}</td>
                            <td className="py-3 px-3 font-bold text-amber-600">{s.late_days}</td>
                            <td className="py-3 px-3">{s.office_days}</td>
                            <td className="py-3 px-3">{s.field_days}</td>
                            <td className="py-3 px-3">{s.wfh_days}</td>
                            <td className="py-3 px-3 font-semibold text-rose-600">{s.leave_days}</td>
                            <td className="py-3 px-3 font-mono font-bold text-blue-700">{s.total_work_hours} hrs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </main>
      </div>

      <MobileNav role="admin" />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
