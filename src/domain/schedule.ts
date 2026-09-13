import {
  addDays,
  addHours,
  addMinutes,
  nextMonday,
  setHours,
  setMinutes,
  setSeconds,
  startOfDay,
} from 'date-fns';
import { toWallString, wallNow, type WallClock } from './time';

export interface QuickOption {
  id: string;
  label: string;
  wall: WallClock;
}

const at = (base: Date, hour: number): Date =>
  setSeconds(setMinutes(setHours(base, hour), 0), 0);

/** Redondea hacia arriba al múltiplo de 5 minutos, para no agendar a las 14:37. */
const roundUp5 = (d: Date): Date => {
  const rounded = setSeconds(addMinutes(d, (5 - (d.getMinutes() % 5)) % 5), 0);
  return rounded;
};

/**
 * Los atajos que cubren la mayoría de los casos sin abrir el date picker.
 * Se calculan sobre la hora de pared del huso de la usuaria y se ocultan
 * los que ya no tienen sentido (no ofrecemos "esta tarde" a las 20 h).
 */
export function quickOptions(
  timezone: string,
  now: Date = new Date(),
): QuickOption[] {
  const local = wallNow(timezone, now);
  const options: QuickOption[] = [];

  const inTwoHours = roundUp5(addHours(local, 2));
  options.push({
    id: 'in-2h',
    label: 'En 2 horas',
    wall: toWallString(inTwoHours),
  });

  const thisAfternoon = at(local, 18);
  if (thisAfternoon.getTime() > local.getTime()) {
    options.push({
      id: 'this-afternoon',
      label: 'Esta tarde 18:00',
      wall: toWallString(thisAfternoon),
    });
  }

  options.push({
    id: 'tomorrow-9',
    label: 'Mañana 9:00',
    wall: toWallString(at(addDays(local, 1), 9)),
  });

  // Si hoy es lunes y todavía no son las 9, "Lunes a las 9" es hoy.
  const isMondayBeforeNine =
    local.getDay() === 1 && local.getHours() < 9;
  const monday = isMondayBeforeNine ? startOfDay(local) : nextMonday(local);
  options.push({
    id: 'monday-9',
    label: 'Lunes 9:00',
    wall: toWallString(at(monday, 9)),
  });

  return options;
}

export type ShiftKind = 'plus-1h' | 'plus-1d' | 'next-monday';

export const SHIFT_LABELS: Record<ShiftKind, string> = {
  'plus-1h': '+1 hora',
  'plus-1d': '+1 día',
  'next-monday': 'Próximo lunes',
};

/** Corrimientos rápidos para reprogramar sin abrir el selector. */
export function shiftWall(wall: WallClock, kind: ShiftKind): WallClock {
  const base = new Date(wall);
  switch (kind) {
    case 'plus-1h':
      return toWallString(addHours(base, 1));
    case 'plus-1d':
      return toWallString(addDays(base, 1));
    case 'next-monday':
      return toWallString(at(nextMonday(base), 9));
  }
}

/** Posponer desde la notificación: una hora desde ahora, no desde la hora vieja. */
export function snoozeOneHour(
  timezone: string,
  now: Date = new Date(),
): WallClock {
  return toWallString(roundUp5(addHours(wallNow(timezone, now), 1)));
}
