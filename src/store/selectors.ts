import type { AppData, Cents, Patient, Payment, Session } from '../types';
import { addDays, daysBetween, monthKey, overlaps, timeToMinutes, today } from '../lib/dates';

/**
 * Derivaciones sobre los datos. Todas son funciones puras y O(n) sobre lo que
 * necesitan, construyendo índices por id en vez de hacer `find` adentro de un
 * `map` (lo que daría O(n·m) y se nota con pocos cientos de sesiones).
 */

/** Una sesión genera deuda si se realizó, o si fue ausencia cobrable. */
export function isBillable(s: Session): boolean {
  return s.status === 'realizada' || (s.status === 'ausente' && s.chargeable);
}

export function billedTotal(sessions: Session[]): Cents {
  let total = 0;
  for (const s of sessions) if (isBillable(s)) total += s.fee;
  return total;
}

export function paidTotal(payments: Payment[]): Cents {
  let total = 0;
  for (const p of payments) total += p.amount;
  return total;
}

export interface PatientBalance {
  patient: Patient;
  billed: Cents;
  paid: Cents;
  /** Positivo = el paciente debe. Negativo = pagó de más (crédito a favor). */
  balance: Cents;
  sessionsHeld: number;
  lastSessionDate: string | null;
}

/**
 * Saldo de cada paciente en una sola pasada por sesiones y pagos.
 * Devuelve un Map para que quien lo use consulte por id en O(1).
 */
export function patientBalances(data: AppData): Map<string, PatientBalance> {
  const result = new Map<string, PatientBalance>();
  for (const patient of data.patients) {
    result.set(patient.id, {
      patient,
      billed: 0,
      paid: 0,
      balance: 0,
      sessionsHeld: 0,
      lastSessionDate: null,
    });
  }

  for (const s of data.sessions) {
    const entry = result.get(s.patientId);
    if (!entry) continue;
    if (!isBillable(s)) continue;
    entry.billed += s.fee;
    entry.sessionsHeld += 1;
    if (entry.lastSessionDate === null || s.date > entry.lastSessionDate) {
      entry.lastSessionDate = s.date;
    }
  }

  for (const p of data.payments) {
    const entry = result.get(p.patientId);
    if (!entry) continue;
    entry.paid += p.amount;
  }

  for (const entry of result.values()) {
    entry.balance = entry.billed - entry.paid;
  }
  return result;
}

export interface MonthSummary {
  key: string;
  billed: Cents;
  collected: Cents;
  sessionsHeld: number;
  noShows: number;
  cancellations: number;
}

/** Resumen mes a mes, indexado por "YYYY-MM". */
export function monthlySummaries(data: AppData): Map<string, MonthSummary> {
  const months = new Map<string, MonthSummary>();
  const ensure = (key: string): MonthSummary => {
    let m = months.get(key);
    if (!m) {
      m = { key, billed: 0, collected: 0, sessionsHeld: 0, noShows: 0, cancellations: 0 };
      months.set(key, m);
    }
    return m;
  };

  for (const s of data.sessions) {
    const m = ensure(monthKey(s.date));
    if (isBillable(s)) m.billed += s.fee;
    if (s.status === 'realizada') m.sessionsHeld += 1;
    if (s.status === 'ausente') m.noShows += 1;
    if (s.status === 'cancelada') m.cancellations += 1;
  }

  for (const p of data.payments) {
    ensure(monthKey(p.date)).collected += p.amount;
  }

  return months;
}

export function emptyMonthSummary(key: string): MonthSummary {
  return { key, billed: 0, collected: 0, sessionsHeld: 0, noShows: 0, cancellations: 0 };
}

/** Sesiones de un rango de fechas (inclusive), ordenadas por fecha y hora. */
export function sessionsInRange(sessions: Session[], from: string, to: string): Session[] {
  return sessions
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => (a.date === b.date ? timeToMinutes(a.time) - timeToMinutes(b.time) : a.date < b.date ? -1 : 1));
}

/** Próximos turnos programados, de hoy en adelante. */
export function upcomingSessions(sessions: Session[], days: number, from = today()): Session[] {
  const to = addDays(from, days);
  return sessionsInRange(sessions, from, to).filter((s) => s.status === 'programada');
}

/**
 * Sesiones que ya pasaron pero siguen marcadas como "programada".
 * Son el agujero más común en este tipo de app: si no se cierran, la
 * facturación queda subestimada sin que nadie lo note.
 */
export function pendingReview(sessions: Session[], from = today()): Session[] {
  return sessions
    .filter((s) => s.status === 'programada' && s.date < from)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Turnos del mismo día que se superponen entre sí. Devuelve los ids involucrados. */
export function conflictingSessionIds(sessions: Session[]): Set<string> {
  const byDate = new Map<string, Session[]>();
  for (const s of sessions) {
    if (s.status === 'cancelada') continue;
    const list = byDate.get(s.date);
    if (list) list.push(s);
    else byDate.set(s.date, [s]);
  }

  const conflicts = new Set<string>();
  for (const list of byDate.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i]!;
      // Solo hace falta comparar con los siguientes mientras arranquen antes de
      // que `a` termine; al estar ordenado, el primero que no se pisa corta el bucle.
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j]!;
        if (timeToMinutes(b.time) >= timeToMinutes(a.time) + a.durationMin) break;
        if (overlaps(timeToMinutes(a.time), a.durationMin, timeToMinutes(b.time), b.durationMin)) {
          conflicts.add(a.id);
          conflicts.add(b.id);
        }
      }
    }
  }
  return conflicts;
}

export interface DashboardStats {
  monthBilled: Cents;
  monthCollected: Cents;
  outstanding: Cents;
  activePatients: number;
  sessionsThisWeek: number;
  pendingReviewCount: number;
  debtors: PatientBalance[];
}

export function dashboardStats(data: AppData, ref = today()): DashboardStats {
  const balances = patientBalances(data);
  const month = monthlySummaries(data).get(monthKey(ref)) ?? emptyMonthSummary(monthKey(ref));

  let outstanding = 0;
  const debtors: PatientBalance[] = [];
  for (const entry of balances.values()) {
    if (entry.balance > 0) {
      outstanding += entry.balance;
      debtors.push(entry);
    }
  }
  debtors.sort((a, b) => b.balance - a.balance);

  let sessionsThisWeek = 0;
  for (const s of data.sessions) {
    if (s.status === 'cancelada') continue;
    const diff = daysBetween(ref, s.date);
    if (diff >= 0 && diff < 7) sessionsThisWeek += 1;
  }

  return {
    monthBilled: month.billed,
    monthCollected: month.collected,
    outstanding,
    activePatients: data.patients.reduce((n, p) => n + (p.status === 'activo' ? 1 : 0), 0),
    sessionsThisWeek,
    pendingReviewCount: pendingReview(data.sessions, ref).length,
    debtors,
  };
}
