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

interface SidebarProps {
  role?: UserRole;
}

export const Sidebar: React.FC<SidebarProps> = ({ role = 'employee' }) => {
  const pathname = usePathname();

  const adminLinks = [
    {
      name: 'Overview',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      name: 'Attendance Records',
      href: '/admin/attendance',
      icon: CalendarCheck,
    },
    {
      name: 'Leave Requests',
      href: '/admin/leaves',
      icon: Calendar,
    },
    {
      name: 'Corrections',
      href: '/admin/corrections',
      icon: FileCheck,
    },
    {
      name: 'Reports & CSV',
      href: '/admin/reports',
      icon: FileSpreadsheet,
    },
    {
      name: 'Employees',
      href: '/admin/employees',
      icon: Users,
    },
    {
      name: 'Audit Logs',
      href: '/admin/audit-logs',
      icon: ShieldAlert,
    },
    {
      name: 'Office Settings',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  const employeeLinks = [
    {
      name: 'Check In / Out',
      href: '/dashboard',
      icon: Clock,
    },
    {
      name: 'My Leaves',
      href: '/dashboard/leaves',
      icon: Calendar,
    },
    {
      name: 'Corrections',
      href: '/dashboard/corrections',
      icon: FileCheck,
    },
    {
      name: 'My Profile',
      href: '/dashboard/profile',
      icon: User,
    },
  ];

  const links = role === 'admin' ? adminLinks : employeeLinks;

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:inset-y-0 border-r border-slate-200 bg-slate-50/50 p-4">
      <div className="mb-6 px-3">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Navigation Menu
        </p>
      </div>
      <nav className="space-y-1.5">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                  : 'text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
              )}
            >
              <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-500')} />
              <span>{link.name}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};
