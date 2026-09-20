import { describe, expect, it } from 'vitest';
import { sesionesPorAvisar, textoAviso } from './aviso';
import type { Session } from '../types';

const HOY = '2026-09-19';
const ses = (id: string, time: string, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-09-19T09:00:00.000Z',
  patientId: 'p1',
  date: HOY,
  time,
  durationMin: 50,
  status: 'programada',
  fee: 3500000,
  chargeable: true,
  notes: '',
  ...extra,
});

const nadie = new Set<string>();

describe('sesionesPorAvisar', () => {
  it('apagado no avisa nada', () => {
    expect(sesionesPorAvisar([ses('s1', '15:00')], HOY, 14 * 60 + 55, 0, nadie)).toEqual([]);
  });

  it('avisa cuando entra en la ventana', () => {
    const r = sesionesPorAvisar([ses('s1', '15:00')], HOY, 14 * 60 + 52, 10, nadie);
    expect(r.map((s) => s.id)).toEqual(['s1']);
  });

  it('todavía no avisa si falta más que eso', () => {
    expect(sesionesPorAvisar([ses('s1', '15:00')], HOY, 14 * 60 + 40, 10, nadie)).toEqual([]);
  });

  it('no avisa dos veces la misma', () => {
    expect(sesionesPorAvisar([ses('s1', '15:00')], HOY, 14 * 60 + 52, 10, new Set(['s1']))).toEqual([]);
  });

  it('tolera unos minutos de atraso, por si la app estaba dormida', () => {
    expect(sesionesPorAvisar([ses('s1', '15:00')], HOY, 15 * 60 + 1, 10, nadie).length).toBe(1);
  });

  it('pero no avisa de algo que ya arrancó hace rato', () => {
    expect(sesionesPorAvisar([ses('s1', '15:00')], HOY, 15 * 60 + 20, 10, nadie)).toEqual([]);
  });

  it('ignora lo que ya se resolvió', () => {
    const r = sesionesPorAvisar([ses('s1', '15:00', { status: 'cancelada' })], HOY, 14 * 60 + 52, 10, nadie);
    expect(r).toEqual([]);
  });

  it('ignora los otros días', () => {
    const r = sesionesPorAvisar([ses('s1', '15:00', { date: '2026-09-20' })], HOY, 14 * 60 + 52, 10, nadie);
    expect(r).toEqual([]);
  });

  it('avisa de las dos si se superponen', () => {
    const r = sesionesPorAvisar([ses('s1', '15:00'), ses('s2', '15:00')], HOY, 14 * 60 + 55, 10, nadie);
    expect(r.length).toBe(2);
  });
});

describe('textoAviso', () => {
  it('dice cuánto falta', () => {
    expect(textoAviso(10).titulo).toBe('Sesión en 10 minutos');
    expect(textoAviso(1).titulo).toBe('Sesión en 1 minuto');
  });

  it('cuando ya es la hora lo dice de otra forma', () => {
    expect(textoAviso(0).titulo).toBe('Empieza tu sesión');
    expect(textoAviso(-1).titulo).toBe('Empieza tu sesión');
  });

  it('NUNCA nombra al paciente: el aviso se ve en la pantalla bloqueada', () => {
    // Si algún día alguien quiere "personalizarlo", que esta prueba lo frene.
    const todos = [textoAviso(30), textoAviso(5), textoAviso(0)];
    for (const t of todos) {
      expect(`${t.titulo} ${t.cuerpo}`).not.toMatch(/Ana|Gómez|paciente/i);
    }
  });
});
