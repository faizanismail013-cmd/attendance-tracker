'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  LogOut,
  Clock,
  Shield,
  User,
} from 'lucide-react';

interface NavbarProps {
  user: Profile | null;
}

export const Navbar: React.FC<NavbarProps> = ({ user }) => {
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <header className="sticky top-0 z-40 w-full max-w-full overflow-hidden border-b border-slate-200 bg-white/95 backdrop-blur-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-3 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <Link href={isAdmin ? '/admin/dashboard' : '/dashboard'} className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/20">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-bold text-slate-900 tracking-tight block truncate">
              PPR Attendance Tracker
            </span>
            <span className="block text-[9px] sm:text-[10px] font-semibold text-blue-600 uppercase tracking-wider truncate">
              Field &amp; Office Portal
            </span>
          </div>
        </Link>

        {/* User Info & Actions */}
        {user && (
          <div className="flex items-center gap-3">
            <Link
              href={isAdmin ? '/admin/dashboard' : '/dashboard/profile'}
              className="hidden sm:flex items-center gap-2.5 pl-3 pr-2 py-1 rounded-full bg-slate-50 border border-slate-200/80 hover:bg-slate-100 transition-colors"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-bold">
                {user.full_name?.charAt(0) || 'U'}
              </div>
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-semibold text-slate-800 leading-none">
                    {user.full_name}
                  </p>
                  <Badge variant={user.role === 'admin' ? 'purple' : 'info'} className="text-[10px] py-0 px-1.5">
                    {user.role === 'admin' ? (
                      <span className="flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5" /> Admin
                      </span>
                    ) : (
                      <span className="flex items-center gap-0.5">
                        <User className="w-2.5 h-2.5" /> Staff
                      </span>
                    )}
                  </Badge>
                </div>
                <p className="text-[10px] text-slate-500 mt-0.5">{user.email}</p>
              </div>
            </Link>

            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              className="text-xs font-medium text-slate-600 hover:text-rose-600 hover:border-rose-200"
            >
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
};
