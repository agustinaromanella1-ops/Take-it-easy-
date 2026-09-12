import type { DateISO } from '../types';
import { addDays, fromISODate, toISODate } from './dates';

export type Repeat = 'ninguna' | 'semanal' | 'quincenal' | 'mensual';

export const REPEAT_LABEL: Record<Repeat, string> = {
  ninguna: 'No repetir',
  semanal: 'Cada semana',
  quincenal: 'Cada 15 días',
  mensual: 'Cada mes',
};

/** Tope de sesiones que se pueden crear de una vez. Un error de tipeo no debe
 *  llenar la agenda de dos años. */
export const MAX_OCCURRENCES = 52;

/**
 * Fechas de una serie de turnos, empezando por `start` (siempre incluida).
 *
 * En la repetición mensual se conserva el día del mes y se acota al último día
 * disponible cuando ese día no existe: un turno del 31 de enero cae el 28 de
 * febrero, pero el siguiente vuelve al 31 de marzo. Avanzar sumando meses sobre
 * la fecha ya recortada arrastraría el error y terminaría corriendo la serie
 * al día 28 para siempre.
 */
export function occurrences(start: DateISO, repeat: Repeat, count: number): DateISO[] {
  const total = Math.min(Math.max(1, Math.trunc(count)), MAX_OCCURRENCES);
  if (repeat === 'ninguna') return [start];

  if (repeat === 'semanal' || repeat === 'quincenal') {
    const step = repeat === 'semanal' ? 7 : 14;
    const dates: DateISO[] = [];
    for (let i = 0; i < total; i++) dates.push(addDays(start, i * step));
    return dates;
  }

  const origin = fromISODate(start);
  const day = origin.getDate();
  const dates: DateISO[] = [];
  for (let i = 0; i < total; i++) {
    // Día 0 del mes siguiente = último día del mes buscado.
    const lastDay = new Date(origin.getFullYear(), origin.getMonth() + i + 1, 0).getDate();
    dates.push(toISODate(new Date(origin.getFullYear(), origin.getMonth() + i, Math.min(day, lastDay))));
  }
  return dates;
}
