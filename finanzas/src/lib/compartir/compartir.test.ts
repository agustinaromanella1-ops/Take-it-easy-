import { cifrar, descifrar, nuevaClave } from './cripto';
import { armarVista, esVista } from './vista';
import { compromiso, cuenta, datos, meta, movimiento } from '../fabrica';

describe('cifrado', () => {
  it('ida y vuelta con la misma clave', async () => {
    const clave = nuevaClave();
    const c = await cifrar({ hola: 'Banco', n: 1 }, clave);
    expect(c).not.toContain('Banco');
    expect(await descifrar(c, clave)).toEqual({ hola: 'Banco', n: 1 });
  });

  it('con otra clave, o un bloque tocado, no se puede leer', async () => {
    const c = await cifrar({ a: 1 }, nuevaClave());
    await expect(descifrar(c, nuevaClave())).rejects.toThrow();
    const clave = nuevaClave();
    const bueno = await cifrar({ a: 1 }, clave);
    const tocado = bueno.slice(0, -2) + (bueno.endsWith('A') ? 'BB' : 'AA');
    await expect(descifrar(tocado, clave)).rejects.toThrow();
  });
});

describe('lo que se comparte', () => {
  const banco = cuenta({ nombre: 'Banco', saldoInicial: 100_000_00 });
  const d = datos({
    cuentas: [banco],
    compromisos: [compromiso({ vencimiento: '2026-09-20' }), compromiso({ nombre: 'Lejos', vencimiento: '2026-12-20' })],
    metas: [meta()],
    movimientos: [movimiento({ cuentaId: banco.id, fecha: '2026-09-10', nota: 'nota privada' }), movimiento({ cuentaId: banco.id, fecha: '2026-06-01' })],
  });

  it('solo lo que se eligió', () => {
    const v = armarVista(d, { disponible: true, vencimientos: false, metas: false, movimientos: false }, '2026-09-15', 'x');
    expect(Object.keys(v).sort()).toEqual(['disponible', 'generadoEn', 'hoy', 'version']);
    expect(esVista(v)).toBe(true);
  });

  it('vencimientos y movimientos de los próximos/últimos 30 días, sin notas ni ids', () => {
    const v = armarVista(d, { disponible: false, vencimientos: true, metas: true, movimientos: true }, '2026-09-15', 'x');
    expect(v.vencimientos?.map((x) => x.nombre)).toEqual(['Luz']);
    expect(v.movimientos).toHaveLength(1);
    const texto = JSON.stringify(v);
    expect(texto).not.toContain('nota privada');
    expect(texto).not.toContain(banco.id);
  });

  it('rechaza lo que no tiene forma de vista', () => {
    expect(esVista({ version: 2 })).toBe(false);
    expect(esVista({ version: 1, generadoEn: 'x', hoy: 'y', metas: 'no' })).toBe(false);
  });
});
