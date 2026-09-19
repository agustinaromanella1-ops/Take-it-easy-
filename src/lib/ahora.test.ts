import { describe, expect, it } from 'vitest';
import { enPalabras, nombrarDia, queSigue } from './ahora';
import type { Session } from '../types';

const ses = (id: string, date: string, time: string, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-09-19T09:00:00.000Z',
  patientId: 'p1',
  date,
  time,
  durationMin: 50,
  status: 'programada',
  fee: 3500000,
  chargeable: true,
  notes: '',
  ...extra,
});

const HOY = '2026-09-19';

describe('queSigue', () => {
  it('sin sesiones no inventa nada', () => {
    expect(queSigue([], HOY, 600)).toEqual({ tipo: 'sin_nada' });
  });

  it('avisa cuánto falta para la próxima de hoy', () => {
    const r = queSigue([ses('s1', HOY, '15:00')], HOY, 14 * 60 + 35);
    expect(r).toMatchObject({ tipo: 'hoy', faltanMin: 25 });
  });

  it('adentro de la sesión cuenta lo que falta para terminar, no para empezar', () => {
    const r = queSigue([ses('s1', HOY, '15:00')], HOY, 15 * 60 + 38);
    expect(r).toMatchObject({ tipo: 'en_sesion', faltanMin: 12 });
  });

  it('el último minuto de la sesión todavía es adentro', () => {
    expect(queSigue([ses('s1', HOY, '15:00')], HOY, 15 * 60 + 49).tipo).toBe('en_sesion');
    // A los 50 minutos ya terminó: sin nada más, el día está hecho.
    expect(queSigue([ses('s1', HOY, '15:00')], HOY, 15 * 60 + 50).tipo).toBe('terminaste');
  });

  it('elige la más próxima aunque esté cargada última', () => {
    const r = queSigue([ses('s1', HOY, '18:00'), ses('s2', HOY, '16:00')], HOY, 600);
    expect(r).toMatchObject({ tipo: 'hoy' });
    expect(r.tipo === 'hoy' && r.sesion.id).toBe('s2');
  });

  it('salta lo que ya se resolvió', () => {
    const r = queSigue(
      [ses('s1', HOY, '16:00', { status: 'realizada' }), ses('s2', HOY, '18:00')],
      HOY,
      17 * 60,
    );
    expect(r.tipo === 'hoy' && r.sesion.id).toBe('s2');
  });

  it('si ya pasó todo lo de hoy, lo dice como final y no como vacío', () => {
    const r = queSigue([ses('s1', HOY, '09:00', { status: 'realizada' })], HOY, 20 * 60);
    expect(r).toEqual({ tipo: 'terminaste' });
  });

  it('una cancelada sola no cuenta como día trabajado', () => {
    const r = queSigue([ses('s1', HOY, '09:00', { status: 'cancelada' })], HOY, 20 * 60);
    expect(r).toEqual({ tipo: 'sin_nada' });
  });

  it('mira hacia adelante cuando hoy no queda nada', () => {
    const r = queSigue([ses('s1', '2026-09-21', '10:00')], HOY, 20 * 60);
    expect(r).toMatchObject({ tipo: 'otro_dia', enDias: 2 });
  });

  it('no mira hacia atrás: una sesión vieja sin cerrar no es lo que sigue', () => {
    const r = queSigue([ses('s1', '2026-09-10', '10:00')], HOY, 8 * 60);
    expect(r).toEqual({ tipo: 'sin_nada' });
  });
});

describe('enPalabras', () => {
  it('redondea para arriba en vez de decir cero', () => {
    expect(enPalabras(0.4)).toBe('1 minuto');
    expect(enPalabras(0)).toBe('ya');
  });

  it('cuenta en minutos abajo de la hora', () => {
    expect(enPalabras(25)).toBe('25 minutos');
    expect(enPalabras(59)).toBe('59 minutos');
  });

  it('pasa a horas con el resto', () => {
    expect(enPalabras(60)).toBe('1 hora');
    expect(enPalabras(70)).toBe('1 hora y 10');
    expect(enPalabras(130)).toBe('2 horas y 10');
  });

  it('de tres horas en adelante deja de contar minutos', () => {
    expect(enPalabras(200)).toBe('3 horas');
    expect(enPalabras(400)).toBe('6 horas');
  });
});

describe('nombrarDia', () => {
  it('dice mañana en vez de la fecha', () => {
    expect(nombrarDia('2026-09-20', HOY)).toBe('mañana');
  });

  it('para el resto usa el día largo', () => {
    expect(nombrarDia('2026-09-22', HOY)).toContain('22');
  });
});
