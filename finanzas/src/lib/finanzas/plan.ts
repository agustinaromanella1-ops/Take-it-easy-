import type { AppData, Cents, DateISO, Meta } from '../../types';
import { addDays, addMonthsISO, daysBetween, finDeMes } from '../dates';
import { esDeuda, esPrestamo, esTarjeta } from './saldos';
import { resumenes } from './tarjeta';
import { cuotasPrestamo } from './prestamo';

/**
 * El plan del mes: lo que se espera que entre, lo que ya se sabe que sale, y
 * lo que queda para el día a día y las metas.
 *
 * Es un plan, no plata: nada de esto aparta ni mueve nada. Todo en pesos (los
 * dólares se miran aparte) y con los supuestos a la vista:
 *
 * - Entradas: lo cobrado este mes más lo esperado que todavía no entró.
 * - Salidas fijas: compromisos del mes, resúmenes de tarjeta y cuotas de
 *   préstamos que vencen este mes. Un compromiso sin importe no se estima.
 * - Día a día: lo que escribió la persona o, si no, el promedio de gastos de
 *   los últimos 90 días, sin contar pagos de compromisos ni compras con
 *   tarjeta (esas ya están en el resumen: contarlas dos veces inflaría todo).
 */

export interface Plan {
  desde: DateISO;
  hasta: DateISO;
  cobrado: Cents;
  esperado: Cents;
  fijas: { texto: string; importe: Cents }[];
  totalFijas: Cents;
  diaADia: Cents | null;
  /** De dónde sale el día a día. */
  origenDiaADia: 'escrito' | 'promedio' | 'sin-datos';
  /** `null` si falta el día a día. */
  margen: Cents | null;
  faltantes: string[];
}

export const DIAS_PROMEDIO = 90;

export function promedioDiaADia(data: AppData, hoy: DateISO): Cents | null {
  const desde = addDays(hoy, -DIAS_PROMEDIO);
  const pagos = new Set(data.compromisos.map((k) => k.pagoId).filter(Boolean));
  const deuda = new Set(data.cuentas.filter(esDeuda).map((c) => c.id));
  const gastos = data.movimientos.filter(
    (m) => m.tipo === 'gasto' && m.moneda === 'ARS' && m.fecha > desde && m.fecha <= hoy && !pagos.has(m.id) && !(m.cuentaId && deuda.has(m.cuentaId)),
  );
  if (gastos.length === 0) return null;
  // Se divide por los días que realmente hay anotados, no por 90: si alguien
  // empezó hace dos semanas, dividir por tres meses daría un número falso.
  const primero = gastos.reduce((a, m) => (m.fecha < a ? m.fecha : a), hoy);
  const dias = Math.max(7, Math.min(DIAS_PROMEDIO, daysBetween(primero, hoy) + 1));
  const total = gastos.reduce((s, m) => s + m.importe, 0);
  // Redondeado a cientos de pesos: es una estimación, y los centavos le darían
  // una precisión que no tiene.
  return Math.round(((total / dias) * 30) / 10000) * 10000;
}

export function planDelMes(data: AppData, hoy: DateISO): Plan {
  const desde = `${hoy.slice(0, 7)}-01`;
  const hasta = finDeMes(hoy);
  const enMes = (f: DateISO) => f >= desde && f <= hasta;
  const faltantes: string[] = [];

  const cobrado = data.movimientos.filter((m) => m.tipo === 'ingreso' && m.moneda === 'ARS' && enMes(m.fecha)).reduce((s, m) => s + m.importe, 0);
  let esperado = 0;
  for (const i of data.ingresos) {
    if (i.cobrado || i.moneda !== 'ARS' || !enMes(i.fecha)) continue;
    if (i.importe === null) faltantes.push(`Falta cuánto esperás de ${i.nombre}.`);
    else esperado += i.importe;
  }

  const fijas: Plan['fijas'] = [];
  for (const k of data.compromisos) {
    if (k.moneda !== 'ARS' || !enMes(k.vencimiento)) continue;
    if (k.importe === null) faltantes.push(`Falta el importe de ${k.nombre}.`);
    else fijas.push({ texto: k.nombre, importe: k.importe });
  }
  for (const c of data.cuentas) {
    if (c.archivada || c.moneda !== 'ARS') continue;
    if (esTarjeta(c)) {
      const total = resumenes(c, data.movimientos).filter((r) => enMes(r.vencimiento)).reduce((s, r) => s + r.total, 0);
      if (total > 0) fijas.push({ texto: `Resumen de ${c.nombre}`, importe: total });
    } else if (esPrestamo(c)) {
      const total = cuotasPrestamo(c, data.movimientos, hasta).filter((r) => enMes(r.vencimiento)).reduce((s, r) => s + r.total, 0);
      if (total > 0) fijas.push({ texto: `Cuota de ${c.nombre}`, importe: total });
    }
  }
  const totalFijas = fijas.reduce((s, f) => s + f.importe, 0);

  let diaADia: Cents | null = data.preferencias.gastoVariable;
  let origenDiaADia: Plan['origenDiaADia'] = 'escrito';
  if (diaADia === null) {
    diaADia = promedioDiaADia(data, hoy);
    origenDiaADia = diaADia === null ? 'sin-datos' : 'promedio';
  }
  if (diaADia === null) faltantes.push('Todavía no hay gastos anotados para estimar el día a día. Podés escribir un número.');

  return {
    desde,
    hasta,
    cobrado,
    esperado,
    fijas,
    totalFijas,
    diaADia,
    origenDiaADia,
    margen: diaADia === null ? null : cobrado + esperado - totalFijas - diaADia,
    faltantes,
  };
}

/**
 * Cuántos meses faltan para una meta al ritmo de los aportes de los últimos
 * 90 días. `null` si no hay objetivo o no hubo aportes: sin ritmo no hay
 * pronóstico, y no se inventa uno.
 */
export function ritmoDeMeta(meta: Meta, data: AppData, hoy: DateISO): { porMes: Cents; meses: number } | null {
  if (!meta.objetivo) return null;
  const desde = addDays(hoy, -DIAS_PROMEDIO);
  const aportes = data.aportes.filter((a) => a.metaId === meta.id && a.fecha > desde && a.fecha <= hoy);
  const neto = aportes.reduce((s, a) => s + a.importe, 0);
  if (neto <= 0) return null;
  const porMes = Math.round(neto / 3);
  const hay = data.aportes.filter((a) => a.metaId === meta.id).reduce((s, a) => s + a.importe, 0);
  const falta = meta.objetivo - hay;
  if (falta <= 0) return { porMes, meses: 0 };
  return { porMes, meses: Math.ceil(falta / porMes) };
}

/** La fecha aproximada en que se llega, para decirla en palabras. */
export function llegadaAproximada(hoy: DateISO, meses: number): DateISO {
  return addMonthsISO(hoy, meses);
}
