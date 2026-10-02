'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Clock, Lock, Mail, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const isEnvUnconfigured = !supabaseUrl || supabaseUrl.includes('placeholder');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        // Fetch user profile to route appropriately
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();

        if (profile?.role === 'admin') {
          router.push('/admin/dashboard');
        } else {
          router.push('/dashboard');
        }
        router.refresh();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred during login.';
      setErrorMsg(message);
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/25">
            <Clock className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            PulseAttendance
          </h2>
          <p className="text-xs font-medium text-slate-500">
            Enterprise Employee Portal & Attendance Tracker
          </p>
        </div>

        {/* Configuration Warning Banner if Supabase Env is missing */}
        {isEnvUnconfigured && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900">
              <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600" />
              <span>Supabase Credentials Required</span>
            </div>
            <p>
              Set <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in{' '}
              <code className="font-bold">.env.local</code>. Run migrations in <code className="font-bold">supabase/migrations/001_initial_schema.sql</code>.
            </p>
          </div>
        )}

        {/* Login Form Card */}
        <Card className="p-6 sm:p-8 shadow-xl border-slate-200/90 bg-white">
          <form onSubmit={handleLogin} className="space-y-4">
            {errorMsg && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Input
              label="Email Address"
              type="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              leftIcon={<Mail className="w-4 h-4" />}
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              leftIcon={<Lock className="w-4 h-4" />}
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full font-semibold shadow-md shadow-blue-500/20 mt-2"
              isLoading={isLoading}
            >
              Sign In to Account
            </Button>
          </form>
        </Card>

        {/* Information & Feature footer */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-center space-y-2 text-xs text-slate-500 shadow-xs">
          <p className="font-semibold text-slate-700">Production Role Access Controls</p>
          <div className="flex items-center justify-center gap-4 text-[11px] text-slate-600">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> Employee Dashboard
            </span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> Admin Control
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
