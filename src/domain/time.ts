import { format } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

/**
 * Una "hora de pared": el día y la hora tal como los eligió la usuaria, sin huso.
 * Formato "yyyy-MM-dd'T'HH:mm", ej "2026-09-14T09:00".
 *
 * Guardamos esto además del instante UTC porque la intención es "el lunes a las 9",
 * no "tal instante". Si cambian las reglas del huso (Argentina tiene historial de
 * tocar el horario de verano), recalculamos el UTC y el mensaje sigue saliendo a
 * las 9 hora local.
 */
export type WallClock = string;

export const WALL_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Convierte una hora de pared + huso al instante UTC correspondiente. */
export function wallToUtc(wall: WallClock, timezone: string): Date {
  return fromZonedTime(wall, timezone);
}

/** Convierte un instante a la hora de pared que se ve en ese huso. */
export function utcToWall(date: Date, timezone: string): WallClock {
  return format(toZonedTime(date, timezone), WALL_FORMAT);
}

/**
 * Devuelve un Date cuyos getters locales representan la hora de pared del huso
 * indicado. Sirve para hacer cuentas de calendario (sumar días, fijar la hora)
 * razonando en hora local.
 */
export function wallNow(timezone: string, now: Date = new Date()): Date {
  return toZonedTime(now, timezone);
}

/** Pasa un Date "en hora de pared" al string que guardamos. */
export function toWallString(d: Date): WallClock {
  return format(d, WALL_FORMAT);
}

/** True si la hora de pared ya pasó en ese huso. */
export function isPast(
  wall: WallClock,
  timezone: string,
  now: Date = new Date(),
): boolean {
  return wallToUtc(wall, timezone).getTime() <= now.getTime();
}
