import { aporte, compromiso, cuenta, datos, ingreso, meta, movimiento } from '../fabrica';
import { calcularDisponible, finDelPeriodo } from './disponible';
import { saldo } from './saldos';
import { aPagarHasta, cierreDe, deudaTotal, partirEnCuotas, resumenes, vencimientoDe } from './tarjeta';
import { posiblesDuplicados } from './duplicados';
import { pasoSugerido, proximoVencimiento } from './pendientes';

const HOY = '2026-09-15';

describe('saldos', () => {
  it('un gasto baja la cuenta y un ingreso la sube', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const movs = [
      movimiento({ cuentaId: c.id, importe: 8_500_00 }),
      movimiento({ tipo: 'ingreso', cuentaId: c.id, importe: 50_000_00 }),
    ];
    expect(saldo(c, movs)).toBe(141_500_00);
  });

  it('lo anterior a la fecha del saldo ya está incluido en el número', () => {
    const c = cuenta({ saldoInicial: 1000_00, fechaSaldo: '2026-09-10' });
    expect(saldo(c, [movimiento({ cuentaId: c.id, fecha: '2026-09-09' })])).toBe(1000_00);
    expect(saldo(c, [movimiento({ cuentaId: c.id, fecha: '2026-09-10', importe: 100_00 })])).toBe(900_00);
  });

  it('transferir entre cuentas propias no cambia el total ni el disponible', () => {
    const a = cuenta({ nombre: 'Banco', saldoInicial: 100_000_00 });
    const b = cuenta({ nombre: 'Efectivo', tipo: 'efectivo', saldoInicial: 0 });
    const t = movimiento({ tipo: 'transferencia', cuentaId: a.id, cuentaDestinoId: b.id, importe: 20_000_00 });
    expect(saldo(a, [t])).toBe(80_000_00);
    expect(saldo(b, [t])).toBe(20_000_00);
    const antes = calcularDisponible(datos({ cuentas: [a, b] }), 'ARS', HOY).importe;
    const despues = calcularDisponible(datos({ cuentas: [a, b], movimientos: [t] }), 'ARS', HOY).importe;
    expect(despues).toBe(antes);
  });
});

describe('tarjeta de crédito', () => {
  it('reparte las cuotas sin perder centavos', () => {
    expect(partirEnCuotas(100_00, 3)).toEqual([33_34, 33_33, 33_33]);
    expect(partirEnCuotas(100_00, 3).reduce((a, b) => a + b, 0)).toBe(100_00);
  });

  it('una compra cae en el resumen según el día de cierre', () => {
    expect(cierreDe('2026-09-10', 25)).toBe('2026-09-25');
    expect(cierreDe('2026-09-25', 25)).toBe('2026-09-25');
    expect(cierreDe('2026-09-26', 25)).toBe('2026-10-25');
    expect(vencimientoDe('2026-09-25', 5)).toBe('2026-10-05');
    expect(cierreDe('2026-01-31', 31)).toBe('2026-01-31');
    expect(cierreDe('2026-02-10', 31)).toBe('2026-02-28');
  });

  it('compra de $30.000 en 3 cuotas: vence $10.000 por mes, no $30.000', () => {
    const banco = cuenta({ saldoInicial: 100_000_00 });
    const visa = cuenta({ nombre: 'Visa', tipo: 'tarjeta-credito' });
    const compra = movimiento({ cuentaId: visa.id, importe: 30_000_00, cuotas: 3, fecha: '2026-09-10' });
    const r = resumenes(visa, [compra]);
    expect(r.map((x) => [x.vencimiento, x.total])).toEqual([
      ['2026-10-05', 10_000_00],
      ['2026-11-05', 10_000_00],
      ['2026-12-05', 10_000_00],
    ]);
    expect(deudaTotal(visa, [compra])).toBe(30_000_00);
    const d = datos({ cuentas: [banco, visa], movimientos: [compra], preferencias: { ...datos().preferencias, periodo: 'fin-de-mes' } });
    // Hasta fin de septiembre no vence nada de la tarjeta.
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(100_000_00);
    expect(aPagarHasta(visa, [compra], '2026-10-31')).toBe(10_000_00);
  });

  it('pagar el resumen no duplica las compras', () => {
    const banco = cuenta({ saldoInicial: 100_000_00 });
    const visa = cuenta({ nombre: 'Visa', tipo: 'tarjeta-credito', fechaSaldo: '2026-08-01' });
    const compra = movimiento({ cuentaId: visa.id, importe: 30_000_00, cuotas: 3, fecha: '2026-08-10' });
    const pago = movimiento({ tipo: 'pago-tarjeta', cuentaId: banco.id, cuentaDestinoId: visa.id, importe: 10_000_00, fecha: '2026-09-05' });
    const movs = [compra, pago];
    // La compra no tocó el banco; el pago sí, una vez.
    expect(saldo(banco, movs)).toBe(90_000_00);
    expect(deudaTotal(visa, movs)).toBe(20_000_00);
    // El resumen de septiembre quedó pagado; el de octubre sigue.
    const r = resumenes(visa, movs);
    expect(r[0]?.pendiente).toBe(0);
    expect(r[1]?.pendiente).toBe(10_000_00);
    // Gastos del período en el disponible: el pago bajó el banco y la cuota
    // pagada ya no se resta de nuevo.
    const d = datos({ cuentas: [banco, visa], movimientos: movs, preferencias: { ...datos().preferencias, periodo: 'fin-de-mes' } });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(90_000_00);
  });

  it('una devolución en la tarjeta baja lo que se debe', () => {
    const visa = cuenta({ tipo: 'tarjeta-credito' });
    const compra = movimiento({ cuentaId: visa.id, importe: 10_000_00 });
    const dev = movimiento({ tipo: 'devolucion', cuentaId: visa.id, importe: 4_000_00, devolucionDe: compra.id });
    expect(deudaTotal(visa, [compra, dev])).toBe(6_000_00);
  });
});

