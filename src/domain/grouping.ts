import { differenceInCalendarDays, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { ScheduledMessage } from './types';
import { wallNow, wallToUtc } from './time';

export interface DaySection {
  key: string;
  title: string;
  /** Los atrasados van arriba de todo y se muestran distinto. */
  overdue: boolean;
  data: ScheduledMessage[];
}

const capitalize = (s: string): string =>
  s.charAt(0).toUpperCase() + s.slice(1);

/** "Hoy", "Mañana", "Viernes 19", "Viernes 19 de diciembre". */
export function dayLabel(
  wall: string,
  timezone: string,
  now: Date = new Date(),
): string {
  const target = parseISO(wall);
  const today = wallNow(timezone, now);
  const diff = differenceInCalendarDays(target, today);

  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Mañana';
  if (diff === -1) return 'Ayer';
  if (diff > 1 && diff < 7) {
    return capitalize(format(target, "EEEE d", { locale: es }));
  }
  return capitalize(format(target, "EEEE d 'de' MMMM", { locale: es }));
}

export function timeLabel(wall: string): string {
  return format(parseISO(wall), 'HH:mm');
}

/**
 * Agrupa los pendientes por día, del más próximo al más lejano, con los
 * atrasados arriba de todo. Un mensaje queda atrasado cuando su hora ya pasó
 * y todavía no se confirmó (típicamente porque el teléfono estuvo apagado):
 * nunca lo escondemos ni lo descartamos en silencio.
 */
export function groupByDay(
  messages: ScheduledMessage[],
  timezone: string,
  now: Date = new Date(),
): DaySection[] {
  const withDate = messages.filter(
    (m): m is ScheduledMessage & { localAt: string } => m.localAt !== null,
  );

  const sorted = [...withDate].sort(
    (a, b) =>
      wallToUtc(a.localAt, a.timezone).getTime() -
      wallToUtc(b.localAt, b.timezone).getTime(),
  );

  const overdue: ScheduledMessage[] = [];
  const byDay = new Map<string, ScheduledMessage[]>();

  for (const m of sorted) {
    if (wallToUtc(m.localAt, m.timezone).getTime() <= now.getTime()) {
      overdue.push(m);
      continue;
    }
    const dayKey = m.localAt.slice(0, 10);
    const bucket = byDay.get(dayKey);
    if (bucket) bucket.push(m);
    else byDay.set(dayKey, [m]);
  }

  const sections: DaySection[] = [];
  if (overdue.length > 0) {
    sections.push({
      key: 'overdue',
      title: overdue.length === 1 ? 'Atrasado' : 'Atrasados',
      overdue: true,
      data: overdue,
    });
  }

  for (const [dayKey, data] of byDay) {
    const first = data[0];
    if (!first?.localAt) continue;
    sections.push({
      key: dayKey,
      title: dayLabel(first.localAt, timezone, now),
      overdue: false,
      data,
    });
  }

  return sections;
}

export function pendingCountLabel(count: number): string {
  if (count === 0) return 'Nada programado';
  if (count === 1) return '1 mensaje programado';
  return `${count} mensajes programados`;
}

/** Las primeras dos líneas del texto, para la tarjeta de la lista. */
export function previewLines(body: string): string {
  return body
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .slice(0, 2)
    .join('\n');
}
