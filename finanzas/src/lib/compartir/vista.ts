import type { AppData, Cents, DateISO, Moneda, TipoMovimiento } from '../../types';
import { addDays, daysBetween } from '../dates';
import { calcularDisponible, monedasEnUso, textoFaltante } from '../finanzas/disponible';
import { vencimientos } from '../finanzas/pendientes';
import { reservado } from '../finanzas/metas';

/**
 * Qué ve la persona con quien se comparte. Solo lo que se eligió, armado en
 * el teléfono: nunca los datos completos, nunca los ids, nunca notas.
 */
export interface Permisos {
  disponible: boolean;
  vencimientos: boolean;
  metas: boolean;
  movimientos: boolean;
}

export const PERMISOS_INICIALES: Permisos = { disponible: true, vencimientos: true, metas: false, movimientos: false };

export const NOMBRE_PERMISO: Record<keyof Permisos, string> = {
  disponible: 'Cuánto podés usar y hasta cuándo',
  vencimientos: 'Lo que vence en los próximos 30 días',
  metas: 'Tus metas y tu reserva',
  movimientos: 'Los movimientos de los últimos 30 días',
};

export interface VistaCompartida {
  version: 1;
  generadoEn: string;
  hoy: DateISO;
  disponible?: { moneda: Moneda; importe: Cents | null; hasta: DateISO; faltantes: string[] }[];
  vencimientos?: { nombre: string; importe: Cents | null; moneda: Moneda; fecha: DateISO }[];
  metas?: { nombre: string; reservado: Cents; objetivo: Cents | null; moneda: Moneda; esReserva: boolean }[];
  movimientos?: { fecha: DateISO; tipo: TipoMovimiento; importe: Cents; moneda: Moneda; comercio: string; categoria: string }[];
}

export const DIAS_VISTA = 30;

export function armarVista(data: AppData, permisos: Permisos, hoy: DateISO, ahora: string): VistaCompartida {
  const v: VistaCompartida = { version: 1, generadoEn: ahora, hoy };
  if (permisos.disponible) {
    v.disponible = monedasEnUso(data).map((m) => {
      const d = calcularDisponible(data, m, hoy);
      return { moneda: m, importe: d.importe, hasta: d.hasta, faltantes: d.faltantes.map(textoFaltante) };
    });
  }
  if (permisos.vencimientos) {
    v.vencimientos = vencimientos(data, hoy)
      .filter((x) => daysBetween(hoy, x.fecha) <= DIAS_VISTA)
      .map((x) => ({ nombre: x.nombre, importe: x.importe, moneda: x.moneda, fecha: x.fecha }));
  }
  if (permisos.metas) {
    v.metas = data.metas.map((m) => ({ nombre: m.nombre, reservado: reservado(m, data.aportes), objetivo: m.objetivo, moneda: m.moneda, esReserva: m.esReserva }));
  }
  if (permisos.movimientos) {
    const desde = addDays(hoy, -DIAS_VISTA);
    v.movimientos = data.movimientos
      .filter((m) => m.fecha > desde && m.fecha <= hoy)
      .sort((a, b) => (a.fecha > b.fecha ? -1 : 1))
      .map((m) => ({ fecha: m.fecha, tipo: m.tipo, importe: m.importe, moneda: m.moneda, comercio: m.comercio, categoria: m.categoria }));
  }
  return v;
}

/** Valida lo que llega descifrado. Si no tiene la forma esperada, no se muestra. */
export function esVista(x: unknown): x is VistaCompartida {
  if (typeof x !== 'object' || x === null) return false;
  const v = x as Record<string, unknown>;
  const lista = (k: string) => v[k] === undefined || Array.isArray(v[k]);
  return v.version === 1 && typeof v.generadoEn === 'string' && typeof v.hoy === 'string' && ['disponible', 'vencimientos', 'metas', 'movimientos'].every(lista);
}
