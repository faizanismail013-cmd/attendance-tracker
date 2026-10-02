'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';
import { UserRole } from '@/types';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Settings,
  Clock,
  Calendar,
  FileCheck,
  FileSpreadsheet,
  ShieldAlert,
  User,
} from 'lucide-react';

interface MobileNavProps {
  role?: UserRole;
}

export const MobileNav: React.FC<MobileNavProps> = ({ role = 'employee' }) => {
  const pathname = usePathname();

  const adminLinks = [
    {
      name: 'Overview',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Attendance',
      href: '/admin/attendance',
      icon: CalendarCheck,
    },
    {
      name: 'Leaves',
      href: '/admin/leaves',
      icon: Calendar,
    },
    {
      name: 'Corrections',
      href: '/admin/corrections',
      icon: FileCheck,
    },
    {
      name: 'Reports',
      href: '/admin/reports',
      icon: FileSpreadsheet,
    },
    {
      name: 'Audit',
      href: '/admin/audit-logs',
      icon: ShieldAlert,
    },
    {
      name: 'Settings',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  const employeeLinks = [
    {
      name: 'Check In/Out',
      href: '/dashboard',
      icon: Clock,
    },
    {
      name: 'Leaves',
      href: '/dashboard/leaves',
      icon: Calendar,
    },
    {
      name: 'Corrections',
      href: '/dashboard/corrections',
      icon: FileCheck,
    },
    {
      name: 'Profile',
      href: '/dashboard/profile',
      icon: User,
    },
  ];

  const links = role === 'admin' ? adminLinks : employeeLinks;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden border-t border-slate-200 bg-white/95 backdrop-blur-md px-2 py-1.5 overflow-x-auto">
      <div className="flex items-center justify-around min-w-full">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[10px] font-medium transition-all duration-150 shrink-0',
                isActive
                  ? 'text-blue-600 font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              )}
            >
              <div
                className={cn(
                  'p-1 rounded-lg transition-colors',
                  isActive ? 'bg-blue-50 text-blue-600' : 'text-slate-500'
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <span className="whitespace-nowrap">{link.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
