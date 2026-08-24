export interface PostEntry {
  date: string;
  content: string;
  niche?: string;
  source?: string;
}

export interface CalendarEntry {
  id: string;
  user_id: string;
  niche: string;
  start_date: string;
  posts: PostEntry[];
  created_at: string;
  frozen?: boolean;
}

const STORAGE_KEY_PREFIX = "dailygap_local_cals_";

function getStorageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId.toLowerCase().trim()}`;
}

export function getLocalCalendars(userId: string): CalendarEntry[] {
  if (!userId) return [];
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read local calendars:", e);
    return [];
  }
}

export function saveLocalCalendar(
  userId: string,
  entry: { niche: string; start_date: string; posts: PostEntry[] }
): CalendarEntry {
  const calendars = getLocalCalendars(userId);
  const newCalendar: CalendarEntry = {
    id: `local_cal_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    user_id: userId,
    niche: entry.niche,
    start_date: entry.start_date,
    posts: entry.posts,
    created_at: new Date().toISOString(),
    frozen: false,
  };
  
  calendars.unshift(newCalendar);
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(calendars));
    window.dispatchEvent(new Event("dailygap_data_changed"));
  } catch (e) {
    console.warn("Failed to save local calendar:", e);
  }
  return newCalendar;
}

export function updateLocalCalendar(
  userId: string,
  calendarId: string,
  updates: Partial<CalendarEntry>
): void {
  const calendars = getLocalCalendars(userId);
  const updated = calendars.map((cal) => {
    if (cal.id === calendarId) {
      return { ...cal, ...updates };
    }
    return cal;
  });
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(updated));
    window.dispatchEvent(new Event("dailygap_data_changed"));
  } catch (e) {
    console.warn("Failed to update local calendar:", e);
  }
}

export function deleteLocalCalendar(userId: string, calendarId: string): void {
  const calendars = getLocalCalendars(userId);
  const filtered = calendars.filter((cal) => cal.id !== calendarId);
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(filtered));
    window.dispatchEvent(new Event("dailygap_data_changed"));
  } catch (e) {
    console.warn("Failed to delete local calendar:", e);
  }
}

export function clearLocalCalendars(userId: string): void {
  try {
    localStorage.removeItem(getStorageKey(userId));
    window.dispatchEvent(new Event("dailygap_data_changed"));
  } catch (e) {
    console.warn("Failed to clear local calendars:", e);
  }
}
