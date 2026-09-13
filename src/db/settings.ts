import { getDb } from './index';
import { DEFAULT_QUIET_HOURS, type QuietHours } from '../domain/quietHours';

const QUIET_HOURS_KEY = 'quietHours';

async function read(key: string): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

async function write(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    [key, value],
  );
}

export async function loadQuietHours(): Promise<QuietHours> {
  const raw = await read(QUIET_HOURS_KEY);
  if (!raw) return DEFAULT_QUIET_HOURS;
  try {
    const parsed = JSON.parse(raw) as Partial<QuietHours>;
    return {
      enabled: parsed.enabled ?? DEFAULT_QUIET_HOURS.enabled,
      startHour: parsed.startHour ?? DEFAULT_QUIET_HOURS.startHour,
      endHour: parsed.endHour ?? DEFAULT_QUIET_HOURS.endHour,
    };
  } catch {
    // Preferencia corrupta: volvemos al default en vez de romper el arranque.
    return DEFAULT_QUIET_HOURS;
  }
}

export async function saveQuietHours(hours: QuietHours): Promise<void> {
  await write(QUIET_HOURS_KEY, JSON.stringify(hours));
}
