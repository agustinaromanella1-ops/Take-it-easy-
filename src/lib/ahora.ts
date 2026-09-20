import type { DateISO, Session } from '../types';
import { addDays, daysBetween, formatDateLong, timeToMinutes } from './dates';

/**
 * Qué está pasando ahora y qué sigue.
 *
 * La ceguera temporal es el síntoma de TDAH que más ordena —o desordena— un
 * día de consultorio: no es que no se sepa qué hora es, es que "las 15:00" no
 * se siente como una distancia. Un reloj no ayuda; "faltan 25 minutos" sí,
 * porque convierte el tiempo en una cantidad.
 *
 * Por eso el cálculo vive acá, puro y probado, y no adentro de un componente:
 * decide una sola cosa por vez y la pantalla solo la muestra.
 */
export type Momento =
  /** Está atendiendo: importa cuánto falta para terminar, no para empezar. */
  | { tipo: 'en_sesion'; sesion: Session; faltanMin: number }
  /** La próxima es hoy. */
  | { tipo: 'hoy'; sesion: Session; faltanMin: number }
  /** La próxima es otro día. */
  | { tipo: 'otro_dia'; sesion: Session; enDias: number }
  /** Había sesiones hoy y ya pasaron todas. */
  | { tipo: 'terminaste' }
  /** No hay nada agendado de acá en adelante. */
  | { tipo: 'sin_nada' };

/** Orden cronológico, que no es el orden en que se cargaron. */
function porFechaYHora(a: Session, b: Session): number {
  return a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date);
}

/**
 * `minutos` son los minutos transcurridos del día de hoy (0 = medianoche).
 *
 * Solo cuentan las sesiones `programada`: una ya resuelta no es algo que
 * siga por delante.
 */
export function queSigue(sesiones: Session[], hoy: DateISO, minutos: number): Momento {
  const pendientes = sesiones.filter((s) => s.status === 'programada').sort(porFechaYHora);

  const enCurso = pendientes.find((s) => {
    if (s.date !== hoy) return false;
    const inicio = timeToMinutes(s.time);
    return minutos >= inicio && minutos < inicio + s.durationMin;
  });
  if (enCurso) {
    const fin = timeToMinutes(enCurso.time) + enCurso.durationMin;
    return { tipo: 'en_sesion', sesion: enCurso, faltanMin: fin - minutos };
  }

  // Una sesión de anoche que se pasó de la medianoche sigue siendo la de ahora.
  // Sin esto, a las 00:10 de una sesión de 23:00 a 01:00 el inicio decía "día
  // libre" mientras se estaba atendiendo.
  const ayer = addDays(hoy, -1);
  const cruzando = pendientes.find((s) => {
    if (s.date !== ayer) return false;
    const fin = timeToMinutes(s.time) + s.durationMin - 24 * 60;
    return fin > minutos;
  });
  if (cruzando) {
    const fin = timeToMinutes(cruzando.time) + cruzando.durationMin - 24 * 60;
    return { tipo: 'en_sesion', sesion: cruzando, faltanMin: fin - minutos };
  }

  const deHoy = pendientes.find((s) => s.date === hoy && timeToMinutes(s.time) > minutos);
  if (deHoy) return { tipo: 'hoy', sesion: deHoy, faltanMin: timeToMinutes(deHoy.time) - minutos };

  const adelante = pendientes.find((s) => s.date > hoy);
  if (adelante) return { tipo: 'otro_dia', sesion: adelante, enDias: daysBetween(hoy, adelante.date) };

  // Ninguna por delante: cambia el ánimo del cartel si hubo trabajo hoy.
  const huboHoy = sesiones.some((s) => s.date === hoy && s.status !== 'cancelada');
  return huboHoy ? { tipo: 'terminaste' } : { tipo: 'sin_nada' };
}

/**
 * Una distancia de tiempo en palabras.
 *
 * Redondea hacia arriba a propósito: "falta 1 minuto" mientras quedan
 * cuarenta segundos es honesto, "faltan 0 minutos" no quiere decir nada.
 * Más de tres horas se deja de contar en minutos porque el número deja de
 * orientar y empieza a distraer.
 */
export function enPalabras(minutos: number): string {
  const m = Math.max(0, Math.ceil(minutos));
  if (m < 1) return 'ya';
  if (m === 1) return '1 minuto';
  if (m < 60) return `${m} minutos`;

  const horas = Math.floor(m / 60);
  const resto = m % 60;
  const h = horas === 1 ? '1 hora' : `${horas} horas`;
  if (horas >= 3 || resto === 0) return h;
  return `${h} y ${resto}`;
}

/** Cómo nombrar el día de una sesión que no es hoy. */
export function nombrarDia(fecha: DateISO, hoy: DateISO): string {
  if (fecha === addDays(hoy, 1)) return 'mañana';
  return formatDateLong(fecha);
}
