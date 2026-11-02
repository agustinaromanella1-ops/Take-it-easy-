import { describe, expect, it } from 'vitest';
import {
  esAccionAviso,
  estadoDeAccion,
  faltaDelDia,
  hayQueAvisar,
  horaDelCierre,
  momentoQueCorresponde,
  momentosDelDia,
  textoRecordatorio,
  type Faltante,
} from './recordatorios';
import type { AppData, Payment, Session } from '../types';

const HOY = '2026-09-21';

const sesion = (id: string, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId: 'p1',
  date: HOY,
  time: '10:00',
  durationMin: 50,
  status: 'programada',
  fee: 5000000,
  chargeable: true,
  notes: '',
  ...extra,
});

const pago = (id: string, extra: Partial<Payment> = {}): Payment => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId: 'p1',
  date: HOY,
  amount: 5000000,
  method: 'efectivo',
  notes: '',
  ...extra,
});

const datos = (sessions: Session[], payments: Payment[] = []): AppData =>
  ({ sessions, payments, patients: [] }) as unknown as AppData;

const falta = (extra: Partial<Faltante> = {}): Faltante => ({
  sinMarcar: 0,
  sinCobrar: 0,
  unicaSinMarcar: null,
  horaUnica: null,
  ...extra,
});

describe('la hora del cierre', () => {
  it('cae media hora después de la última sesión', () => {
    // Última de 17:00 a 17:50 -> 18:20, pero el piso son las 18:30.
    expect(horaDelCierre([sesion('a', { time: '17:00' })])).toBe(18 * 60 + 30);
    expect(horaDelCierre([sesion('a', { time: '19:00' })])).toBe(20 * 60 + 20);
  });

  it('no pasa de las 22:00 aunque se atienda tardísimo', () => {
    expect(horaDelCierre([sesion('a', { time: '22:00' })])).toBe(22 * 60);
  });

  it('sin sesiones toma una hora razonable', () => {
    expect(horaDelCierre([])).toBe(21 * 60);
  });
});

describe('los momentos de cada nivel', () => {
  const tarde = [sesion('a', { time: '20:00' })]; // cierre a las 20:50

  it('la nula no tiene ninguno', () => {
    expect(momentosDelDia('nula', tarde)).toEqual([]);
  });

  it('la baja tiene solo el cierre', () => {
    const m = momentosDelDia('baja', tarde);
    expect(m).toHaveLength(1);
    expect(m[0]!.tipo).toBe('cierre');
  });

  it('la media tiene uno de cada cosa y el cierre', () => {
    const m = momentosDelDia('media', tarde);
    expect(m.map((x) => x.tipo)).toEqual(['cobrar', 'marcar', 'cierre']);
  });

  it('la alta tiene dos de marcar, tres de cobrar y el cierre', () => {
    const m = momentosDelDia('alta', tarde);
    expect(m.filter((x) => x.tipo === 'marcar')).toHaveLength(2);
    expect(m.filter((x) => x.tipo === 'cobrar')).toHaveLength(3);
    expect(m.filter((x) => x.tipo === 'cierre')).toHaveLength(1);
  });

  it('descarta lo que caiga después del cierre, para no avisar dos veces lo mismo', () => {
    // Consultorio que termina a las 15:00: el cierre va a las 18:30 y las
    // horas de la noche no tienen sentido.
    const temprano = [sesion('a', { time: '14:00' })];
    const m = momentosDelDia('alta', temprano);
    expect(Math.max(...m.map((x) => x.minutos))).toBe(18 * 60 + 30);
    expect(m.some((x) => x.minutos === 20 * 60)).toBe(false);
  });

  it('salen ordenados por hora', () => {
    const m = momentosDelDia('alta', tarde);
    expect(m.map((x) => x.minutos)).toEqual([...m.map((x) => x.minutos)].sort((a, b) => a - b));
  });
});

describe('cuál corresponde ahora', () => {
  const m = momentosDelDia('alta', [sesion('a', { time: '20:00' })]);

  it('ninguno antes de la primera hora', () => {
    expect(momentoQueCorresponde(m, 9 * 60, new Set()).ahora).toBeNull();
  });

  it('el de las 11 a las 11:40, porque abrir tarde no lo invalida', () => {
    expect(momentoQueCorresponde(m, 11 * 60 + 40, new Set()).ahora?.id).toBe('cobrar@660');
  });

  it('pasada la ventana ya no sale', () => {
    expect(momentoQueCorresponde(m, 13 * 60, new Set()).ahora).toBeNull();
  });

  it('abrir a la noche no dispara la pila del día entero', () => {
    // El cierre de este día cae 21:20 (última sesión 20:00 + 50 + 30).
    const { ahora, vencidos } = momentoQueCorresponde(m, 21 * 60 + 30, new Set());
    // Sale uno solo —el cierre, que es de hace poco— y el resto se da por
    // vencido para que no salten más tarde todos juntos.
    expect(ahora?.tipo).toBe('cierre');
    expect(vencidos.length).toBeGreaterThan(1);
  });

  it('abrir mucho después no dispara nada, pero igual da todo por vencido', () => {
    const { ahora, vencidos } = momentoQueCorresponde(m, 23 * 60 + 30, new Set());
    expect(ahora).toBeNull();
    expect(vencidos).toHaveLength(m.length);
  });

  it('no repite lo ya hecho', () => {
    const hechos = new Set(m.map((x) => x.id));
    expect(momentoQueCorresponde(m, 21 * 60 + 30, hechos).ahora).toBeNull();
  });
});

