import type { AppData, Cents, Cuenta, DateISO, IngresoEsperado, Moneda } from '../../types';
import { daysBetween, finDeMes } from '../dates';
import { esTarjeta, saldo } from './saldos';
import { aPagarHasta } from './tarjeta';

/**
 * "¿Cuánto puedo usar?"
 *
 * La cuenta, entera, por moneda (pesos y dólares no se suman nunca):
 *
 *     plata en cuentas que cuentan para el disponible
 *   − compromisos sin pagar que vencen hasta el fin del período
 *   − lo que queda por pagar de las tarjetas hasta el fin del período
 *   − gastos anotados sin cuenta (la plata ya salió de algún lado)
 *   − lo apartado para metas en esas mismas cuentas
 *
 * Cada término sale de un solo lugar, así nada se resta dos veces: las cuotas
 * viven solo en la tarjeta, lo apartado solo en los aportes, y un compromiso
 * pagado deja de restarse porque su pago ya bajó el saldo.
 *
 * Los ingresos que todavía no se cobraron NO suman. Van aparte, como
 * proyección con "si".
 */

/** Pasados estos días sin confirmar un saldo, se avisa que el número puede estar viejo. */
export const DIAS_SALDO_VIEJO = 7;

export interface Renglon {
  texto: string;
  importe: Cents;
  /** Para la explicación: suma o resta. */
  signo: '+' | '−';
}

export type Faltante =
  | { tipo: 'sin-cuentas' }
  | { tipo: 'saldo-viejo'; cuenta: string; dias: number }
  | { tipo: 'aproximado'; cuenta: string }
  | { tipo: 'sin-importe'; compromiso: string }
  | { tipo: 'sin-cuenta'; cantidad: number };

export interface Disponible {
  moneda: Moneda;
  /** `null` cuando no hay con qué calcular: se muestra qué falta, no una cifra. */
  importe: Cents | null;
  hasta: DateISO;
  /** De qué depende la fecha de fin. */
  motivoHasta: 'proximo-ingreso' | 'fin-de-mes';
  renglones: Renglon[];
  faltantes: Faltante[];
  /** El saldo confirmado más viejo entre los que se usan. */
  actualizadoEn: DateISO | null;
  /** El próximo ingreso esperado, para la proyección aparte. */
  proyeccion: { ingreso: IngresoEsperado; siSeCobra: Cents } | null;
}

/** El próximo ingreso esperado sin cobrar desde hoy, en cualquier moneda. */
export function proximoIngreso(data: AppData, hoy: DateISO, moneda?: Moneda): IngresoEsperado | null {
  const candidatos = data.ingresos
    .filter((i) => !i.cobrado && i.fecha >= hoy && (moneda === undefined || i.moneda === moneda))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return candidatos[0] ?? null;
}

/** Hasta cuándo va el período: el próximo cobro, o fin de mes si no hay ninguno cargado. */
export function finDelPeriodo(data: AppData, hoy: DateISO): { hasta: DateISO; motivo: Disponible['motivoHasta'] } {
  if (data.preferencias.periodo === 'proximo-ingreso') {
    const ingreso = proximoIngreso(data, hoy);
    if (ingreso) return { hasta: ingreso.fecha, motivo: 'proximo-ingreso' };
  }
  return { hasta: finDeMes(hoy), motivo: 'fin-de-mes' };
}

function cuentaLiquida(c: Cuenta): boolean {
  return !c.archivada && !esTarjeta(c) && c.cuentaParaDisponible;
}

