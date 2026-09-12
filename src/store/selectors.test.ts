import { describe, expect, it } from 'vitest';
import type { AppData, Patient, Payment, Session } from '../types';
import { emptyData } from '../lib/storage';
import {
  conflictingSessionIds,
  dashboardStats,
  isBillable,
  monthlySummaries,
  patientBalances,
  pendingReview,
  sessionsInRange,
  upcomingSessions,
} from './selectors';

function patient(id: string, over: Partial<Patient> = {}): Patient {
  return {
    id,
    name: `Paciente ${id}`,
    email: '',
    phone: '',
    defaultFee: 500000,
    status: 'activo',
    colorIndex: 0,
    frequency: 'semanal',
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function session(id: string, over: Partial<Session> = {}): Session {
  return {
    id,
    patientId: 'p1',
    date: '2026-03-10',
    time: '10:00',
    durationMin: 50,
    status: 'realizada',
    fee: 500000,
    chargeable: true,
    notes: '',
    ...over,
  };
}

function payment(id: string, over: Partial<Payment> = {}): Payment {
  return { id, patientId: 'p1', date: '2026-03-10', amount: 500000, method: 'efectivo', notes: '', ...over };
}

function build(over: Partial<AppData> = {}): AppData {
  return { ...emptyData(), ...over };
}

describe('isBillable', () => {
  it('cobra las sesiones realizadas', () => {
    expect(isBillable(session('s1', { status: 'realizada' }))).toBe(true);
  });

  it('cobra la ausencia solo si está marcada como cobrable', () => {
    expect(isBillable(session('s1', { status: 'ausente', chargeable: true }))).toBe(true);
    expect(isBillable(session('s1', { status: 'ausente', chargeable: false }))).toBe(false);
  });

  it('no cobra sesiones canceladas ni futuras', () => {
    expect(isBillable(session('s1', { status: 'cancelada', chargeable: true }))).toBe(false);
    expect(isBillable(session('s1', { status: 'programada' }))).toBe(false);
  });
});

describe('patientBalances', () => {
  it('calcula deuda como facturado menos pagado', () => {
    const data = build({
      patients: [patient('p1')],
      sessions: [session('s1'), session('s2', { date: '2026-03-17' })],
      payments: [payment('pay1', { amount: 500000 })],
    });
    const b = patientBalances(data).get('p1')!;
    expect(b.billed).toBe(1000000);
    expect(b.paid).toBe(500000);
    expect(b.balance).toBe(500000);
    expect(b.sessionsHeld).toBe(2);
  });

  it('un pago de más deja saldo a favor (negativo)', () => {
    const data = build({
      patients: [patient('p1')],
      sessions: [session('s1')],
      payments: [payment('pay1', { amount: 800000 })],
    });
    expect(patientBalances(data).get('p1')!.balance).toBe(-300000);
  });

  it('no cuenta las sesiones programadas: todavía no se deben', () => {
    const data = build({
      patients: [patient('p1')],
      sessions: [session('s1', { status: 'programada' })],
    });
    const b = patientBalances(data).get('p1')!;
    expect(b.billed).toBe(0);
    expect(b.sessionsHeld).toBe(0);
  });

  it('registra la última sesión facturable, no la más recién cargada', () => {
    const data = build({
      patients: [patient('p1')],
      sessions: [session('s1', { date: '2026-03-17' }), session('s2', { date: '2026-03-10' })],
    });
    expect(patientBalances(data).get('p1')!.lastSessionDate).toBe('2026-03-17');
  });

  it('aísla los saldos entre pacientes', () => {
    const data = build({
      patients: [patient('p1'), patient('p2')],
      sessions: [session('s1', { patientId: 'p1' }), session('s2', { patientId: 'p2', fee: 300000 })],
      payments: [payment('pay1', { patientId: 'p1', amount: 500000 })],
    });
    const balances = patientBalances(data);
    expect(balances.get('p1')!.balance).toBe(0);
    expect(balances.get('p2')!.balance).toBe(300000);
  });

  it('devuelve una entrada en cero para un paciente sin movimientos', () => {
    const b = patientBalances(build({ patients: [patient('p1')] })).get('p1')!;
    expect(b.balance).toBe(0);
    expect(b.lastSessionDate).toBeNull();
  });
});

describe('monthlySummaries', () => {
  it('separa facturado de cobrado y los agrupa por mes', () => {
    const data = build({
      patients: [patient('p1')],
      sessions: [
        session('s1', { date: '2026-03-10' }),
        session('s2', { date: '2026-04-10' }),
        session('s3', { date: '2026-03-11', status: 'ausente', chargeable: false }),
        session('s4', { date: '2026-03-12', status: 'cancelada' }),
      ],
      payments: [payment('pay1', { date: '2026-04-05', amount: 200000 })],
    });
    const months = monthlySummaries(data);
    expect(months.get('2026-03')!.billed).toBe(500000);
    expect(months.get('2026-03')!.sessionsHeld).toBe(1);
    expect(months.get('2026-03')!.noShows).toBe(1);
    expect(months.get('2026-03')!.cancellations).toBe(1);
    expect(months.get('2026-03')!.collected).toBe(0);
    expect(months.get('2026-04')!.billed).toBe(500000);
    // Un pago de abril por una sesión de marzo cuenta como cobro de abril.
    expect(months.get('2026-04')!.collected).toBe(200000);
  });
});

describe('sessionsInRange y upcomingSessions', () => {
  const data = build({
    patients: [patient('p1')],
    sessions: [
      session('s1', { date: '2026-03-10', time: '15:00', status: 'programada' }),
      session('s2', { date: '2026-03-10', time: '09:00', status: 'programada' }),
      session('s3', { date: '2026-03-20', status: 'programada' }),
      session('s4', { date: '2026-03-09', status: 'programada' }),
    ],
  });

  it('respeta los límites inclusive y ordena por fecha y hora', () => {
    const rows = sessionsInRange(data.sessions, '2026-03-09', '2026-03-10');
    expect(rows.map((s) => s.id)).toEqual(['s4', 's2', 's1']);
  });

  it('solo trae turnos programados de la ventana pedida', () => {
    const rows = upcomingSessions(data.sessions, 7, '2026-03-10');
    expect(rows.map((s) => s.id)).toEqual(['s2', 's1']);
  });

  it('excluye las que ya se cerraron', () => {
    const closed = [session('x', { date: '2026-03-11', status: 'realizada' })];
    expect(upcomingSessions(closed, 7, '2026-03-10')).toHaveLength(0);
  });
});

describe('pendingReview', () => {
  it('encuentra sesiones pasadas que siguen programadas', () => {
    const sessions = [
      session('viejo', { date: '2026-03-01', status: 'programada' }),
      session('hoy', { date: '2026-03-10', status: 'programada' }),
      session('futuro', { date: '2026-03-20', status: 'programada' }),
      session('cerrado', { date: '2026-03-01', status: 'realizada' }),
    ];
    const rows = pendingReview(sessions, '2026-03-10');
    expect(rows.map((s) => s.id)).toEqual(['viejo']);
  });
});

describe('conflictingSessionIds', () => {
  it('marca dos turnos que se pisan', () => {
    const ids = conflictingSessionIds([
      session('a', { time: '10:00', durationMin: 50 }),
      session('b', { time: '10:30', durationMin: 50 }),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b']);
  });

  it('no marca turnos consecutivos', () => {
    const ids = conflictingSessionIds([
      session('a', { time: '10:00', durationMin: 50 }),
      session('b', { time: '10:50', durationMin: 50 }),
    ]);
    expect(ids.size).toBe(0);
  });

  it('no marca la misma hora en días distintos', () => {
    const ids = conflictingSessionIds([
      session('a', { date: '2026-03-10', time: '10:00' }),
      session('b', { date: '2026-03-11', time: '10:00' }),
    ]);
    expect(ids.size).toBe(0);
  });

  it('ignora las canceladas: el horario quedó libre', () => {
    const ids = conflictingSessionIds([
      session('a', { time: '10:00' }),
      session('b', { time: '10:10', status: 'cancelada' }),
    ]);
    expect(ids.size).toBe(0);
  });

  it('detecta un choque a tres bandas', () => {
    const ids = conflictingSessionIds([
      session('a', { time: '10:00', durationMin: 90 }),
      session('b', { time: '10:30', durationMin: 30 }),
      session('c', { time: '11:00', durationMin: 30 }),
    ]);
    expect([...ids].sort()).toEqual(['a', 'b', 'c']);
  });
});

describe('dashboardStats', () => {
  it('agrega los indicadores del mes de referencia', () => {
    const data = build({
      patients: [patient('p1'), patient('p2', { status: 'inactivo' })],
      sessions: [
        session('s1', { date: '2026-03-10' }),
        session('s2', { date: '2026-03-12', status: 'programada' }),
        session('s3', { date: '2026-02-10' }),
      ],
      payments: [payment('pay1', { date: '2026-03-11', amount: 200000 })],
    });
    const stats = dashboardStats(data, '2026-03-10');
    expect(stats.monthBilled).toBe(500000);
    expect(stats.monthCollected).toBe(200000);
    expect(stats.outstanding).toBe(800000); // 1.000.000 facturado total - 200.000 pagado
    expect(stats.activePatients).toBe(1);
    expect(stats.sessionsThisWeek).toBe(2); // s1 (hoy) y s2; s3 quedó en febrero
    expect(stats.debtors).toHaveLength(1);
  });

  it('no rompe con datos vacíos', () => {
    const stats = dashboardStats(emptyData(), '2026-03-10');
    expect(stats.monthBilled).toBe(0);
    expect(stats.outstanding).toBe(0);
    expect(stats.debtors).toEqual([]);
  });
});
