'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Profile, OfficeSettings } from '@/types';
import { getCurrentPosition, getGoogleMapsUrl } from '@/lib/utils/geo';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';
import { MobileNav } from '@/components/navigation/MobileNav';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast, ToastMessage } from '@/components/ui/Toast';
import { LoadingState } from '@/components/ui/LoadingState';
import { Settings, MapPin, Save, ExternalLink, Navigation } from 'lucide-react';

export default function AdminSettingsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [adminUser, setAdminUser] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGettingGps, setIsGettingGps] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [officeLat, setOfficeLat] = useState('28.6139');
  const [officeLng, setOfficeLng] = useState('77.2090');
  const [radiusMeters, setRadiusMeters] = useState('100');
  const [geofenceEnabled, setGeofenceEnabled] = useState(true);
  const [wfhAllowed, setWfhAllowed] = useState(true);
  const [workingStartTime, setWorkingStartTime] = useState('09:00');
  const [workingEndTime, setWorkingEndTime] = useState('18:00');
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState('15');

  const fetchSettings = async () => {
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

      const res = await fetch('/api/admin/settings');
      const data = await res.json();

      if (res.ok && data.settings) {
        const s = data.settings;
        setOfficeLat((s.office_latitude ?? s.latitude ?? 28.6139).toString());
        setOfficeLng((s.office_longitude ?? s.longitude ?? 77.2090).toString());
        setRadiusMeters((s.radius_meters ?? s.allowed_radius_meters ?? 100).toString());
        setGeofenceEnabled(Boolean(s.geofence_enabled ?? true));
        setWfhAllowed(Boolean(s.wfh_allowed ?? true));
        setWorkingStartTime(s.working_start_time || '09:00');
        setWorkingEndTime(s.working_end_time || '18:00');
        setGracePeriodMinutes((s.grace_period_minutes || 15).toString());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleFetchCurrentLocation = async () => {
    setIsGettingGps(true);
    const geo = await getCurrentPosition();
    setIsGettingGps(false);

    if (geo.result) {
      setOfficeLat(geo.result.latitude.toFixed(6));
      setOfficeLng(geo.result.longitude.toFixed(6));
      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Coordinates Updated',
        description: 'Captured current GPS coordinates for office location.',
      });
    } else {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'GPS Error',
        description: geo.error?.message || 'Could not acquire GPS position.',
      });
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          office_latitude: officeLat,
          office_longitude: officeLng,
          radius_meters: radiusMeters,
          geofence_enabled: geofenceEnabled,
          wfh_allowed: wfhAllowed,
          working_start_time: workingStartTime,
          working_end_time: workingEndTime,
          grace_period_minutes: gracePeriodMinutes,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save settings');

      setToast({
        id: Date.now().toString(),
        type: 'success',
        title: 'Settings Saved',
        description: 'Office geofence & working schedule settings updated successfully.',
      });
    } catch (err) {
      setToast({
        id: Date.now().toString(),
        type: 'error',
        title: 'Save Error',
        description: err instanceof Error ? err.message : 'Failed to save office settings',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Navbar user={adminUser} />
        <div className="flex-1 flex items-center justify-center p-6">
          <LoadingState message="Loading office settings..." />
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
              <Settings className="w-6 h-6 text-blue-600" /> Office Geofencing &amp; Shift Settings
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Configure office GPS coordinates, geofence radius, working hours, and WFH policy
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            {/* Geofence Card */}
            <Card className="p-6">
              <CardHeader className="mb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-blue-600" /> Office GPS &amp; Geofencing
                </CardTitle>
                <CardDescription>
                  Enforce physical proximity checks during office check-in
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Enable GPS Geofencing</span>
                    <p className="text-[11px] text-slate-500">
                      Reject office check-ins outside the designated radius
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={geofenceEnabled}
                    onChange={(e) => setGeofenceEnabled(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Office Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={officeLat}
                      onChange={(e) => setOfficeLat(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Office Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={officeLng}
                      onChange={(e) => setOfficeLng(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Allowed Radius (Meters)
                    </label>
                    <input
                      type="number"
                      required
                      value={radiusMeters}
                      onChange={(e) => setRadiusMeters(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Default: 100 meters</p>
                  </div>

                  <div className="flex flex-col justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={isGettingGps}
                      leftIcon={<Navigation className="w-3.5 h-3.5" />}
                      onClick={handleFetchCurrentLocation}
                    >
                      Use My Current GPS Position
                    </Button>
                  </div>
                </div>

                {officeLat && officeLng && (
                  <div className="pt-2">
                    <a
                      href={getGoogleMapsUrl(parseFloat(officeLat), parseFloat(officeLng))}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 font-semibold"
                    >
                      View Office Location on Google Maps <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Policy & Shift Hours Card */}
            <Card className="p-6">
              <CardHeader className="mb-4">
                <CardTitle className="text-base">Working Hours &amp; Policies</CardTitle>
                <CardDescription>Shift start/end times and remote work permissions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div>
                    <span className="text-xs font-bold text-slate-800">Allow Work From Home (WFH)</span>
                    <p className="text-[11px] text-slate-500">
                      Permit employees to choose WFH as attendance type
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={wfhAllowed}
                    onChange={(e) => setWfhAllowed(e.target.checked)}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Working Start Time
                    </label>
                    <input
                      type="time"
                      required
                      value={workingStartTime}
                      onChange={(e) => setWorkingStartTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Working End Time
                    </label>
                    <input
                      type="time"
                      required
                      value={workingEndTime}
                      onChange={(e) => setWorkingEndTime(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Grace Period (Minutes)
                    </label>
                    <input
                      type="number"
                      required
                      value={gracePeriodMinutes}
                      onChange={(e) => setGracePeriodMinutes(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Check-ins after grace period are marked Late</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button
                type="submit"
                variant="primary"
                size="lg"
                isLoading={isSaving}
                leftIcon={<Save className="w-4 h-4" />}
                className="shadow-lg shadow-blue-500/20"
              >
                Save Office Settings
              </Button>
            </div>
          </form>
        </main>
      </div>

      <MobileNav role="admin" />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
