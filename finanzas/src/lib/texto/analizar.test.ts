import { cuenta } from '../fabrica';
import { analizar } from './analizar';

const HOY = '2026-09-15';
const banco = cuenta({ nombre: 'Galicia', tipo: 'banco', alias: ['débito'] });
const efectivo = cuenta({ nombre: 'Efectivo', tipo: 'efectivo' });
const mp = cuenta({ nombre: 'Mercado Pago', tipo: 'billetera', alias: ['mp'] });
const visa = cuenta({ nombre: 'Visa', tipo: 'tarjeta-credito' });
const dolares = cuenta({ nombre: 'Caja en dólares', tipo: 'banco', moneda: 'USD' });
const CUENTAS = [banco, efectivo, mp, visa, dolares];

const a = (frase: string) => analizar(frase, CUENTAS, HOY);

describe('analizar frases', () => {
  it('el ejemplo del pedido', () => {
    expect(a('Gasté 8.500 en supermercado con débito')).toMatchObject({
      tipo: 'gasto', importe: 8_500_00, cuentaId: banco.id, categoria: 'Comida', comercio: 'Supermercado', moneda: 'ARS',
    });
  });

  it.each([
    ['2 lucas café efectivo', 2_000_00, efectivo.id, 'Comida afuera'],
    ['uber 4500 mp', 4_500_00, mp.id, 'Transporte'],
    ['8,5k super', 8_500_00, null, 'Comida'],
    ['farmacia $ 12.345,50', 12_345_50, null, 'Salud'],
    ['gasté 3 mil en el chino', 3_000_00, null, 'Comida'],
    ['pagué la luz 25000 con galicia', 25_000_00, banco.id, 'Servicios'],
    ['nafta 40000 con mercado pago', 40_000_00, mp.id, 'Transporte'],
  ])('%s', (frase, importe, cuentaId, categoria) => {
    expect(a(frase)).toMatchObject({ tipo: 'gasto', importe, cuentaId, categoria });
  });

  it('ingresos', () => {
    expect(a('cobré 120 lucas')).toMatchObject({ tipo: 'ingreso', importe: 120_000_00 });
    expect(a('me pagaron 350.000 en galicia')).toMatchObject({ tipo: 'ingreso', importe: 350_000_00, cuentaId: banco.id });
    expect(a('entró 1 palo del aguinaldo')).toMatchObject({ tipo: 'ingreso', importe: 1_000_000_00 });
  });

  it('dólares van en dólares, y a la cuenta en dólares', () => {
    expect(a('gasté 100 dólares en el free shop')).toMatchObject({ moneda: 'USD', importe: 100_00 });
    expect(a('cobré usd 500 en caja en dolares')).toMatchObject({ tipo: 'ingreso', moneda: 'USD', importe: 500_00, cuentaId: dolares.id });
  });

  it('cuotas con tarjeta: el importe es el total y se guardan las cuotas', () => {
    expect(a('zapatillas 90000 en 3 cuotas con visa')).toMatchObject({ tipo: 'gasto', importe: 90_000_00, cuotas: 3, cuentaId: visa.id, categoria: 'Ropa' });
    expect(a('heladera en seis cuotas 600 lucas con crédito')).toMatchObject({ importe: 600_000_00, cuotas: 6, cuentaId: visa.id });
  });

  it('las cuotas no se inventan en una cuenta que no es tarjeta', () => {
    expect(a('curso 30000 en 3 cuotas con débito')).toMatchObject({ cuotas: 1, cuentaId: banco.id });
  });

  it('pagar la tarjeta no es una compra nueva', () => {
    expect(a('pagué el resumen 150000 con galicia')).toMatchObject({ tipo: 'pago-tarjeta', cuentaId: banco.id, cuentaDestinoId: visa.id });
    expect(a('pagué la visa 80.000')).toMatchObject({ tipo: 'pago-tarjeta', cuentaDestinoId: visa.id, importe: 80_000_00 });
    // Con "con", la tarjeta es el medio de pago: es una compra.
    expect(a('pagué 5000 con la visa')).toMatchObject({ tipo: 'gasto', cuentaId: visa.id });
  });

  it('transferencia entre cuentas propias', () => {
    expect(a('pasé 20000 de galicia a mp')).toMatchObject({ tipo: 'transferencia', importe: 20_000_00, cuentaId: banco.id, cuentaDestinoId: mp.id });
  });

  it('devoluciones', () => {
    expect(a('me devolvieron 5000 de la remera')).toMatchObject({ tipo: 'devolucion', importe: 5_000_00, categoria: 'Ropa' });
  });

  it('fechas', () => {
    expect(a('ayer 3000 kiosco').fecha).toBe('2026-09-14');
    expect(a('anteayer 3000 kiosco').fecha).toBe('2026-09-13');
    expect(a('el 10/9 gasté 3000').fecha).toBe('2026-09-10');
    // Sin año, una fecha futura es del año pasado.
    expect(a('20/12 regalo 3000').fecha).toBe('2025-12-20');
    expect(a('3000 kiosco').fecha).toBeNull();
  });

  it('lo que no entiende queda vacío, no adivinado', () => {
    expect(a('hola')).toMatchObject({ tipo: null, importe: null, cuentaId: null, categoria: '' });
    expect(a('algo 500').categoria).toBe('');
  });
});
