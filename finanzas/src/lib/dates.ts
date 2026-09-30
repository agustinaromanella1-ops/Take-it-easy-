import type { DateISO } from '../types';

/**
 * Fechas en hora LOCAL.
 *
 * `new Date("2026-03-10")` se interpreta como UTC y en Argentina da el día
 * anterior; por eso acá nunca se parsea un `YYYY-MM-DD` con el constructor.
 */

const DAY_MS = 86_400_000;

export const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const;

export function toISODate(d: Date): DateISO {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: DateISO): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function today(): DateISO {
  return toISODate(new Date());
}

export function isValidISODate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISODate(fromISODate(iso)) === iso;
}

export function addDays(iso: DateISO, days: number): DateISO {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Suma meses conservando el día, y si el mes no lo tiene usa el último:
 * el 31 de enero más un mes es el 28 (o 29) de febrero, no el 3 de marzo.
 */
export function addMonthsISO(iso: DateISO, meses: number): DateISO {
  const d = fromISODate(iso);
  const dia = d.getDate();
  const destino = new Date(d.getFullYear(), d.getMonth() + meses, 1);
  const ultimo = new Date(destino.getFullYear(), destino.getMonth() + 1, 0).getDate();
  destino.setDate(Math.min(dia, ultimo));
  return toISODate(destino);
}

/** La fecha con ese día del mes en el mes de `iso`, recortada al último día si no existe. */
export function conDia(iso: DateISO, dia: number): DateISO {
  const d = fromISODate(iso);
  const ultimo = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return toISODate(new Date(d.getFullYear(), d.getMonth(), Math.min(dia, ultimo)));
}

export function finDeMes(iso: DateISO): DateISO {
  const d = fromISODate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** Días completos entre dos fechas locales (b − a). */
export function daysBetween(a: DateISO, b: DateISO): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / DAY_MS);
}

/** "2026-10-03" → "viernes 3 de octubre". Mayúscula solo si la pone quien llama. */
export function formatDateLong(iso: DateISO): string {
  const d = fromISODate(iso);
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

/** "2026-10-03" → "3 de octubre". */
export function formatDateMedium(iso: DateISO): string {
  const d = fromISODate(iso);
  return `${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

/**
 * La distancia de tiempo, que es lo que se muestra grande: "hoy", "mañana",
 * "en 4 días", "hace 2 días".
 *
 * Una fecha obliga a hacer la cuenta ("¿qué día es hoy?"); la distancia ya
 * viene hecha.
 */
export function distancia(desde: DateISO, hasta: DateISO): string {
  const n = daysBetween(desde, hasta);
  if (n === 0) return 'hoy';
  if (n === 1) return 'mañana';
  if (n === -1) return 'ayer';
  if (n > 1) return `en ${n} días`;
  return `hace ${-n} días`;
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
