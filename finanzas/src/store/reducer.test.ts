import { reducer, etiquetaDe, type Action } from './reducer';
import { compromiso, cuenta, datos, ingreso, meta, movimiento } from '../lib/fabrica';
import { saldo } from '../lib/finanzas/saldos';
import { fusionar } from '../lib/fusion';
import { volverA } from '../lib/deshacer';
import { emptyData, parseData } from '../lib/storage';

const sin = <T extends { updatedAt: string }>(r: T): Omit<T, 'updatedAt'> => {
  const { updatedAt: _u, ...resto } = r;
  return resto;
};

describe('reducer', () => {
  it('sella lo que agrega y deja lápida de lo que borra', () => {
    const m = movimiento();
    let d = reducer(datos(), { type: 'mov/agregar', mov: sin(m) });
    expect(d.movimientos[0]?.updatedAt).not.toBe(m.updatedAt);
    d = reducer(d, { type: 'mov/borrar', id: m.id });
    expect(d.movimientos).toHaveLength(0);
    expect(d.deleted.movimientos.map((l) => l.id)).toEqual([m.id]);
    expect(Object.keys(d.deleted.movimientos[0] ?? {})).toEqual(['id', 'deletedAt']);
  });

  it('actualizar un saldo registra la diferencia sin conciliar, sin categoría', () => {
    const c = cuenta({ saldoInicial: 100_000_00, confirmadoEn: '2026-08-01' });
    const d = reducer(datos({ cuentas: [c] }), { type: 'cuenta/confirmarSaldo', cuentaId: c.id, saldoReal: 88_000_00, fecha: '2026-09-15', ajusteId: 'aj1' });
    const ajuste = d.movimientos.find((m) => m.id === 'aj1');
    expect(ajuste).toMatchObject({ tipo: 'ajuste', importe: -12_000_00, categoria: '', nota: 'Diferencia sin conciliar' });
    expect(saldo(d.cuentas[0]!, d.movimientos)).toBe(88_000_00);
    expect(d.cuentas[0]?.confirmadoEn).toBe('2026-09-15');
  });

  it('confirmar un saldo que coincide no crea ajuste', () => {
    const c = cuenta({ saldoInicial: 100_000_00 });
    const d = reducer(datos({ cuentas: [c] }), { type: 'cuenta/confirmarSaldo', cuentaId: c.id, saldoReal: 100_000_00, fecha: '2026-09-15', ajusteId: 'aj1' });
    expect(d.movimientos).toHaveLength(0);
  });

  it('una cuenta con movimientos no se borra', () => {
    const c = cuenta();
    const d = datos({ cuentas: [c], movimientos: [movimiento({ cuentaId: c.id })] });
    expect(reducer(d, { type: 'cuenta/borrar', id: c.id }).cuentas).toHaveLength(1);
  });

  it('pagar un compromiso mensual crea el pago y el del mes que viene', () => {
    const c = cuenta();
    const k = compromiso({ recurrencia: 'mensual', vencimiento: '2026-09-20' });
    const pago = sin(movimiento({ id: 'p1', cuentaId: c.id, importe: k.importe! }));
    const d = reducer(datos({ cuentas: [c], compromisos: [k] }), { type: 'compromiso/pagar', id: k.id, pago, siguienteId: 'k2' });
    expect(d.compromisos.find((x) => x.id === k.id)).toMatchObject({ pagado: true, pagoId: 'p1' });
    expect(d.compromisos.find((x) => x.id === 'k2')).toMatchObject({ pagado: false, vencimiento: '2026-10-20' });
    // Borrar el pago devuelve el compromiso a pendiente.
    const d2 = reducer(d, { type: 'mov/borrar', id: 'p1' });
    expect(d2.compromisos.find((x) => x.id === k.id)?.pagado).toBe(false);
  });

  it('cobrar un ingreso esperado lo registra y agenda el próximo', () => {
    const c = cuenta();
    const i = ingreso({ fecha: '2026-10-01' });
    const cobro = sin(movimiento({ tipo: 'ingreso', cuentaId: c.id, importe: 500_000_00 }));
    const d = reducer(datos({ cuentas: [c], ingresos: [i] }), { type: 'ingreso/cobrar', id: i.id, cobro, siguienteId: 'i2' });
    expect(d.ingresos.find((x) => x.id === 'i2')?.fecha).toBe('2026-11-01');
    expect(d.movimientos).toHaveLength(1);
  });

  it('una sola meta destacada', () => {
    const a = meta({ id: 'a', destacada: true });
    let d = reducer(datos({ metas: [a] }), { type: 'meta/agregar', meta: sin(meta({ id: 'b', destacada: false })) });
    expect(d.metas.filter((m) => m.destacada).map((m) => m.id)).toEqual(['a']);
    d = reducer(d, { type: 'meta/destacar', id: 'b' });
    expect(d.metas.filter((m) => m.destacada).map((m) => m.id)).toEqual(['b']);
  });

  it('toda acción que toca datos tiene etiqueta para deshacer', () => {
    const acciones: Action['type'][] = [
      'cuenta/agregar', 'cuenta/editar', 'cuenta/borrar', 'cuenta/confirmarSaldo', 'mov/agregar', 'mov/agregarVarios', 'mov/editar', 'mov/borrar',
      'mov/revisado', 'compromiso/agregar', 'compromiso/editar', 'compromiso/borrar', 'compromiso/pagar', 'ingreso/agregar',
      'ingreso/editar', 'ingreso/borrar', 'ingreso/cobrar', 'meta/agregar', 'meta/editar', 'meta/borrar', 'meta/destacar',
      'aporte/agregar', 'aporte/borrar', 'data/replace',
    ];
    for (const type of acciones) {
      const a = { type, mov: movimiento(), movs: [movimiento()], origen: 'importar', aporte: { importe: 1 } } as unknown as Action;
      expect(etiquetaDe(a), type).toBeTruthy();
    }
  });
});