export function calcularDisponible(data: AppData, moneda: Moneda, hoy: DateISO): Disponible {
  const { hasta, motivo } = finDelPeriodo(data, hoy);
  const renglones: Renglon[] = [];
  const faltantes: Faltante[] = [];

  const liquidas = data.cuentas.filter((c) => c.moneda === moneda && cuentaLiquida(c));
  const idsLiquidas = new Set(liquidas.map((c) => c.id));

  let total: Cents = 0;
  for (const c of liquidas) {
    const s = saldo(c, data.movimientos);
    total += s;
    renglones.push({ texto: `Plata en ${c.nombre}`, importe: s, signo: '+' });
    const dias = daysBetween(c.confirmadoEn, hoy);
    if (dias >= DIAS_SALDO_VIEJO) faltantes.push({ tipo: 'saldo-viejo', cuenta: c.nombre, dias });
    if (c.aproximado) faltantes.push({ tipo: 'aproximado', cuenta: c.nombre });
  }

  for (const k of data.compromisos) {
    if (k.pagado || k.moneda !== moneda || k.vencimiento > hasta) continue;
    if (k.importe === null) {
      faltantes.push({ tipo: 'sin-importe', compromiso: k.nombre });
      continue;
    }
    total -= k.importe;
    renglones.push({ texto: `${k.nombre} (vence ${k.vencimiento < hoy ? 'ya pasó' : 'en el período'})`, importe: k.importe, signo: '−' });
  }

  for (const t of data.cuentas) {
    if (t.archivada || !esTarjeta(t) || t.moneda !== moneda) continue;
    const debe = aPagarHasta(t, data.movimientos, hasta);
    if (debe <= 0) continue;
    total -= debe;
    renglones.push({ texto: `Resumen de ${t.nombre}`, importe: debe, signo: '−' });
  }

  const sinCuenta = data.movimientos.filter((m) => m.tipo === 'gasto' && m.cuentaId === null && m.moneda === moneda);
  if (sinCuenta.length > 0) {
    const suma = sinCuenta.reduce((s, m) => s + m.importe, 0);
    total -= suma;
    renglones.push({ texto: `Gastos sin cuenta asignada (${sinCuenta.length})`, importe: suma, signo: '−' });
    faltantes.push({ tipo: 'sin-cuenta', cantidad: sinCuenta.length });
  }

  const apartado = data.aportes
    .filter((a) => idsLiquidas.has(a.cuentaId))
    .reduce((s, a) => s + a.importe, 0);
  if (apartado !== 0) {
    total -= apartado;
    renglones.push({ texto: 'Apartado para tus metas', importe: apartado, signo: '−' });
  }

  if (liquidas.length === 0) faltantes.unshift({ tipo: 'sin-cuentas' });

  const actualizadoEn = liquidas.length
    ? liquidas.map((c) => c.confirmadoEn).sort()[0] ?? null
    : null;

  const ingreso = proximoIngreso(data, hoy, moneda);
  const importe = liquidas.length === 0 ? null : total;
  const proyeccion =
    ingreso && ingreso.importe !== null && importe !== null
      ? { ingreso, siSeCobra: importe + ingreso.importe }
      : null;

  return { moneda, importe, hasta, motivoHasta: motivo, renglones, faltantes, actualizadoEn, proyeccion };
}

/** Las monedas que tiene sentido mostrar: pesos siempre, dólares si hay algo en dólares. */
export function monedasEnUso(data: AppData): Moneda[] {
  const usd = data.cuentas.some((c) => !c.archivada && c.moneda === 'USD');
  return usd ? ['ARS', 'USD'] : ['ARS'];
}

/** El faltante en palabras, sin reproche. */
export function textoFaltante(f: Faltante): string {
  switch (f.tipo) {
    case 'sin-cuentas':
      return 'Para calcular, necesito saber cuánta plata tenés hoy y dónde.';
    case 'saldo-viejo':
      return `El saldo de ${f.cuenta} es de hace ${f.dias} días.`;
    case 'aproximado':
      return `El saldo de ${f.cuenta} es aproximado.`;
    case 'sin-importe':
      return `Falta el importe de ${f.compromiso}: no lo estoy restando.`;
    case 'sin-cuenta':
      return f.cantidad === 1
        ? 'Hay 1 gasto sin cuenta: el número puede no coincidir con tus saldos.'
        : `Hay ${f.cantidad} gastos sin cuenta: el número puede no coincidir con tus saldos.`;
  }
}
