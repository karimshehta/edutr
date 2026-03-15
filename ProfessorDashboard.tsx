export function calculateDistance(
  lat1: number, lon1: number, lat2: number, lon2: number
): number {
  const R = 6371e3;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours, 10);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${minutes} ${ampm}`;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getDayName(d: number): string { return DAY_NAMES[d] || ''; }
export function getDayShortName(d: number): string { return DAY_SHORT[d] || ''; }

export function getGradeColor(score: number, maxScore: number | null): string {
  if (!maxScore || maxScore === 0) return '#64748B';
  const pct = (score / maxScore) * 100;
  if (pct >= 75) return '#10B981';
  if (pct >= 50) return '#F59E0B';
  return '#EF4444';
}

/** "Wed, Mar 11" */
export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${DAY_SHORT[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** "Mar 7, 2025" */
export function formatDateWithYear(dateStr: string): string {
  const d = new Date(dateStr);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** "Mar 7" */
export function formatShortDate(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Wed, Mar 7" */
export function formatFullDate(date: Date): string {
  return `${DAY_SHORT[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Wednesday, Mar 7, 2026" */
export function formatScheduleDate(date: Date): string {
  return `${DAY_NAMES[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(dateStr);
}

export function getInitials(firstName: string | null, lastName: string | null): string {
  return (firstName?.charAt(0)?.toUpperCase() || '') + (lastName?.charAt(0)?.toUpperCase() || '') || '?';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getNextOccurrence(dayOfWeek: number): Date {
  const today = new Date();
  let diff = dayOfWeek - today.getDay();
  if (diff < 0) diff += 7;
  const next = new Date(today);
  next.setDate(today.getDate() + diff);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function formatLectureDate(date: Date): string {
  return formatFullDate(date);
}

export function isToday(date: Date): boolean {
  const t = new Date();
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}

export function isTomorrow(date: Date): boolean {
  const t = new Date();
  t.setDate(t.getDate() + 1);
  return date.getDate() === t.getDate() && date.getMonth() === t.getMonth() && date.getFullYear() === t.getFullYear();
}

/** Get days ordered starting from today */
export function getOrderedWeekDays(): { dayOfWeek: number; date: Date; isToday: boolean }[] {
  const today = new Date();
  const cur = today.getDay();
  const days: { dayOfWeek: number; date: Date; isToday: boolean }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    d.setHours(0, 0, 0, 0);
    days.push({ dayOfWeek: (cur + i) % 7, date: d, isToday: i === 0 });
  }
  return days;
}
