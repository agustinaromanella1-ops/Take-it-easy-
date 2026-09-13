import { addDays, addMonths, addWeeks, addYears, format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { toWallString, wallNow, type WallClock } from './time';

export type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';

export const FREQUENCIES: Frequency[] = [
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'YEARLY',
];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  DAILY: 'Todos los días',
  WEEKLY: 'Cada semana',
  MONTHLY: 'Cada mes',
  YEARLY: 'Cada año',
};

/**
 * Guardamos la regla como un subconjunto mínimo de RRULE ("FREQ=WEEKLY").
 * Alcanza para lo que la app ofrece y deja la puerta abierta a leer reglas
 * más completas más adelante sin migrar los datos.
 */
export function formatRule(frequency: Frequency): string {
  return `FREQ=${frequency}`;
}

export function parseRule(rule: string | null): Frequency | null {
  if (!rule) return null;
  const match = /FREQ=([A-Z]+)/.exec(rule);
  const value = match?.[1];
  return value && (FREQUENCIES as string[]).includes(value)
    ? (value as Frequency)
    : null;
}

const advance = (date: Date, frequency: Frequency): Date => {
  switch (frequency) {
    case 'DAILY':
      return addDays(date, 1);
    case 'WEEKLY':
      return addWeeks(date, 1);
    case 'MONTHLY':
      return addMonths(date, 1);
    case 'YEARLY':
      return addYears(date, 1);
  }
};

/**
 * Próxima repetición estrictamente posterior a `after`. Avanza de a un período
 * hasta pasarlo, así un teléfono que estuvo días apagado no arrastra una cola
 * de repeticiones vencidas: se retoma en la siguiente que corresponde.
 *
 * En las mensuales, date-fns recorta al último día del mes: un mensaje del 31
 * cae el 28/29 en febrero y vuelve al 31 en marzo.
 */
export function nextOccurrence(
  wall: WallClock,
  rule: string | null,
  timezone: string,
  now: Date = new Date(),
): WallClock | null {
  const frequency = parseRule(rule);
  if (!frequency) return null;

  const limit = wallNow(timezone, now);
  let candidate = advance(parseISO(wall), frequency);

  // Cota defensiva: un año de saltos diarios es más que suficiente para
  // reencauzar cualquier atraso razonable.
  for (let i = 0; i < 400 && candidate.getTime() <= limit.getTime(); i += 1) {
    candidate = advance(candidate, frequency);
  }

  return toWallString(candidate);
}

/** "Cada semana, los lunes a las 09:00". */
export function describeRule(
  rule: string | null,
  wall: WallClock | null,
): string | null {
  const frequency = parseRule(rule);
  if (!frequency) return null;
  if (!wall) return FREQUENCY_LABELS[frequency];

  const date = parseISO(wall);
  const time = format(date, 'HH:mm');

  switch (frequency) {
    case 'DAILY':
      return `Todos los días a las ${time}`;
    case 'WEEKLY':
      return `Todos los ${format(date, 'EEEE', { locale: es })} a las ${time}`;
    case 'MONTHLY':
      return `El ${format(date, 'd')} de cada mes a las ${time}`;
    case 'YEARLY':
      return `Cada ${format(date, "d 'de' MMMM", { locale: es })} a las ${time}`;
  }
}
