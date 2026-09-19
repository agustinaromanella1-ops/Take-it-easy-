import type { DateISO, Session } from '../types';
import { timeToMinutes } from './dates';

/**
 * El aviso de que se viene un turno.
 *
 * Qué hace y qué NO hace, porque la diferencia importa: este aviso lo dispara
 * la app mientras está abierta, no el sistema operativo. No es un despertador.
 * Si la app está cerrada no suena, y en el celular un navegador en segundo
 * plano puede quedar congelado. Un aviso que se promete y a veces no llega es
 * peor que no prometerlo, así que Ajustes lo dice con todas las letras y viene
 * apagado de fábrica.
 *
 * El que sí funciona con la app cerrada es el del calendario del teléfono:
 * está en la agenda, en "Mandar al calendario", y usa `reminderMinutes`.
 */

/** Cuánto margen se le da a un aviso que llegó tarde porque la app estaba dormida. */
const TOLERANCIA_MIN = 2;

/**
 * Las sesiones que corresponde avisar en este momento.
 *
 * `minutos` son los minutos transcurridos del día. Se avisa desde que faltan
 * `antesMin` hasta que la sesión empieza; pasada la hora no se avisa nada,
 * porque un aviso de algo que ya arrancó no sirve para prepararse.
 */
export function sesionesPorAvisar(
  sesiones: Session[],
  hoy: DateISO,
  minutos: number,
  antesMin: number,
  yaAvisadas: ReadonlySet<string>,
): Session[] {
  if (antesMin <= 0) return [];
  return sesiones.filter((s) => {
    if (s.status !== 'programada' || s.date !== hoy) return false;
    if (yaAvisadas.has(s.id)) return false;
    const faltan = timeToMinutes(s.time) - minutos;
    return faltan <= antesMin && faltan > -TOLERANCIA_MIN;
  });
}

/** El texto del aviso. Dice el nombre y cuánto falta, nada más. */
export function textoAviso(nombre: string, faltanMin: number): { titulo: string; cuerpo: string } {
  const m = Math.max(0, Math.round(faltanMin));
  return {
    titulo: m <= 0 ? `Empieza la sesión con ${nombre}` : `${nombre}, en ${m === 1 ? '1 minuto' : `${m} minutos`}`,
    cuerpo: 'Pipí Cucú',
  };
}
