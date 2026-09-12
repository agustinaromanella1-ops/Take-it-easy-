import { describe, expect, it } from 'vitest';
import type { Session } from '../types';
import { buildDayClose, emptyDecision, summarizeDayClose, type DayCloseDecision } from './dayclose';

function session(id: string, over: Partial<Session> = {}): Session {
  return {
    id,
    patientId: `pac-${id}`,
    date: '2026-03-10',
    time: '10:00',
    durationMin: 50,
    status: 'programada',
    fee: 3500000,
    chargeable: true,
    notes: '',
    ...over,
  };
}

function decisions(entries: Record<string, Partial<DayCloseDecision>>): Map<string, DayCloseDecision> {
  const map = new Map<string, DayCloseDecision>();
  for (const [id, d] of Object.entries(entries)) {
    map.set(id, { ...emptyDecision(true), ...d });
  }
  return map;
}

const FECHA = '2026-03-10';

describe('buildDayClose', () => {
  it('cierra las sesiones decididas', () => {
    const r = buildDayClose(
      [session('a'), session('b')],
      decisions({ a: { status: 'realizada' }, b: { status: 'ausente' } }),
      FECHA,
      'efectivo',
    );
    expect(r.updates).toEqual([
      { id: 'a', status: 'realizada', chargeable: true },
      { id: 'b', status: 'ausente', chargeable: true },
    ]);
  });

  it('deja intactas las sesiones sin decidir', () => {
    const r = buildDayClose([session('a'), session('b')], decisions({ a: { status: 'realizada' } }), FECHA, 'efectivo');
    expect(r.updates.map((u) => u.id)).toEqual(['a']);
  });

  it('no toca las sesiones que ya estaban cerradas', () => {
    // Un pago no está atado a una sesión, así que volver a cobrar una ya
    // cerrada duplicaría el cobro sin que se note.
    const r = buildDayClose(
      [session('ya', { status: 'realizada' })],
      decisions({ ya: { status: 'realizada', collected: true } }),
      FECHA,
      'efectivo',
    );
    expect(r.updates).toEqual([]);
    expect(r.payments).toEqual([]);
  });

  it('registra el cobro con el honorario de la sesión', () => {
    const r = buildDayClose(
      [session('a', { fee: 4200000 })],
      decisions({ a: { status: 'realizada', collected: true } }),
      FECHA,
      'transferencia',
    );
    expect(r.payments).toEqual([
      { patientId: 'pac-a', date: FECHA, amount: 4200000, method: 'transferencia', notes: 'Cobrado en el cierre del día' },
    ]);
  });

  it('cierra sin cobrar cuando no se marcó el cobro', () => {
    const r = buildDayClose([session('a')], decisions({ a: { status: 'realizada' } }), FECHA, 'efectivo');
    expect(r.updates).toHaveLength(1);
    expect(r.payments).toEqual([]);
  });

  it('no genera un pago por una sesión cancelada, aunque se marque cobrada', () => {
    const r = buildDayClose(
      [session('a')],
      decisions({ a: { status: 'cancelada', collected: true } }),
      FECHA,
      'efectivo',
    );
    expect(r.payments).toEqual([]);
  });

  it('no genera un pago por una ausencia sin cargo', () => {
    const r = buildDayClose(
      [session('a')],
      decisions({ a: { status: 'ausente', chargeable: false, collected: true } }),
      FECHA,
      'efectivo',
    );
    expect(r.updates[0]!.chargeable).toBe(false);
    expect(r.payments).toEqual([]);
  });

  it('sí genera un pago por una ausencia que se cobra', () => {
    const r = buildDayClose(
      [session('a')],
      decisions({ a: { status: 'ausente', chargeable: true, collected: true } }),
      FECHA,
      'efectivo',
    );
    expect(r.payments).toHaveLength(1);
    expect(r.payments[0]!.amount).toBe(3500000);
  });

  it('no genera un pago de importe cero', () => {
    const r = buildDayClose(
      [session('a', { fee: 0 })],
      decisions({ a: { status: 'realizada', collected: true } }),
      FECHA,
      'efectivo',
    );
    expect(r.payments).toEqual([]);
  });

  it('fecha el cobro el día que se cierra, no el de la sesión', () => {
    const r = buildDayClose(
      [session('a', { date: '2026-03-09' })],
      decisions({ a: { status: 'realizada', collected: true } }),
      '2026-03-10',
      'efectivo',
    );
    expect(r.payments[0]!.date).toBe('2026-03-10');
  });

  it('sin decisiones no cambia nada', () => {
    const r = buildDayClose([session('a'), session('b')], new Map(), FECHA, 'efectivo');
    expect(r.updates).toEqual([]);
    expect(r.payments).toEqual([]);
  });
});

describe('summarizeDayClose', () => {
  it('cuenta lo pendiente y lo ya decidido', () => {
    const s = summarizeDayClose(
      [session('a'), session('b'), session('c'), session('cerrada', { status: 'realizada' })],
      decisions({ a: { status: 'realizada' }, b: { status: 'ausente' } }),
    );
    expect(s.pending).toBe(3); // la ya cerrada no cuenta
    expect(s.decided).toBe(2);
    expect(s.attended).toBe(1);
    expect(s.absent).toBe(1);
  });

  it('suma lo facturado y lo cobrado por separado', () => {
    const s = summarizeDayClose(
      [session('a', { fee: 3000000 }), session('b', { fee: 4000000 })],
      decisions({ a: { status: 'realizada', collected: true }, b: { status: 'realizada' } }),
    );
    expect(s.billed).toBe(7000000);
    expect(s.collected).toBe(3000000);
  });

  it('una cancelada no suma a lo facturado', () => {
    const s = summarizeDayClose([session('a')], decisions({ a: { status: 'cancelada' } }));
    expect(s.billed).toBe(0);
    expect(s.cancelled).toBe(1);
  });

  it('una ausencia sin cargo no suma a lo facturado', () => {
    const s = summarizeDayClose([session('a')], decisions({ a: { status: 'ausente', chargeable: false } }));
    expect(s.billed).toBe(0);
  });

  it('sin nada decidido da todo en cero', () => {
    const s = summarizeDayClose([session('a')], new Map());
    expect(s).toMatchObject({ decided: 0, pending: 1, billed: 0, collected: 0 });
  });
});
