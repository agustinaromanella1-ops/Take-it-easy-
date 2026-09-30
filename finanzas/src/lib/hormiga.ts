import type { DateISO } from '../types';
import { daysBetween } from './dates';

/**
 * La hormiguita: un recordatorio chiquito y opcional de los gastos chicos.
 *
 * Las reglas son para que no se vuelva insistente:
 * - como mucho una vez cada 3 días;
 * - si se la descarta con "Ahora no", no vuelve por 7 días;
 * - solo en Hoy, y nunca durante una tarea delicada (un comprobante, un
 *   formulario, el regreso de una pausa) ni en modo baja energía;
 * - si se la ignora, se va sola. Ignorarla no cambia la frecuencia.
 */
export const DIAS_ENTRE_APARICIONES = 3;
export const DIAS_DESCANSO_TRAS_DESCARTE = 7;
export const SEGUNDOS_VISIBLE = 20;

export interface EstadoHormiga {
  ultimaAparicion: DateISO | null;
  descartadaEl: DateISO | null;
}

export interface Contexto {
  activada: boolean;
  enHoy: boolean;
  ocupada: boolean;
  bajaEnergia: boolean;
  hayCuentas: boolean;
}

export function debeAparecer(estado: EstadoHormiga, ctx: Contexto, hoy: DateISO): boolean {
  if (!ctx.activada || !ctx.enHoy || ctx.ocupada || ctx.bajaEnergia || !ctx.hayCuentas) return false;
  if (estado.descartadaEl && daysBetween(estado.descartadaEl, hoy) < DIAS_DESCANSO_TRAS_DESCARTE) return false;
  if (estado.ultimaAparicion && daysBetween(estado.ultimaAparicion, hoy) < DIAS_ENTRE_APARICIONES) return false;
  return true;
}

const CLAVE = 'salchi:hormiga';

export function leerHormiga(): EstadoHormiga {
  try {
    const x: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>;
      return {
        ultimaAparicion: typeof o.ultimaAparicion === 'string' ? o.ultimaAparicion : null,
        descartadaEl: typeof o.descartadaEl === 'string' ? o.descartadaEl : null,
      };
    }
  } catch {
    /* Cae al valor por defecto. */
  }
  return { ultimaAparicion: null, descartadaEl: null };
}

export function guardarHormiga(e: EstadoHormiga): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(e));
  } catch {
    /* Sin almacenamiento, la hormiga puede volver antes: no es grave. */
  }
}
