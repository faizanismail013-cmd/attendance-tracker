/**
 * Haversine formula to calculate distance between two GPS coordinates.
 * Returns distance in meters.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate a Google Maps URL from coordinates.
 */
export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

/**
 * Format distance in meters to a human-readable string.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} meters`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

export interface GeolocationResult {
  latitude: number;
  longitude: number;
  accuracy: number;
}

export interface GeolocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'NOT_SUPPORTED';
  message: string;
}

/**
 * Get current position with enhanced error handling.
 * Returns either a result or an error — never throws.
 */
export function getCurrentPosition(): Promise<{ result?: GeolocationResult; error?: GeolocationError }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        error: {
          code: 'NOT_SUPPORTED',
          message: 'Geolocation is not supported by your browser. Please use a modern browser with GPS capability.',
        },
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          result: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          },
        });
      },
      (err) => {
        let code: GeolocationError['code'] = 'POSITION_UNAVAILABLE';
        let message = 'Unable to determine your location.';

        switch (err.code) {
          case err.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED';
            message = 'Location permission denied. Please enable location access in your browser settings and try again.';
            break;
          case err.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE';
            message = 'Your location is currently unavailable. Please ensure GPS is enabled and try again.';
            break;
          case err.TIMEOUT:
            code = 'TIMEOUT';
            message = 'Location request timed out. Please move to an area with better signal and try again.';
            break;
        }

        resolve({ error: { code, message } });
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  });
}