describe('qué falta del día', () => {
  it('no cuenta una sesión que todavía está pasando', () => {
    const d = datos([sesion('a', { time: '10:00', durationMin: 50 })]);
    expect(faltaDelDia(d, HOY, 10 * 60 + 30).sinMarcar).toBe(0);
    expect(faltaDelDia(d, HOY, 10 * 60 + 50).sinMarcar).toBe(1);
  });

  it('cuenta como sin cobrar lo que factura y no tiene pago', () => {
    const d = datos([sesion('a', { time: '10:00', status: 'realizada' })]);
    expect(faltaDelDia(d, HOY, 23 * 60).sinCobrar).toBe(1);
  });

  it('el cobro atado a la sesión la saca de la cuenta', () => {
    const d = datos(
      [sesion('a', { time: '10:00', status: 'realizada' })],
      [pago('g1', { sessionId: 'a' })],
    );
    expect(faltaDelDia(d, HOY, 23 * 60).sinCobrar).toBe(0);
  });

  it('una cancelada no se cobra ni se marca', () => {
    const d = datos([sesion('a', { time: '10:00', status: 'cancelada' })]);
    const f = faltaDelDia(d, HOY, 23 * 60);
    expect(f.sinMarcar).toBe(0);
    expect(f.sinCobrar).toBe(0);
  });

  it('una ausencia que no se cobra tampoco entra', () => {
    const d = datos([sesion('a', { time: '10:00', status: 'ausente', chargeable: false })]);
    expect(faltaDelDia(d, HOY, 23 * 60).sinCobrar).toBe(0);
  });

  it('señala la única sin marcar, para poder preguntar por ella', () => {
    const d = datos([
      sesion('a', { time: '10:00' }),
      sesion('b', { time: '11:00', status: 'realizada' }),
    ]);
    const f = faltaDelDia(d, HOY, 23 * 60);
    expect(f.unicaSinMarcar).toBe('a');
    expect(f.horaUnica).toBe('10:00');
  });

  it('con dos sin marcar no señala ninguna', () => {
    const d = datos([sesion('a', { time: '10:00' }), sesion('b', { time: '11:00' })]);
    expect(faltaDelDia(d, HOY, 23 * 60).unicaSinMarcar).toBeNull();
  });

  it('ignora los otros días', () => {
    const d = datos([sesion('a', { date: '2026-09-20' })]);
    expect(faltaDelDia(d, HOY, 23 * 60).sinMarcar).toBe(0);
  });
});

describe('no se avisa de nada', () => {
  it('sin nada que marcar no sale el de marcar', () => {
    expect(hayQueAvisar('marcar', falta({ sinCobrar: 3 }))).toBe(false);
  });

  it('sin nada que cobrar no sale el de cobrar', () => {
    expect(hayQueAvisar('cobrar', falta({ sinMarcar: 3 }))).toBe(false);
  });

  it('el cierre sale si hay cualquiera de las dos', () => {
    expect(hayQueAvisar('cierre', falta({ sinMarcar: 1 }))).toBe(true);
    expect(hayQueAvisar('cierre', falta({ sinCobrar: 1 }))).toBe(true);
    expect(hayQueAvisar('cierre', falta())).toBe(false);
  });
});

describe('el texto', () => {
  it('nunca nombra al paciente', () => {
    const f = falta({ sinMarcar: 1, unicaSinMarcar: 's1', horaUnica: '14:00' });
    for (const tipo of ['marcar', 'cobrar', 'cierre'] as const) {
      const t = textoRecordatorio(tipo, { ...f, sinCobrar: 2 });
      expect(`${t.titulo} ${t.cuerpo}`).not.toMatch(/paciente|Ana|Gómez/i);
    }
  });

  it('con una sola sin marcar pregunta por ella y lleva botones', () => {
    const t = textoRecordatorio('marcar', falta({ sinMarcar: 1, unicaSinMarcar: 's1', horaUnica: '14:00' }));
    expect(t.titulo).toContain('14:00');
    expect(t.sesion).toBe('s1');
  });

  it('con varias no lleva botones, porque no se sabría de quién', () => {
    const t = textoRecordatorio('marcar', falta({ sinMarcar: 3 }));
    expect(t.sesion).toBeNull();
    expect(t.titulo).toContain('3');
  });

  it('el cierre junta las dos cuentas', () => {
    const t = textoRecordatorio('cierre', falta({ sinMarcar: 2, sinCobrar: 1 }));
    expect(t.cuerpo).toContain('2 sin marcar');
    expect(t.cuerpo).toContain('1 sin cobrar');
  });

  it('el cierre no nombra lo que no quedó', () => {
    const t = textoRecordatorio('cierre', falta({ sinCobrar: 1 }));
    expect(t.cuerpo).not.toContain('marcar');
  });

  it('el singular y el plural', () => {
    expect(textoRecordatorio('cobrar', falta({ sinCobrar: 1 })).titulo).toBe('Una sesión de hoy sin cobrar');
    expect(textoRecordatorio('cobrar', falta({ sinCobrar: 2 })).titulo).toBe('2 sesiones de hoy sin cobrar');
  });
});

describe('las respuestas de la notificación', () => {
  it('cada una lleva a su estado', () => {
    expect(estadoDeAccion('vino')).toBe('realizada');
    expect(estadoDeAccion('falto')).toBe('ausente');
    expect(estadoDeAccion('cancelo')).toBe('cancelada');
  });

  it('reagendó no tiene estado: necesita una fecha', () => {
    expect(estadoDeAccion('reagendo')).toBeNull();
  });

  it('no se acepta cualquier cosa que venga en la URL', () => {
    expect(esAccionAviso('vino')).toBe(true);
    expect(esAccionAviso('borrar')).toBe(false);
    expect(esAccionAviso('')).toBe(false);
  });
});
