'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { formatDate } from '@/lib/utils/date';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { User, Mail, Phone, Building, Hash, Calendar, ShieldCheck, Save } from 'lucide-react';

export default function EmployeeProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchProfile = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      const res = await fetch('/api/profile');
      const data = await res.json();

      if (res.ok && data.profile) {
        setProfile(data.profile);
        setFullName(data.profile.full_name || '');
        setPhone(data.profile.phone || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          phone,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update profile');

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Profile Saved',
        description: 'Your profile information has been updated.',
      });

      setProfile(data.profile);
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Update Error',
        description: err instanceof Error ? err.message : 'Error updating profile',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={profile} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading your profile details..." />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-20 lg:pb-0">
      <Navbar user={profile} />

      <div className="flex flex-1 max-w-7xl w-full mx-auto">
        <Sidebar role={profile?.role} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <User className="w-6 h-6 text-blue-600" /> Employee Profile
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              View your account credentials, employment data, and contact information
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Identity Card */}
            <Card className="p-6 md:col-span-1 text-center bg-white border-slate-200">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 mb-4">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>

              <h2 className="text-lg font-bold text-slate-900">{profile?.full_name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{profile?.email}</p>

              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge variant={profile?.role === 'admin' ? 'purple' : 'info'} className="capitalize py-0.5 px-2.5">
                  <ShieldCheck className="w-3 h-3 mr-1 inline" /> {profile?.role}
                </Badge>
                <Badge variant={profile?.status === 'active' ? 'success' : 'danger'} className="capitalize py-0.5 px-2.5">
                  {profile?.status}
                </Badge>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-left space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium"><Hash className="w-3.5 h-3.5 text-blue-600" /> Employee ID:</span>
                  <span className="font-mono font-bold text-slate-900">{profile?.employee_code || '--'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium"><Building className="w-3.5 h-3.5 text-blue-600" /> Department:</span>
                  <span className="font-bold text-slate-900">{profile?.department || 'General'}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5 font-medium"><Calendar className="w-3.5 h-3.5 text-blue-600" /> Joining Date:</span>
                  <span className="font-medium text-slate-900">{profile?.joining_date ? formatDate(profile.joining_date) : 'N/A'}</span>
                </div>
              </div>
            </Card>

            {/* Editable Details Form */}
            <Card className="p-6 md:col-span-2 bg-white border-slate-200">
              <CardHeader className="mb-4">
                <CardTitle className="text-base">Personal Details</CardTitle>
                <CardDescription>Update your contact phone and display name</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" /> Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address (Read-only)
                    </label>
                    <input
                      type="email"
                      disabled
                      value={profile?.email || ''}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 cursor-not-allowed font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-slate-400" /> Phone Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +91 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm text-slate-900 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  </div>

                  <div className="pt-2 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      isLoading={isSaving}
                      leftIcon={<Save className="w-4 h-4" />}
                      className="shadow-md shadow-blue-500/20"
                    >
                      Save Profile Updates
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      <MobileNav role={profile?.role} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
