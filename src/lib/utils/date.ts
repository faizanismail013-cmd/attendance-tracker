export function formatTime(timeString: string | null | undefined): string {
  if (!timeString) return '--:--';
  const date = new Date(timeString);
  if (isNaN(date.getTime())) return timeString;
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function getTodayISODate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function calculateWorkingHours(
  checkIn: string | null,
  checkOut: string | null
): { hours: number; minutes: number; formatted: string } {
  if (!checkIn) return { hours: 0, minutes: 0, formatted: '0h 0m' };

  const start = new Date(checkIn).getTime();
  const end = checkOut ? new Date(checkOut).getTime() : Date.now();

  if (isNaN(start) || isNaN(end) || end < start) {
    return { hours: 0, minutes: 0, formatted: '0h 0m' };
  }

  const diffMs = end - start;
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    hours,
    minutes,
    formatted: `${hours}h ${minutes}m`,
  };
}
