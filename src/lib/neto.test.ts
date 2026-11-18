import { describe, expect, it } from 'vitest';
import { hayRetenciones, repartir, repartoDelMes, repartoDePaciente, retencionPromedio } from './neto';
import { suggestedRate } from './pricing';
import type { AppData, Patient, Session } from '../types';

const paciente = (id: string, pct = 0): Patient => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: `Paciente ${id}`,
  email: '',
  phone: '',
  defaultFee: 5000000,
  status: 'activo',
  colorIndex: 0,
  frequency: 'semanal',
  kind: 'institucion',
  legalName: '',
  document: '',
  taxId: '',
  taxCondition: 'consumidor_final',
  memberNumber: '',
  insurer: '',
  institutionPercent: pct,
  lastRaise: null,
  notes: '',
  createdAt: '2026-01-01',
});

const sesion = (id: string, patientId: string, date: string, fee: number, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId,
  date,
  time: '10:00',
  durationMin: 50,
  status: 'realizada',
  fee,
  chargeable: true,
  notes: '',
  ...extra,
});

const datos = (patients: Patient[], sessions: Session[]): AppData =>
  ({ patients, sessions, payments: [] }) as unknown as AppData;

describe('repartir', () => {
  it('sin porcentaje queda todo', () => {
    expect(repartir(5000000, 0)).toEqual({ bruto: 5000000, retenido: 0, neto: 5000000 });
  });

  it('con 30% retiene 30 y deja 70', () => {
    expect(repartir(5000000, 30)).toEqual({ bruto: 5000000, retenido: 1500000, neto: 3500000 });
  });

  it('las dos partes siempre suman el total, aunque el porcentaje no sea redondo', () => {
    // 33% de 4250050 no da un centavo entero: lo neto se calcula restando, así
    // que no se puede perder ni inventar un centavo.
    const r = repartir(4250050, 33);
    expect(r.retenido + r.neto).toBe(4250050);
    expect(r.retenido).toBe(Math.round(4250050 * 0.33));
  });

  it('un porcentaje fuera de rango no deja al profesional trabajando gratis', () => {
    expect(repartir(5000000, 100).neto).toBe(50000);
    expect(repartir(5000000, 150).neto).toBe(50000);
    expect(repartir(5000000, -10)).toEqual({ bruto: 5000000, retenido: 0, neto: 5000000 });
  });

  it('sobre cero no hay nada que repartir', () => {
    expect(repartir(0, 50)).toEqual({ bruto: 0, retenido: 0, neto: 0 });
  });
});

describe('el reparto de un mes', () => {
  it('suma sesión por sesión, porque cada paciente tiene su porcentaje', () => {
    // Un promedio mentiría: 50% de 100.000 más 0% de 100.000 no es 25% de todo
    // si las sesiones no valen lo mismo.
    const d = datos(
      [paciente('p1', 50), paciente('p2', 0)],
      [sesion('a', 'p1', '2026-11-04', 10000000), sesion('b', 'p2', '2026-11-05', 2000000)],
    );
    expect(repartoDelMes(d, '2026-11')).toEqual({ bruto: 12000000, retenido: 5000000, neto: 7000000 });
  });

  it('ignora los otros meses', () => {
    const d = datos([paciente('p1', 50)], [sesion('a', 'p1', '2026-10-04', 10000000)]);
    expect(repartoDelMes(d, '2026-11').bruto).toBe(0);
  });

  it('una sesión que no factura no reparte nada', () => {
    const d = datos(
      [paciente('p1', 50)],
      [sesion('a', 'p1', '2026-11-04', 10000000, { status: 'cancelada' })],
    );
    expect(repartoDelMes(d, '2026-11').bruto).toBe(0);
  });

  it('una ausencia cobrable sí reparte, porque factura', () => {
    const d = datos(
      [paciente('p1', 50)],
      [sesion('a', 'p1', '2026-11-04', 10000000, { status: 'ausente', chargeable: true })],
    );
    expect(repartoDelMes(d, '2026-11').neto).toBe(5000000);
  });

  it('una sesión de alguien borrado no rompe la cuenta', () => {
    const d = datos([], [sesion('a', 'fantasma', '2026-11-04', 10000000)]);
    expect(repartoDelMes(d, '2026-11')).toEqual({ bruto: 10000000, retenido: 0, neto: 10000000 });
  });
});

