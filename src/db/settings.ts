import { getDb } from './index';
import { DEFAULT_QUIET_HOURS, type QuietHours } from '../domain/quietHours';
import type { DeliverySample } from '../domain/reliability';

const QUIET_HOURS_KEY = 'quietHours';
const ONBOARDING_KEY = 'onboardingCompleted';
const DELIVERY_SAMPLES_KEY = 'deliverySamples';

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

export async function loadOnboardingCompleted(): Promise<boolean> {
  return (await read(ONBOARDING_KEY)) === 'true';
}

export async function saveOnboardingCompleted(done: boolean): Promise<void> {
  await write(ONBOARDING_KEY, String(done));
}

export async function loadDeliverySamples(): Promise<DeliverySample[]> {
  const raw = await read(DELIVERY_SAMPLES_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DeliverySample[]) : [];
  } catch {
    return [];
  }
}

export async function saveDeliverySamples(
  samples: DeliverySample[],
): Promise<void> {
  await write(DELIVERY_SAMPLES_KEY, JSON.stringify(samples));
}
