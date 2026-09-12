import type { Cents, RateInputs } from '../types';

/**
 * Cuánto habría que cobrar por sesión para que las cuentas cierren.
 *
 * El razonamiento va al revés del intuitivo: no se parte del honorario, se
 * parte de lo que la persona necesita llevarse y se llega a la tarifa.
 *
 *   1. Lo que hay que cubrir = lo que quiere ganar + gastos fijos del consultorio.
 *   2. Eso es plata en el bolsillo, así que hay que facturar más para que, después
 *      de impuestos y aportes, quede esa cifra.
 *   3. Las sesiones que se cobran de verdad son menos que las agendadas: una parte
 *      se cae por ausencias y cancelaciones.
 *   4. Tarifa = lo que hay que facturar / sesiones que efectivamente se cobran.
 */

/** Promedio de semanas por mes: 52 semanas / 12 meses. No son 4. */
export const WEEKS_PER_MONTH = 52 / 12;

export interface RateResult {
  /** Tarifa sugerida por sesión, en centavos. */
  suggestedFee: Cents;
  /** Cuánto hay que facturar por mes para que quede el objetivo después de impuestos. */
  monthlyBilling: Cents;
  /** Sesiones agendadas por mes, según las sesiones por semana declaradas.
   *  Redondeado a un decimal: es un valor para mostrar, no para recalcular. */
  scheduledSessions: number;
  /** De esas, las que se espera cobrar realmente. Redondeado a un decimal,
   *  igual que `scheduledSessions`: no sirve para rehacer la cuenta. */
  paidSessions: number;
}

/**
 * Redondea hacia arriba a una cifra que alguien realmente cobraría.
 *
 * Una tarifa de $17.094,02 es matemáticamente correcta e inservible como
 * consejo. El paso depende de la magnitud, así que funciona igual con pesos
 * que con una moneda donde la sesión vale 60: de 10.000 unidades para arriba
 * salta de a 100, de 1.000 para arriba de a 10, y por debajo a la unidad.
 * Siempre hacia arriba: redondear para abajo dejaría las cuentas sin cerrar.
 */
export function roundUpNice(cents: Cents): Cents {
  const units = cents / 100;
  const step = units >= 10_000 ? 10_000 : units >= 1_000 ? 1_000 : 100;
  return Math.ceil(cents / step) * step;
}

/**
 * Devuelve `null` cuando los datos no permiten un resultado con sentido:
 * sin sesiones cobrables, o con una carga impositiva del 100%, la tarifa
 * tendería a infinito. Mejor no mostrar un número que mentir con uno.
 */
export function suggestedRate(input: RateInputs): RateResult | null {
  const { targetIncome, fixedCosts, sessionsPerWeek, taxPercent, noShowPercent } = input;

  if (!Number.isFinite(sessionsPerWeek) || sessionsPerWeek <= 0) return null;
  if (taxPercent < 0 || taxPercent >= 100) return null;
  if (noShowPercent < 0 || noShowPercent >= 100) return null;

  const needed = targetIncome + fixedCosts;
  if (needed <= 0) return null;

  const monthlyBilling = needed / (1 - taxPercent / 100);
  const scheduledSessions = sessionsPerWeek * WEEKS_PER_MONTH;
  const paidSessions = scheduledSessions * (1 - noShowPercent / 100);
  if (paidSessions <= 0) return null;

  const rawFee = monthlyBilling / paidSessions;
  return {
    suggestedFee: roundUpNice(rawFee),
    // La meta se recalcula sobre la tarifa redondeada: si no, no coincidiría
    // con lo que va a facturar de verdad quien cobre esa tarifa.
    monthlyBilling: Math.round(roundUpNice(rawFee) * paidSessions),
    scheduledSessions: Math.round(scheduledSessions * 10) / 10,
    paidSessions: Math.round(paidSessions * 10) / 10,
  };
}

/**
 * Cuánto falta para la meta del mes y qué porcentaje lleva.
 * Sin meta definida (cero) no hay nada que informar.
 */
export interface GoalProgress {
  goal: Cents;
  reached: Cents;
  remaining: Cents;
  /** 0 a 100, acotado: superar la meta no da 140% en la barra. */
  percent: number;
  done: boolean;
}

export function goalProgress(goal: Cents, reached: Cents): GoalProgress | null {
  if (goal <= 0) return null;
  const remaining = Math.max(0, goal - reached);
  return {
    goal,
    reached,
    remaining,
    percent: Math.min(100, Math.round((reached / goal) * 100)),
    done: remaining === 0,
  };
}
