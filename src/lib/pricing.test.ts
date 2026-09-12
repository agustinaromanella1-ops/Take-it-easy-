import { describe, expect, it } from 'vitest';
import { goalProgress, roundUpNice, suggestedRate, WEEKS_PER_MONTH } from './pricing';
import type { RateInputs } from '../types';

const base: RateInputs = {
  targetIncome: 80000000, // $800.000
  fixedCosts: 20000000, // $200.000
  sessionsPerWeek: 20,
  taxPercent: 0,
  noShowPercent: 0,
};

describe('suggestedRate', () => {
  it('divide lo que hay que cubrir entre las sesiones del mes', () => {
    const r = suggestedRate(base)!;
    // $1.000.000 a cubrir / (20 sesiones × 4,33 semanas) = $11.538,46 por sesión
    expect(r.scheduledSessions).toBeCloseTo(20 * WEEKS_PER_MONTH, 1);
    expect(r.suggestedFee).toBe(roundUpNice(100000000 / (20 * WEEKS_PER_MONTH)));
  });

  it('sugiere una tarifa que alguien cobraría de verdad, no con centavos', () => {
    const r = suggestedRate(base)!;
    expect(r.suggestedFee % 10000).toBe(0); // múltiplo de $100
    expect(r.suggestedFee).toBe(1160000); // $11.600, no $11.538,46
  });

  it('la tarifa redondeada alcanza para cubrir lo que hace falta', () => {
    for (const perWeek of [3, 7, 12, 20, 35]) {
      const input = { ...base, sessionsPerWeek: perWeek, taxPercent: 25, noShowPercent: 10 };
      const r = suggestedRate(input)!;
      // Con las sesiones exactas, no con r.paidSessions, que viene redondeado
      // a un decimal solo para mostrarse en pantalla.
      const sesionesExactas = perWeek * WEEKS_PER_MONTH * (1 - input.noShowPercent / 100);
      const recaudado = r.suggestedFee * sesionesExactas * (1 - input.taxPercent / 100);
      expect(recaudado).toBeGreaterThanOrEqual(input.targetIncome + input.fixedCosts);
    }
  });

  it('usa 4,33 semanas por mes, no 4', () => {
    // Con 4 semanas la tarifa saldría más cara y la meta quedaría sobreestimada.
    const r = suggestedRate({ ...base, sessionsPerWeek: 10 })!;
    const conCuatroSemanas = Math.ceil(100000000 / 40);
    expect(r.suggestedFee).toBeLessThan(conCuatroSemanas);
  });

  it('sube la tarifa para compensar los impuestos', () => {
    const sinImpuestos = suggestedRate(base)!;
    const conImpuestos = suggestedRate({ ...base, taxPercent: 50 })!;
    // Con 50% de carga hay que facturar el doble para que quede lo mismo.
    // No es exacto al centavo porque la tarifa se redondea a una cifra usable.
    expect(conImpuestos.monthlyBilling / sinImpuestos.monthlyBilling).toBeCloseTo(2, 1);
    expect(conImpuestos.suggestedFee).toBeGreaterThan(sinImpuestos.suggestedFee);
  });

  it('sube la tarifa para compensar las ausencias esperadas', () => {
    const sinAusencias = suggestedRate(base)!;
    const conAusencias = suggestedRate({ ...base, noShowPercent: 20 })!;
    expect(conAusencias.paidSessions).toBeLessThan(conAusencias.scheduledSessions);
    expect(conAusencias.suggestedFee).toBeGreaterThan(sinAusencias.suggestedFee);
  });

  it('cuenta los gastos fijos junto con el ingreso buscado', () => {
    const soloIngreso = suggestedRate({ ...base, fixedCosts: 0 })!;
    expect(suggestedRate(base)!.suggestedFee).toBeGreaterThan(soloIngreso.suggestedFee);
  });

  it('redondea la tarifa hacia arriba: cobrar de menos no cierra las cuentas', () => {
    const r = suggestedRate({ ...base, sessionsPerWeek: 3 })!;
    expect(Number.isInteger(r.suggestedFee)).toBe(true);
    expect(r.suggestedFee * r.paidSessions).toBeGreaterThanOrEqual(r.monthlyBilling - 1);
  });

  it('devuelve null cuando no hay resultado con sentido', () => {
    expect(suggestedRate({ ...base, sessionsPerWeek: 0 })).toBeNull();
    expect(suggestedRate({ ...base, taxPercent: 100 })).toBeNull();
    expect(suggestedRate({ ...base, noShowPercent: 100 })).toBeNull();
    expect(suggestedRate({ ...base, targetIncome: 0, fixedCosts: 0 })).toBeNull();
  });
});

describe('roundUpNice', () => {
  it('salta de a 100 en montos grandes', () => {
    expect(roundUpNice(1709402)).toBe(1710000); // $17.094,02 -> $17.100
    expect(roundUpNice(1700000)).toBe(1700000); // ya redondo, no lo mueve
  });

  it('usa pasos más finos en montos chicos', () => {
    expect(roundUpNice(153450)).toBe(154000); // $1.534,50 -> $1.540
    expect(roundUpNice(6050)).toBe(6100); // $60,50 -> $61
  });

  it('siempre redondea hacia arriba', () => {
    for (const v of [1, 99, 12345, 999999, 1234567]) {
      expect(roundUpNice(v)).toBeGreaterThanOrEqual(v);
    }
  });
});

describe('goalProgress', () => {
  it('calcula lo que falta y el porcentaje', () => {
    const g = goalProgress(100000000, 40000000)!;
    expect(g.remaining).toBe(60000000);
    expect(g.percent).toBe(40);
    expect(g.done).toBe(false);
  });

  it('marca la meta cumplida sin pasarse de 100%', () => {
    const g = goalProgress(100000000, 150000000)!;
    expect(g.remaining).toBe(0);
    expect(g.percent).toBe(100);
    expect(g.done).toBe(true);
  });

  it('sin meta definida no informa nada', () => {
    expect(goalProgress(0, 50000)).toBeNull();
  });
});