describe('cuándo mostrarlo', () => {
  it('sin nadie con porcentaje, la cuenta sobra', () => {
    expect(hayRetenciones(datos([paciente('p1', 0)], []))).toBe(false);
  });

  it('con uno solo ya vale la pena', () => {
    expect(hayRetenciones(datos([paciente('p1', 0), paciente('p2', 20)], []))).toBe(true);
  });
});

describe('el reparto de un paciente', () => {
  it('usa su propio porcentaje', () => {
    expect(repartoDePaciente(paciente('p1', 40), 10000000).neto).toBe(6000000);
  });
});

describe('la retención promedio', () => {
  it('sin nadie con porcentaje da cero', () => {
    const d = datos([paciente('p1', 0)], [sesion('a', 'p1', '2026-11-04', 10000000)]);
    expect(retencionPromedio(d, '2026-01-01')).toBe(0);
  });

  it('pesa por plata, no por cabezas', () => {
    // Un paciente de institución al 50% que factura 90.000 y uno particular
    // que factura 10.000: se retiene 45.000 de 100.000, o sea el 45%.
    // Promediar los porcentajes daría 25%, que no es lo que se le va.
    const d = datos(
      [paciente('p1', 50), paciente('p2', 0)],
      [sesion('a', 'p1', '2026-11-04', 9000000), sesion('b', 'p2', '2026-11-05', 1000000)],
    );
    expect(retencionPromedio(d, '2026-01-01')).toBeCloseTo(45, 5);
  });

  it('mira solo la ventana pedida, porque lo que importa es la mezcla de ahora', () => {
    const d = datos(
      [paciente('p1', 50), paciente('p2', 0)],
      [sesion('viejo', 'p1', '2024-01-04', 9000000), sesion('nuevo', 'p2', '2026-11-05', 1000000)],
    );
    expect(retencionPromedio(d, '2026-09-01')).toBe(0);
  });

  it('sin sesiones en la ventana no inventa un promedio', () => {
    const d = datos([paciente('p1', 50)], []);
    expect(retencionPromedio(d, '2026-01-01')).toBe(0);
  });
});

describe('la tarifa sugerida contra la retención', () => {
  const base = { targetIncome: 100000000, fixedCosts: 0, sessionsPerWeek: 10, taxPercent: 0, noShowPercent: 0 };

  it('sin retención es la de siempre', () => {
    expect(suggestedRate(base, 0)?.suggestedFee).toBe(suggestedRate(base)?.suggestedFee);
  });

  it('con retención sube, porque si no se lleva menos de lo que pidió', () => {
    const sin = suggestedRate(base, 0)!.suggestedFee;
    const con = suggestedRate(base, 30)!.suggestedFee;
    expect(con).toBeGreaterThan(sin);
  });

  it('sube dividiendo y no sumando: con el 30% retenido hay que cobrar ~43% más', () => {
    // El error intuitivo es subir un 30%. Para llevarse el 100% cobrando el
    // 70% hay que dividir por 0,7, que es un 42,9% más.
    const sin = suggestedRate(base, 0)!.suggestedFee;
    const con = suggestedRate(base, 30)!.suggestedFee;
    expect(con / sin).toBeGreaterThan(1.42);
    expect(con / sin).toBeLessThan(1.44);
  });

  it('cobrando la tarifa sugerida se lleva lo que pidió', () => {
    const r = suggestedRate(base, 30)!;
    const entra = repartir(r.suggestedFee, 30).neto * r.paidSessions;
    expect(entra).toBeGreaterThanOrEqual(base.targetIncome);
  });

  it('una retención imposible no devuelve una tarifa inventada', () => {
    expect(suggestedRate(base, 100)).toBeNull();
    expect(suggestedRate(base, -1)).toBeNull();
  });
});
