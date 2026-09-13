import { addDays, parseISO, setHours, setMinutes, setSeconds } from 'date-fns';
import { toWallString, type WallClock } from './time';

/**
 * Franja en la que sí está bien que salga un mensaje. Fuera de ella no
 * bloqueamos nada: corremos la propuesta a la próxima hora válida y lo decimos,
 * porque mandar un mensaje de trabajo a las 2 de la mañana es justamente lo que
 * la app intenta evitar.
 */
export interface QuietHours {
  enabled: boolean;
  /** Hora a partir de la cual se puede mandar, 0-23. */
  startHour: number;
  /** Hora a partir de la cual ya no, 0-23. Exclusiva. */
  endHour: number;
}

export const DEFAULT_QUIET_HOURS: QuietHours = {
  enabled: false,
  startHour: 9,
  endHour: 21,
};

export function isWithinAllowed(wall: WallClock, hours: QuietHours): boolean {
  if (!hours.enabled) return true;
  const hour = parseISO(wall).getHours();
  return hour >= hours.startHour && hour < hours.endHour;
}

/**
 * Devuelve el momento tal cual si ya es válido, o el comienzo de la próxima
 * franja permitida. Antes de la franja: ese mismo día. Después: al día siguiente.
 */
export function nextAllowed(
  wall: WallClock,
  hours: QuietHours,
): WallClock {
  if (isWithinAllowed(wall, hours)) return wall;

  const date = parseISO(wall);
  const atStart = (d: Date): Date =>
    setSeconds(setMinutes(setHours(d, hours.startHour), 0), 0);

  return toWallString(
    date.getHours() < hours.startHour ? atStart(date) : atStart(addDays(date, 1)),
  );
}

export function describeQuietHours(hours: QuietHours): string {
  if (!hours.enabled) return 'Sin restricción de horario';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `Solo entre ${pad(hours.startHour)}:00 y ${pad(hours.endHour)}:00`;
}
