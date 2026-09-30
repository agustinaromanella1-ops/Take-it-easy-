import type { AppData, Cents, DateISO, Moneda } from '../../types';
import { daysBetween } from '../dates';
import { DIAS_SALDO_VIEJO } from './disponible';
import { esTarjeta, saldo } from './saldos';
import { proximoResumen } from './tarjeta';

/**
 * Lo que vence, visto como una sola lista: compromisos cargados a mano y
 * resúmenes de tarjeta. Arriba de Hoy se muestra UNO; la lista entera existe
 * para Mi plata.
 */
export interface Vencimiento {
  clave: string;
  tipo: 'compromiso' | 'tarjeta';
  /** Id del compromiso o de la tarjeta. */
  id: string;
  nombre: string;
  importe: Cents | null;
  moneda: Moneda;
  fecha: DateISO;
}

export function vencimientos(data: AppData): Vencimiento[] {
  const lista: Vencimiento[] = [];
  for (const k of data.compromisos) {
    if (k.pagado) continue;
    lista.push({ clave: `c:${k.id}`, tipo: 'compromiso', id: k.id, nombre: k.nombre, importe: k.importe, moneda: k.moneda, fecha: k.vencimiento });
  }
  for (const t of data.cuentas) {
    if (t.archivada || !esTarjeta(t)) continue;
    const r = proximoResumen(t, data.movimientos);
    if (!r) continue;
    lista.push({ clave: `t:${t.id}:${r.vencimiento}`, tipo: 'tarjeta', id: t.id, nombre: `Resumen de ${t.nombre}`, importe: r.pendiente, moneda: t.moneda, fecha: r.vencimiento });
  }
  return lista.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
}

/** El próximo compromiso: el más cercano, incluidos los que ya vencieron. */
export function proximoVencimiento(data: AppData): Vencimiento | null {
  return vencimientos(data)[0] ?? null;
}

/**
 * Un paso chiquito sugerido.
 *
 * Determinístico, y en este orden: lo que hace que el número de "cuánto puedo
 * usar" sea más confiable va primero. Uno solo: si hay cinco cosas, la
 * siguiente aparece cuando se resuelve esta.
 */
export type Paso =
  | { tipo: 'asignar-cuenta'; movimientoId: string; texto: string }
  | { tipo: 'importe-compromiso'; compromisoId: string; texto: string }
  | { tipo: 'confirmar-saldo'; cuentaId: string; texto: string }
  | { tipo: 'revisar-movimientos'; texto: string }
  | { tipo: 'primera-cuenta'; texto: string };

export function pasoSugerido(data: AppData, hoy: DateISO): Paso | null {
  const activas = data.cuentas.filter((c) => !c.archivada);
  if (activas.length === 0) {
    return { tipo: 'primera-cuenta', texto: 'Contame cuánta plata tenés hoy y dónde. Con una cuenta alcanza.' };
  }

  const sinCuenta = data.movimientos.find((m) => m.tipo === 'gasto' && m.cuentaId === null);
  if (sinCuenta) {
    return { tipo: 'asignar-cuenta', movimientoId: sinCuenta.id, texto: '¿De qué cuenta salió un gasto que anotaste sin cuenta?' };
  }

  const sinImporte = data.compromisos
    .filter((k) => !k.pagado && k.importe === null && daysBetween(hoy, k.vencimiento) <= 10)
    .sort((a, b) => (a.vencimiento < b.vencimiento ? -1 : 1))[0];
  if (sinImporte) {
    return { tipo: 'importe-compromiso', compromisoId: sinImporte.id, texto: `¿Ya sabés cuánto es ${sinImporte.nombre}?` };
  }

  const vieja = activas
    .filter((c) => !esTarjeta(c) && c.cuentaParaDisponible && daysBetween(c.confirmadoEn, hoy) >= DIAS_SALDO_VIEJO)
    .sort((a, b) => (a.confirmadoEn < b.confirmadoEn ? -1 : 1))[0];
  if (vieja) {
    return { tipo: 'confirmar-saldo', cuentaId: vieja.id, texto: `¿Cuánto hay hoy en ${vieja.nombre}? Con mirar el número alcanza.` };
  }

  if (data.movimientos.some((m) => m.aRevisar)) {
    return { tipo: 'revisar-movimientos', texto: 'Hay movimientos para mirar. ¿Vemos uno?' };
  }
  return null;
}

/** Saldo de cada cuenta, para listados. */
export function saldosPorCuenta(data: AppData): Map<string, Cents> {
  return new Map(data.cuentas.map((c) => [c.id, saldo(c, data.movimientos)]));
}