describe('disponible', () => {
  it('sin cuentas no inventa una cifra: dice qué falta', () => {
    const d = calcularDisponible(datos(), 'ARS', HOY);
    expect(d.importe).toBeNull();
    expect(d.faltantes[0]).toEqual({ tipo: 'sin-cuentas' });
  });

  it('resta compromisos del período y deja afuera los posteriores', () => {
    const c = cuenta({ saldoInicial: 100_000_00, confirmadoEn: HOY });
    const d = datos({
      cuentas: [c],
      compromisos: [compromiso({ vencimiento: '2026-09-20', importe: 15_000_00 }), compromiso({ vencimiento: '2026-10-20', importe: 99_000_00 })],
      preferencias: { ...datos().preferencias, periodo: 'fin-de-mes' },
    });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(85_000_00);
  });

  it('un compromiso pagado no se resta dos veces: su pago ya bajó el saldo', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const pago = movimiento({ cuentaId: c.id, importe: 15_000_00 });
    const k = compromiso({ importe: 15_000_00, pagado: true, pagoId: pago.id });
    const d = datos({ cuentas: [c], movimientos: [pago], compromisos: [k] });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(85_000_00);
  });

  it('lo apartado para una meta se resta una vez, y un compromiso aparte también una vez', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const m = meta();
    const d = datos({
      cuentas: [c],
      metas: [m],
      aportes: [aporte({ metaId: m.id, cuentaId: c.id, importe: 15_000_00 })],
      compromisos: [compromiso({ importe: 15_000_00 })],
      preferencias: { ...datos().preferencias, periodo: 'fin-de-mes' },
    });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(70_000_00);
  });

  it('usar la reserva libera lo apartado', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const m = meta({ esReserva: true });
    const d = datos({
      cuentas: [c],
      metas: [m],
      aportes: [aporte({ metaId: m.id, cuentaId: c.id, importe: 30_000_00 }), aporte({ metaId: m.id, cuentaId: c.id, importe: -10_000_00 })],
    });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(80_000_00);
  });

  it('lo apartado en una cuenta que no cuenta para el disponible no se resta', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const ahorro = cuenta({ nombre: 'Ahorro', saldoInicial: 50_000_00, cuentaParaDisponible: false });
    const m = meta();
    const d = datos({ cuentas: [c, ahorro], metas: [m], aportes: [aporte({ metaId: m.id, cuentaId: ahorro.id, importe: 50_000_00, forma: 'real' })] });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(100_000_00);
  });

  it('pesos y dólares no se suman nunca', () => {
    const ars = cuenta({ saldoInicial: 100_000_00 });
    const usd = cuenta({ nombre: 'Dólares', moneda: 'USD', saldoInicial: 500_00 });
    const d = datos({ cuentas: [ars, usd], compromisos: [compromiso({ moneda: 'USD', importe: 100_00 })] });
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(100_000_00);
    expect(calcularDisponible(d, 'USD', HOY).importe).toBe(400_00);
  });

  it('los ingresos esperados no suman: van aparte, como proyección', () => {
    const c = cuenta({ saldoInicial: 10_000_00 });
    const i = ingreso({ fecha: '2026-10-01', importe: 500_000_00 });
    const d = calcularDisponible(datos({ cuentas: [c], ingresos: [i] }), 'ARS', HOY);
    expect(d.importe).toBe(10_000_00);
    expect(d.hasta).toBe('2026-10-01');
    expect(d.proyeccion?.siSeCobra).toBe(510_000_00);
  });

  it('sin ingresos esperados, el período va hasta fin de mes', () => {
    expect(finDelPeriodo(datos(), HOY)).toEqual({ hasta: '2026-09-30', motivo: 'fin-de-mes' });
  });

  it('un compromiso sin importe no se inventa: queda como faltante', () => {
    const c = cuenta({ saldoInicial: 10_000_00 });
    const d = calcularDisponible(datos({ cuentas: [c], compromisos: [compromiso({ importe: null, nombre: 'Gas' })] }), 'ARS', HOY);
    expect(d.importe).toBe(10_000_00);
    expect(d.faltantes).toContainEqual({ tipo: 'sin-importe', compromiso: 'Gas' });
  });

  it('un gasto sin cuenta se resta igual y se avisa', () => {
    const c = cuenta({ saldoInicial: 10_000_00 });
    const d = calcularDisponible(datos({ cuentas: [c], movimientos: [movimiento({ importe: 1_000_00 })] }), 'ARS', HOY);
    expect(d.importe).toBe(9_000_00);
    expect(d.faltantes).toContainEqual({ tipo: 'sin-cuenta', cantidad: 1 });
  });

  it('un déficit se muestra como número negativo, no se esconde', () => {
    const c = cuenta({ saldoInicial: 10_000_00 });
    const d = calcularDisponible(datos({ cuentas: [c], compromisos: [compromiso({ importe: 25_000_00 })] }), 'ARS', HOY);
    expect(d.importe).toBe(-15_000_00);
  });

  it('avisa si un saldo es viejo', () => {
    const c = cuenta({ nombre: 'Banco', saldoInicial: 10_000_00, confirmadoEn: '2026-09-01' });
    const d = calcularDisponible(datos({ cuentas: [c] }), 'ARS', HOY);
    expect(d.faltantes).toContainEqual({ tipo: 'saldo-viejo', cuenta: 'Banco', dias: 14 });
  });

  it('un ajuste de conciliación corrige el saldo sin inventar categoría', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const ajuste = movimiento({ tipo: 'ajuste', cuentaId: c.id, importe: -12_000_00, origen: 'ajuste' });
    expect(saldo(c, [ajuste])).toBe(88_000_00);
    expect(ajuste.categoria).toBe('');
  });
});

