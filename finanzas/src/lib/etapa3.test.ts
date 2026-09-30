import { planDelMes, promedioDiaADia, ritmoDeMeta } from './finanzas/plan';
import { parsePorcentaje, simularInversion } from './finanzas/inversion';
import { aporte, compromiso, cuenta, datos, ingreso, meta, movimiento } from './fabrica';

const HOY = '2026-09-15';

describe('plan del mes', () => {
  it('entradas, salidas fijas y día a día sin contar dos veces', () => {
    const banco = cuenta();
    const visa = cuenta({ tipo: 'tarjeta-credito', fechaSaldo: '2026-08-01' });
    const luz = compromiso({ vencimiento: '2026-09-20', importe: 20_000_00, pagado: true, pagoId: 'pago-luz' });
    const d = datos({
      cuentas: [banco, visa],
      compromisos: [luz, compromiso({ nombre: 'Gas', importe: null, vencimiento: '2026-09-25' })],
      ingresos: [ingreso({ fecha: '2026-09-30', importe: 400_000_00 })],
      movimientos: [
        movimiento({ tipo: 'ingreso', cuentaId: banco.id, importe: 100_000_00, fecha: '2026-09-05' }),
        movimiento({ id: 'pago-luz', cuentaId: banco.id, importe: 20_000_00, fecha: '2026-09-10' }),
        // Compra con tarjeta en agosto: vence en el resumen del 5/9.
        movimiento({ cuentaId: visa.id, importe: 30_000_00, fecha: '2026-08-10' }),
        movimiento({ cuentaId: banco.id, importe: 3_000_00, fecha: '2026-09-01' }),
      ],
    });
    const p = planDelMes(d, HOY);
    expect(p.cobrado).toBe(100_000_00);
    expect(p.esperado).toBe(400_000_00);
    expect(p.fijas).toEqual([
      { texto: 'Luz', importe: 20_000_00 },
      { texto: `Resumen de ${visa.nombre}`, importe: 30_000_00 },
    ]);
    // El pago de la luz y la compra con tarjeta no cuentan como día a día.
    expect(p.origenDiaADia).toBe('promedio');
    expect(p.faltantes).toContain('Falta el importe de Gas.');
    expect(p.margen).toBe(500_000_00 - 50_000_00 - (p.diaADia ?? 0));
  });

  it('el promedio se divide por los días que hay anotados, no por 90', () => {
    const d = datos({ movimientos: [movimiento({ importe: 14_000_00, fecha: '2026-09-02' })] });
    // 14 días anotados → 1.000 por día → 30.000 por mes.
    expect(promedioDiaADia(d, HOY)).toBe(30_000_00);
  });

  it('sin gastos anotados no inventa el día a día', () => {
    const p = planDelMes(datos(), HOY);
    expect(p.diaADia).toBeNull();
    expect(p.margen).toBeNull();
  });

  it('lo escrito por la persona pisa al promedio', () => {
    const d = datos({ preferencias: { ...datos().preferencias, gastoVariable: 150_000_00 } });
    expect(planDelMes(d, HOY)).toMatchObject({ diaADia: 150_000_00, origenDiaADia: 'escrito' });
  });
});

describe('ritmo de una meta', () => {
  it('al ritmo de los últimos 90 días', () => {
    const m = meta({ objetivo: 300_000_00 });
    const d = datos({ metas: [m], aportes: [aporte({ metaId: m.id, cuentaId: 'c', importe: 90_000_00, fecha: '2026-08-01' })] });
    // 90.000 en 3 meses = 30.000 por mes; faltan 210.000 → 7 meses.
    expect(ritmoDeMeta(m, d, HOY)).toEqual({ porMes: 30_000_00, meses: 7 });
  });
  it('sin aportes recientes no hay pronóstico', () => {
    const m = meta();
    expect(ritmoDeMeta(m, datos({ metas: [m] }), HOY)).toBeNull();
  });
});

describe('simulador de inversión', () => {
  it('con tasa cero, termina con lo aportado; con inflación, vale menos en pesos de hoy', () => {
    const r = simularInversion({ inicial: 100_000_00, aporteMensual: 10_000_00, meses: 12, tasaMensual: 0, inflacionMensual: 200, caida: null });
    expect(r.final).toBe(220_000_00);
    expect(r.aportado).toBe(220_000_00);
    expect(r.finalReal).toBeLessThan(r.final);
    expect(r.peorDiferencia).toBe(0);
  });

  it('una tasa negativa muestra la pérdida y el peor momento', () => {
    const r = simularInversion({ inicial: 100_000_00, aporteMensual: 0, meses: 6, tasaMensual: -150, inflacionMensual: 0, caida: null });
    expect(r.final).toBeLessThan(100_000_00);
    expect(r.peorMes).toBe(6);
    expect(r.peorDiferencia).toBe(r.final - 100_000_00);
  });

  it('una caída puntual se ve aunque después se recupere', () => {
    const r = simularInversion({ inicial: 100_000_00, aporteMensual: 0, meses: 24, tasaMensual: 300, inflacionMensual: 0, caida: { mes: 2, porcentaje: 3000 } });
    expect(r.peorMes).toBe(2);
    expect(r.peorDiferencia).toBeLessThan(-25_000_00);
  });

  it('lee porcentajes, también negativos', () => {
    expect(parsePorcentaje('2,5')).toBe(250);
    expect(parsePorcentaje('-1,5 %')).toBe(-150);
    expect(parsePorcentaje('-100')).toBeNull();
  });
});
