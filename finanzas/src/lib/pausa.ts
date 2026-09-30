import type { DateISO } from '../types';
import { daysBetween } from './dates';

/**
 * Volver después de una pausa.
 *
 * Siete días sin abrir la app cuentan como pausa. La última visita vive en el
 * dispositivo y no en los datos: es "cuándo abrí esta app acá", no un dato de
 * plata, y no tiene que viajar en una copia.
 */
export const DIAS_PAUSA = 7;
const CLAVE = 'salchi:ultima-visita';

export function esPausa(ultimaVisita: DateISO | null, hoy: DateISO): boolean {
  if (!ultimaVisita) return false;
  return daysBetween(ultimaVisita, hoy) >= DIAS_PAUSA;
}

export function leerUltimaVisita(): DateISO | null {
  try {
    return localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}

export function guardarVisita(hoy: DateISO): void {
  try {
    localStorage.setItem(CLAVE, hoy);
  } catch {
    /* Sin almacenamiento no hay forma de saber de pausas; la app sigue igual. */
  }
}