describe('duplicados', () => {
  it('avisa con mismo importe, fecha cercana y comercio parecido', () => {
    const m = movimiento({ importe: 8_500_00, fecha: '2026-09-10', comercio: 'Supermercado Día' });
    const dup = posiblesDuplicados({ tipo: 'gasto', importe: 8_500_00, moneda: 'ARS', fecha: '2026-09-11', comercio: 'SUPERMERCADO DIA %' }, [m]);
    expect(dup).toHaveLength(1);
  });

  it('no avisa si cambia el importe, la moneda o pasaron más de dos días', () => {
    const m = movimiento({ importe: 8_500_00, fecha: '2026-09-10' });
    expect(posiblesDuplicados({ tipo: 'gasto', importe: 8_600_00, moneda: 'ARS', fecha: '2026-09-10', comercio: '' }, [m])).toHaveLength(0);
    expect(posiblesDuplicados({ tipo: 'gasto', importe: 8_500_00, moneda: 'USD', fecha: '2026-09-10', comercio: '' }, [m])).toHaveLength(0);
    expect(posiblesDuplicados({ tipo: 'gasto', importe: 8_500_00, moneda: 'ARS', fecha: '2026-09-13', comercio: '' }, [m])).toHaveLength(0);
  });
});

describe('pendientes', () => {
  it('el próximo vencimiento mezcla compromisos y resúmenes de tarjeta', () => {
    const visa = cuenta({ nombre: 'Visa', tipo: 'tarjeta-credito' });
    const d = datos({
      cuentas: [visa],
      movimientos: [movimiento({ cuentaId: visa.id, importe: 5_000_00, fecha: '2026-09-01' })],
      compromisos: [compromiso({ vencimiento: '2026-10-10' })],
    });
    expect(proximoVencimiento(d)).toMatchObject({ tipo: 'tarjeta', fecha: '2026-10-05', importe: 5_000_00 });
  });

  it('sugiere un solo paso, empezando por lo que hace más confiable el número', () => {
    const c = cuenta({ saldoInicial: 1_00, confirmadoEn: '2026-09-01' });
    const sinCuenta = movimiento();
    expect(pasoSugerido(datos(), HOY)?.tipo).toBe('primera-cuenta');
    expect(pasoSugerido(datos({ cuentas: [c], movimientos: [sinCuenta] }), HOY)?.tipo).toBe('asignar-cuenta');
    expect(pasoSugerido(datos({ cuentas: [c] }), HOY)?.tipo).toBe('confirmar-saldo');
    expect(pasoSugerido(datos({ cuentas: [{ ...c, confirmadoEn: HOY }] }), HOY)).toBeNull();
  });
});
