import { describe, expect, it } from 'vitest';
import { cobrosCSV, importeCSV, sesionesCSV } from './csv';
import type { AppData } from '../types';

const base: AppData = {
  version: 4,
  patients: [
    { id: 'p1', name: 'Ana Gómez', defaultFee: 3500000, frequency: 'semanal', status: 'activo',
      colorIndex: 0, email: '', phone: '', notes: '', kind: 'particular', createdAt: '2026-09-01',
      lastRaise: null, taxId: '', taxCondition: 'consumidor_final', fullName: '', memberId: '' },
  ],
  sessions: [
    { id: 's1', patientId: 'p1', date: '2026-09-17', time: '10:00', fee: 3500000, status: 'realizada', notes: 'Ok' },
    { id: 's2', patientId: 'p1', date: '2026-09-10', time: '09:00', fee: 3500000, status: 'cancelada', notes: '' },
  ],
  payments: [
    { id: 'g1', patientId: 'p1', date: '2026-09-17', amount: 3500050, method: 'efectivo', notes: '' },
  ],
  settings: { currency: '$', monthlyGoal: 0, chargeNoShowByDefault: false },
} as unknown as AppData;

describe('importeCSV', () => {
  it('usa coma decimal, que es lo que Excel en español suma', () => {
    expect(importeCSV(3500050)).toBe('35000,50');
    expect(importeCSV(3500000)).toBe('35000,00');
    expect(importeCSV(-1250)).toBe('-12,50');
    expect(importeCSV(0)).toBe('0,00');
  });
});

describe('planillas', () => {
  it('empiezan con el BOM, sin el cual Excel rompe los acentos', () => {
    expect(sesionesCSV(base).startsWith('﻿')).toBe(true);
    expect(cobrosCSV(base).startsWith('﻿')).toBe(true);
  });

  it('separan con punto y coma', () => {
    const [encabezado] = sesionesCSV(base).split('\r\n');
    expect(encabezado).toBe('﻿Fecha;Hora;Paciente;Estado;Honorario;Notas');
  });

  it('ordenan las sesiones por fecha, no por orden de carga', () => {
    const filas = sesionesCSV(base).split('\r\n').slice(1).filter(Boolean);
    expect(filas[0]).toContain('10/09/2026');
    expect(filas[1]).toContain('17/09/2026');
  });

  it('escriben el año, porque una planilla se guarda y se mira el año que viene', () => {
    expect(cobrosCSV(base)).toContain('17/09/2026');
  });

  it('escriben el medio de pago como se lee, no como se guarda', () => {
    expect(cobrosCSV(base)).toContain('Efectivo');
    expect(cobrosCSV(base)).not.toContain(';efectivo;');
  });

  it('traducen el estado en vez de escupir la palabra interna', () => {
    expect(sesionesCSV(base)).toContain('Realizada');
    expect(sesionesCSV(base)).not.toContain(';realizada;');
  });

  it('escapan el separador si aparece dentro de una nota', () => {
    const conPuntoYComa = {
      ...base,
      sessions: [{ ...base.sessions[0]!, notes: 'Vino; dijo que sigue' }],
    };
    expect(sesionesCSV(conPuntoYComa)).toContain('"Vino; dijo que sigue"');
  });

  it('escapan las comillas duplicándolas', () => {
    const conComillas = {
      ...base,
      sessions: [{ ...base.sessions[0]!, notes: 'Dijo "basta"' }],
    };
    expect(sesionesCSV(conComillas)).toContain('"Dijo ""basta"""');
  });

  it('no dejan que una nota se ejecute como fórmula en Excel', () => {
    const conFormula = {
      ...base,
      sessions: [{ ...base.sessions[0]!, notes: '=1+1' }],
    };
    expect(sesionesCSV(conFormula)).toContain(";'=1+1");
  });

  it('marcan también el + y el @, que también encabezan fórmulas', () => {
    const mas = { ...base, sessions: [{ ...base.sessions[0]!, notes: '+34;4' }] };
    const arroba = { ...base, sessions: [{ ...base.sessions[0]!, notes: '@SUM(A1)' }] };
    expect(sesionesCSV(mas)).toContain('"\'+34;4"');
    expect(sesionesCSV(arroba)).toContain(";'@SUM(A1)");
  });

  it('dejan los importes negativos como números', () => {
    expect(importeCSV(-1250)).toBe('-12,50');
    const devolucion = { ...base, payments: [{ ...base.payments[0]!, amount: -1250 }] };
    expect(cobrosCSV(devolucion)).toContain(';-12,50');
    expect(cobrosCSV(devolucion)).not.toContain("'-12,50");
  });

  it('no pierden la fila si el paciente ya no está', () => {
    const huerfana = { ...base, patients: [] };
    expect(cobrosCSV(huerfana)).toContain('Paciente borrado');
  });
});
