import type { Cents, DateISO, Moneda, Movimiento } from '../../types';
import { daysBetween } from '../dates';

/**
 * Posibles duplicados.
 *
 * Mismo importe, misma moneda, fechas a dos días o menos, y el comercio
 * parecido (o sin comercio de algún lado). Se AVISA y se pregunta: nunca se
 * borra solo, porque dos cafés iguales el mismo día son dos cafés.
 */
export const DIAS_DUPLICADO = 2;

export interface Candidato {
  importe: Cents;
  moneda: Moneda;
  fecha: DateISO;
  comercio: string;
  tipo: Movimiento['tipo'];
}

export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function comercioParecido(a: string, b: string): boolean {
  const x = normalizar(a);
  const y = normalizar(b);
  if (x === '' || y === '') return true;
  return x.includes(y) || y.includes(x) || x.split(' ')[0] === y.split(' ')[0];
}

export function posiblesDuplicados(nuevo: Candidato, movimientos: readonly Movimiento[], excluirId?: string): Movimiento[] {
  return movimientos.filter(
    (m) =>
      m.id !== excluirId &&
      m.tipo === nuevo.tipo &&
      m.importe === nuevo.importe &&
      m.moneda === nuevo.moneda &&
      Math.abs(daysBetween(m.fecha, nuevo.fecha)) <= DIAS_DUPLICADO &&
      comercioParecido(m.comercio, nuevo.comercio),
  );
}
