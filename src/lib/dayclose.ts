import type { Cents, DateISO, PaymentMethod, Session } from '../types';
import { isBillable } from '../store/selectors';

/**
 * Cierre del día: repasar las sesiones de la jornada y dejarlas resueltas.
 *
 * El cierre trabaja SOLO sobre las sesiones que siguen en "programada". Las que
 * ya se cerraron antes se muestran para dar contexto, pero sin controles: un
 * pago no está atado a una sesión concreta —el saldo del paciente es la suma de
 * lo facturado menos lo pagado— así que volver a ofrecer "cobrar" sobre una
 * sesión ya cerrada registraría un cobro duplicado sin que se note.
 */

/** Qué se decidió para una sesión. `null` en `status` es "todavía sin decidir". */
export interface DayCloseDecision {
  status: Exclude<Session['status'], 'programada'> | null;
  /** Solo aplica a `ausente`: si esa ausencia se cobra. */
  chargeable: boolean;
  /** Si además de cerrarla se registra el cobro del honorario. */
  collected: boolean;
}

export function emptyDecision(chargeNoShowByDefault: boolean): DayCloseDecision {
  return { status: null, chargeable: chargeNoShowByDefault, collected: false };
}

export interface DayCloseResult {
  updates: { id: string; status: Session['status']; chargeable: boolean }[];
  payments: { patientId: string; date: DateISO; amount: Cents; method: PaymentMethod; notes: string }[];
}

export interface DayCloseSummary {
  /** Sesiones pendientes que quedaron decididas. */
  decided: number;
  /** Pendientes en total, decididas o no. */
  pending: number;
  attended: number;
  absent: number;
  cancelled: number;
  /** Lo que se factura con este cierre. */
  billed: Cents;
  /** De eso, lo que se cobra en el momento. */
  collected: Cents;
}

/**
 * Traduce las decisiones a los cambios que hay que aplicar.
 *
 * Solo genera un cobro cuando la sesión efectivamente factura: marcar "cobrado"
 * en una cancelada o en una ausencia sin cargo no debe crear un pago de la nada.
 */
export function buildDayClose(
  sessions: Session[],
  decisions: Map<string, DayCloseDecision>,
  date: DateISO,
  method: PaymentMethod,
): DayCloseResult {
  const result: DayCloseResult = { updates: [], payments: [] };

  for (const session of sessions) {
    if (session.status !== 'programada') continue;
    const decision = decisions.get(session.id);
    if (!decision || decision.status === null) continue;

    const chargeable = decision.status === 'ausente' ? decision.chargeable : session.chargeable;
    result.updates.push({ id: session.id, status: decision.status, chargeable });

    const closed: Session = { ...session, status: decision.status, chargeable };
    if (decision.collected && isBillable(closed) && closed.fee > 0) {
      result.payments.push({
        patientId: session.patientId,
        date,
        amount: closed.fee,
        method,
        notes: 'Cobrado en el cierre del día',
      });
    }
  }

  return result;
}

/** Números que se muestran mientras se arma el cierre, antes de confirmarlo. */
export function summarizeDayClose(
  sessions: Session[],
  decisions: Map<string, DayCloseDecision>,
): DayCloseSummary {
  const summary: DayCloseSummary = {
    decided: 0,
    pending: 0,
    attended: 0,
    absent: 0,
    cancelled: 0,
    billed: 0,
    collected: 0,
  };

  for (const session of sessions) {
    if (session.status !== 'programada') continue;
    summary.pending += 1;

    const decision = decisions.get(session.id);
    if (!decision || decision.status === null) continue;
    summary.decided += 1;

    if (decision.status === 'realizada') summary.attended += 1;
    if (decision.status === 'ausente') summary.absent += 1;
    if (decision.status === 'cancelada') summary.cancelled += 1;

    const chargeable = decision.status === 'ausente' ? decision.chargeable : session.chargeable;
    const closed: Session = { ...session, status: decision.status, chargeable };
    if (isBillable(closed)) {
      summary.billed += closed.fee;
      if (decision.collected) summary.collected += closed.fee;
    }
  }

  return summary;
}
