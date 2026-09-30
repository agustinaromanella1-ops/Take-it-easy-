import type { Cents } from '../../types';

/**
 * Escenarios de una deuda: "si pago tanto por mes, ¿cuándo termino y cuánto
 * pago de intereses?".
 *
 * Es una simulación con supuestos explícitos, no una predicción ni una
 * recomendación:
 * - la tasa se mantiene fija;
 * - la tasa mensual es la nominal anual dividida 12 (como se informa en
 *   Argentina);
 * - no hay consumos nuevos, cargos, seguros ni impuestos sobre los intereses;
 * - se paga el mismo importe todos los meses.
 *
 * Todo en centavos enteros, redondeando el interés de cada mes.
 */
export const SUPUESTOS = [
  'La tasa se mantiene igual todo el tiempo.',
  'La tasa mensual es la anual dividida 12.',
  'No hay compras nuevas, cargos, seguros ni impuestos (el IVA sobre intereses suele sumar).',
  'Se paga el mismo importe todos los meses.',
] as const;

export type Escenario =
  | { termina: true; meses: number; intereses: Cents; totalPagado: Cents }
  | { termina: false; interesPrimerMes: Cents };

const TOPE_MESES = 600;

/** `tasaAnual` en centésimos de punto: 8550 = 85,50 % anual. */
export function simular(saldo: Cents, tasaAnual: number, pagoMensual: Cents): Escenario {
  if (saldo <= 0) return { termina: true, meses: 0, intereses: 0, totalPagado: 0 };
  const tasaMensual = tasaAnual / 10000 / 12;
  let deuda = saldo;
  let intereses = 0;
  let pagado = 0;
  for (let mes = 1; mes <= TOPE_MESES; mes++) {
    const interes = Math.round(deuda * tasaMensual);
    if (mes === 1 && pagoMensual <= interes) return { termina: false, interesPrimerMes: interes };
    deuda += interes;
    intereses += interes;
    const pago = Math.min(pagoMensual, deuda);
    deuda -= pago;
    pagado += pago;
    if (deuda <= 0) return { termina: true, meses: mes, intereses, totalPagado: pagado };
  }
  return { termina: false, interesPrimerMes: Math.round(saldo * tasaMensual) };
}

/** "85,5" o "85,50 %" → 8550. `null` si no se entiende. */
export function parseTasa(texto: string): number | null {
  const t = texto.replace('%', '').replace(',', '.').trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > 1000) return null;
  return Math.round(n * 100);
}

export function formatTasa(tasa: number): string {
  return `${(tasa / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 })} %`;
}