describe('fusión y deshacer', () => {
  it('dos pestañas: se conserva lo que anotó cada una', () => {
    const base = datos();
    const a = reducer(base, { type: 'mov/agregar', mov: sin(movimiento({ id: 'a' })) });
    const b = reducer(base, { type: 'mov/agregar', mov: sin(movimiento({ id: 'b' })) });
    expect(fusionar(a, b).movimientos.map((m) => m.id).sort()).toEqual(['a', 'b']);
  });

  it('un borrado en una pestaña no revive por la otra', () => {
    const base = reducer(datos(), { type: 'mov/agregar', mov: sin(movimiento({ id: 'a' })) });
    const borrado = reducer(base, { type: 'mov/borrar', id: 'a' });
    expect(fusionar(base, borrado).movimientos).toHaveLength(0);
  });

  it('deshacer un borrado le gana a la lápida guardada', async () => {
    const base = reducer(datos(), { type: 'mov/agregar', mov: sin(movimiento({ id: 'a' })) });
    const borrado = reducer(base, { type: 'mov/borrar', id: 'a' });
    await new Promise((r) => setTimeout(r, 5));
    const deshecho = volverA(borrado, base, new Date().toISOString());
    expect(fusionar(deshecho, borrado).movimientos.map((m) => m.id)).toEqual(['a']);
  });

  it('deshacer no le quita trucos al perro', () => {
    const antes = datos();
    const despues = { ...antes, huellitas: { ...antes.huellitas, trucos: ['patita'] } };
    expect(volverA(despues, antes, new Date().toISOString()).huellitas.trucos).toEqual(['patita']);
  });

  it('los trucos se unen al fusionar', () => {
    const a = datos({ huellitas: { ...datos().huellitas, trucos: ['patita'], updatedAt: '2026-09-02T00:00:00Z' } });
    const b = datos({ huellitas: { ...datos().huellitas, trucos: ['saltito'], updatedAt: '2026-09-01T00:00:00Z' } });
    expect(fusionar(a, b).huellitas.trucos.sort()).toEqual(['patita', 'saltito']);
  });
});

describe('storage', () => {
  it('descarta registros inválidos en vez de confiar', () => {
    const d = parseData({
      cuentas: [{ id: 'c', moneda: 'ARS', saldoInicial: 100, fechaSaldo: '2026-09-01' }, { id: 'x', moneda: 'EUR', saldoInicial: 1, fechaSaldo: '2026-09-01' }],
      movimientos: [
        { id: 'm', tipo: 'gasto', importe: 100, moneda: 'ARS', fecha: '2026-09-01' },
        { id: 'float', tipo: 'gasto', importe: 0.1, moneda: 'ARS', fecha: '2026-09-01' },
        { id: 'neg', tipo: 'gasto', importe: -5, moneda: 'ARS', fecha: '2026-09-01' },
        { id: 'fecha', tipo: 'gasto', importe: 5, moneda: 'ARS', fecha: '2026-02-30' },
      ],
      metas: [{ id: 'meta', moneda: 'ARS', imagen: 'https://afuera.com/x.png' }],
    });
    expect(d?.cuentas.map((c) => c.id)).toEqual(['c']);
    expect(d?.movimientos.map((m) => m.id)).toEqual(['m']);
    // Una imagen externa haría que la app pida algo afuera: se descarta.
    expect(d?.metas[0]?.imagen).toBe('');
  });

  it('lo que no son datos de Salchi devuelve null', () => {
    expect(parseData('hola')).toBeNull();
    expect(parseData({ patients: [] })).toBeNull();
  });

  it('ida y vuelta sin pérdidas', () => {
    const d = datos({ cuentas: [cuenta()], movimientos: [movimiento()], compromisos: [compromiso()], ingresos: [ingreso()], metas: [meta()] });
    expect(parseData(JSON.parse(JSON.stringify(d)))).toEqual(d);
    expect(parseData(JSON.parse(JSON.stringify(emptyData())))).toEqual(emptyData());
  });
});
