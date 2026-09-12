import type { DateISO, TimeHM } from '../types';

/**
 * Manejo de fechas en hora LOCAL.
 *
 * `new Date("2026-03-10")` se interpreta como UTC y puede correrse un día según
 * la zona horaria; por eso acá nunca se parsea un `YYYY-MM-DD` con el
 * constructor de Date directamente.
 */

const DAY_MS = 86_400_000;

export const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const;
export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

/** Date (local) -> "YYYY-MM-DD". */
export function toISODate(d: Date): DateISO {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" -> Date a medianoche LOCAL. */
export function fromISODate(iso: DateISO): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function today(): DateISO {
  return toISODate(new Date());
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = fromISODate(iso);
  return toISODate(d) === iso;
}

export function isValidTime(t: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(t);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

export function addDays(iso: DateISO, days: number): DateISO {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Lunes de la semana que contiene `iso`. La semana laboral arranca el lunes. */
export function startOfWeek(iso: DateISO): DateISO {
  const d = fromISODate(iso);
  const dow = d.getDay(); // 0 = domingo
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(iso, diff);
}

/** "YYYY-MM" del mes de esa fecha. */
export function monthKey(iso: DateISO): string {
  return iso.slice(0, 7);
}

export function addMonths(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y ?? 1970, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function formatMonthKey(key: string): string {
  const [y, m] = key.split('-').map(Number);
  return `${MONTH_NAMES[(m ?? 1) - 1] ?? ''} ${y ?? ''}`;
}

/** "2026-03-10" -> "mar 10 de marzo". */
export function formatDateLong(iso: DateISO): string {
  const d = fromISODate(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

/** "2026-03-10" -> "10/03". */
export function formatDateShort(iso: DateISO): string {
  const d = fromISODate(iso);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

/** Diferencia en días completos entre dos fechas locales (b - a). */
export function daysBetween(a: DateISO, b: DateISO): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / DAY_MS);
}

/** "HH:mm" -> minutos desde medianoche. Sirve para ordenar y comparar turnos. */
export function timeToMinutes(t: TimeHM): number {
  const [h, m] = t.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToTime(min: number): TimeHM {
  const wrapped = ((min % 1440) + 1440) % 1440;
  return `${Math.floor(wrapped / 60).toString().padStart(2, '0')}:${(wrapped % 60).toString().padStart(2, '0')}`;
}

/** True si dos intervalos del mismo día se pisan. Bordes que se tocan NO se pisan. */
export function overlaps(startA: number, durA: number, startB: number, durB: number): boolean {
  return startA < startB + durB && startB < startA + durA;
}

/** Cantidad de días del mes que contiene `iso`. */
export function daysInMonth(iso: DateISO): number {
  const d = fromISODate(iso);
  // Día 0 del mes siguiente = último día de este mes.
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** Primer día del mes de `iso`, como "YYYY-MM-DD". */
export function startOfMonth(iso: DateISO): DateISO {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * Celdas de una grilla mensual con la semana empezando en domingo, como el
 * calendario de papel. Las posiciones antes del día 1 vienen como `null`.
 */
export function monthGrid(iso: DateISO): (DateISO | null)[] {
  const first = startOfMonth(iso);
  const offset = fromISODate(first).getDay(); // 0 = domingo
  const total = daysInMonth(iso);
  const cells: (DateISO | null)[] = Array(offset).fill(null);
  for (let day = 1; day <= total; day++) {
    cells.push(`${iso.slice(0, 7)}-${day.toString().padStart(2, '0')}`);
  }
  return cells;
}
