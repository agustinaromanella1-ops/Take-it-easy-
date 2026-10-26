import { describe, expect, it } from 'vitest';
import { cobroDeSesion, cobrosPorSesion } from './cobroDeSesion';
import type { Payment, Session } from '../types';

const HOY = '2026-10-26';

const ses = (id: string, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-10-26T09:00:00.000Z',
  patientId: 'p1',
  date: HOY,
  time: '10:00',
  durationMin: 50,
  status: 'realizada',
  fee: 3500000,
  chargeable: true,
  notes: '',
  ...extra,
});

const pago = (id: string, extra: Partial<Payment> = {}): Payment => ({
  id,
  updatedAt: '2026-10-26T09:00:00.000Z',
  patientId: 'p1',
  date: HOY,
  amount: 3500000,
  method: 'efectivo',
  notes: '',
  ...extra,
});

describe('cobroDeSesion', () => {
  it('sin cobros, la sesión no está paga', () => {
    expect(cobroDeSesion(ses('s1'), [])).toBeNull();
  });

  it('encuentra el cobro atado a esa sesión', () => {
    const p = pago('g1', { sessionId: 's1' });
    expect(cobroDeSesion(ses('s1'), [p])?.id).toBe('g1');
  });

  it('el cobro atado a OTRA sesión no cuenta', () => {
    const p = pago('g1', { sessionId: 's2' });
    expect(cobroDeSesion(ses('s1'), [p])).toBeNull();
  });

  it('acepta un cobro viejo sin vínculo que coincide en paciente, día e importe', () => {
    // Si no, todo lo cobrado antes de que el vínculo existiera aparecería
    // de golpe como impago.
    expect(cobroDeSesion(ses('s1'), [pago('g1')])?.id).toBe('g1');
  });

  it('pero no uno de otro día, de otro paciente ni de otro importe', () => {
    expect(cobroDeSesion(ses('s1'), [pago('g1', { date: '2026-10-25' })])).toBeNull();
    expect(cobroDeSesion(ses('s1'), [pago('g1', { patientId: 'p2' })])).toBeNull();
    expect(cobroDeSesion(ses('s1'), [pago('g1', { amount: 1000 })])).toBeNull();
  });

  it('el vínculo manda sobre la coincidencia', () => {
    const suelto = pago('viejo');
    const atado = pago('atado', { sessionId: 's1', amount: 9999 });
    expect(cobroDeSesion(ses('s1'), [suelto, atado])?.id).toBe('atado');
  });

  it('no ofrece un cobro que ya se llevó otra sesión', () => {
    expect(cobroDeSesion(ses('s1'), [pago('g1')], new Set(['g1']))).toBeNull();
  });
});

describe('cobrosPorSesion', () => {
  it('un cobro viejo no se lo quedan dos sesiones iguales', () => {
    // Dos sesiones del mismo paciente, el mismo día y por lo mismo, con UN
    // solo cobro cargado: una está paga y la otra no.
    const sesiones = [ses('s1'), ses('s2')];
    const r = cobrosPorSesion(sesiones, [pago('g1')]);
    expect(r.size).toBe(1);
  });

  it('con dos cobros viejos, una para cada una', () => {
    const r = cobrosPorSesion([ses('s1'), ses('s2')], [pago('g1'), pago('g2')]);
    expect(r.size).toBe(2);
    expect(r.get('s1')?.id).not.toBe(r.get('s2')?.id);
  });

  it('los atados se resuelven primero y no se los roba un suelto', () => {
    // Si 's2' se quedara con el cobro atado a 's1' por recorrer en orden,
    // 's1' quedaría impaga teniendo su propio cobro.
    const r = cobrosPorSesion([ses('s2'), ses('s1')], [pago('g1', { sessionId: 's1' })]);
    expect(r.get('s1')?.id).toBe('g1');
    expect(r.has('s2')).toBe(false);
  });

  it('sesiones sin cobro no aparecen', () => {
    expect(cobrosPorSesion([ses('s1')], []).size).toBe(0);
  });
});
