import { adivinarColumnas, convertir, decodificar, leerCSV, leerFecha } from './importar/csv';
import { extraerVarios } from './comprobantes/varios';
import { conciliar, consumoComoCompra, leerResumen } from './comprobantes/resumen';
import { cuotasAPagarHasta, cuotasPrestamo, proximaCuota } from './finanzas/prestamo';
import { parseTasa, simular } from './finanzas/escenarios';
import { comprasEnCuotas, deudaAlCierre } from './finanzas/tarjeta';
import { calcularDisponible } from './finanzas/disponible';
import { vencimientos } from './finanzas/pendientes';
import { saldo } from './finanzas/saldos';
import { cuenta, datos, movimiento } from './fabrica';

const HOY = '2026-09-15';

describe('importar CSV', () => {
  it('separa con punto y coma respetando comillas y la coma decimal', () => {
    expect(leerCSV('Fecha;Concepto;Importe\n01/09/2026;"Súper; Día";"-8.500,50"\r\n')).toEqual([
      ['Fecha', 'Concepto', 'Importe'],
      ['01/09/2026', 'Súper; Día', '-8.500,50'],
    ]);
  });

  it('detecta columnas por títulos, con débito y crédito separados, sin usar el saldo', () => {
    const filas = leerCSV('Fecha,Descripción,Débito,Crédito,Saldo\n2026-09-01,COTO,"8500,00",,100000\n2026-09-02,SUELDO,,"500000,00",600000\n');
    const col = adivinarColumnas(filas);
    expect(col).toMatchObject({ fecha: 0, descripcion: 1, importe: -1, debito: 2, credito: 3, conTitulos: true });
    const r = convertir(filas, col, []);
    expect(r.filas.map((f) => [f.fecha, f.descripcion, f.importe, f.categoria])).toEqual([
      ['2026-09-01', 'COTO', -8_500_00, 'Comida'],
      ['2026-09-02', 'SUELDO', 500_000_00, ''],
    ]);
  });

  it('sin títulos, adivina por el contenido', () => {
    const filas = leerCSV('15/09/26;Uber viaje;-4500\n14/09/26;Farmacia;-12000,5\n');
    const col = adivinarColumnas(filas);
    expect(col).toMatchObject({ fecha: 0, descripcion: 1, importe: 2, conTitulos: false });
    expect(convertir(filas, col, []).filas[1]?.importe).toBe(-12_000_50);
  });

  it('marca duplicados contra lo ya anotado y cuenta las filas que no entiende', () => {
    const ya = movimiento({ importe: 8_500_00, fecha: '2026-09-01', comercio: 'Coto' });
    const filas = leerCSV('Fecha;Concepto;Importe\n01/09/2026;COTO;-8500\nnada;x;1\n02/09/2026;Transferencia a CVU;-1000\n');
    const r = convertir(filas, adivinarColumnas(filas), [ya]);
    expect(r.filas[0]?.duplicados).toHaveLength(1);
    expect(r.filas[1]?.pareceTransferencia).toBe(true);
    expect(r.omitidas).toEqual([{ indice: 2, motivo: 'sin fecha válida' }]);
  });

  it('lee archivos en latin1 sin romper los acentos', () => {
    const latin1 = new Uint8Array([0x44, 0xe9, 0x62, 0x69, 0x74, 0x6f]).buffer; // "Débito"
    expect(decodificar(latin1)).toBe('Débito');
    expect(decodificar(new TextEncoder().encode('Débito').buffer as ArrayBuffer)).toBe('Débito');
  });

  it('fechas', () => {
    expect(leerFecha('2026-09-01')).toBe('2026-09-01');
    expect(leerFecha('1/9/26')).toBe('2026-09-01');
    expect(leerFecha('31/02/2026')).toBeNull();
  });
});

describe('captura con varios movimientos', () => {
  const captura = `Actividad
Tu saldo $ 250.000
Hoy
Supermercado Día 14:32   - $ 8.500
Transferencia recibida   + $ 20.000
Ayer
Uber
- $ 4.500
Reintegro Mercado Pago  + $ 500
Lunes 7 de septiembre
Kiosco   $ 1.200`;

  it('toma cada movimiento con su fecha y su signo, e ignora el saldo', () => {
    const items = extraerVarios(captura, HOY);
    expect(items.map((i) => [i.fecha, i.descripcion, i.importe, i.tipo, i.signoDudoso])).toEqual([
      ['2026-09-15', 'Supermercado Día', 8_500_00, 'gasto', false],
      ['2026-09-15', 'Transferencia recibida', 20_000_00, 'ingreso', false],
      ['2026-09-14', 'Uber', 4_500_00, 'gasto', false],
      ['2026-09-14', 'Reintegro Mercado Pago', 500_00, 'devolucion', false],
      ['2026-09-07', 'Kiosco', 1_200_00, 'gasto', true],
    ]);
  });

  it('un número suelto sin signo de pesos no es un importe', () => {
    expect(extraerVarios('Hoy\nPedido 12345\nEntregado', HOY)).toEqual([]);
  });
});

describe('resumen de tarjeta', () => {
  const texto = `BANCO EJEMPLO - RESUMEN VISA
Cierre actual 25/09/26  Vencimiento actual 06/10/26
Próximo cierre 23/10/26
Saldo anterior 50.000,00
SU PAGO EN PESOS -50.000,00
12/09/26 ZAPATILLAS DEPORTE C.01/03 30.000,00
14/09/26 SUPERMERCADO COTO 8.500,00
02/08/26 HELADERA FRAVEGA C.02/06 40.000,00
IVA 21% S/INTERESES 210,00
INTERESES FINANCIACION 1.000,00
SALDO ACTUAL $ 79.710,00
PAGO MINIMO $ 12.000,00`;

  it('lee cierre, vencimiento, total, mínimo, consumos con cuotas y cargos aparte', () => {
    const r = leerResumen(texto);
    expect(r).toMatchObject({ cierre: '2026-09-25', vencimiento: '2026-10-06', total: 79_710_00, minimo: 12_000_00 });
    expect(r.lineas.filter((l) => l.tipo === 'consumo').map((l) => [l.descripcion, l.importe, l.cuota])).toEqual([
      ['ZAPATILLAS DEPORTE C.01/03', 30_000_00, { numero: 1, de: 3 }],
      ['SUPERMERCADO COTO', 8_500_00, null],
      ['HELADERA FRAVEGA C.02/06', 40_000_00, { numero: 2, de: 6 }],
    ]);
    expect(r.lineas.filter((l) => l.tipo === 'cargo').map((l) => l.importe)).toEqual([210_00, 1_000_00]);
  });

  it('concilia: encuentra lo que falta, y agregarlo deja la diferencia en cero', () => {
    const visa = cuenta({ tipo: 'tarjeta-credito', fechaSaldo: '2026-09-01' });
    const anotado = [
      movimiento({ cuentaId: visa.id, importe: 90_000_00, cuotas: 3, fecha: '2026-09-12', comercio: 'Zapatillas' }),
    ];
    const leido = leerResumen(texto);
    const c = conciliar(visa, anotado, leido)!;
    expect(c.segunApp).toBe(30_000_00);
    expect(c.diferencia).toBe(49_710_00);
    expect(c.faltantes.map((f) => f.importe)).toEqual([8_500_00, 40_000_00]);

    // Agregar los faltantes y los cargos cierra la diferencia exacto.
    const nuevos = [
      ...c.faltantes.map((f) => {
        const x = consumoComoCompra(f, c.cierre, visa.fechaSaldo);
        return movimiento({ cuentaId: visa.id, importe: x.importe, cuotas: x.cuotas, fecha: x.fecha });
      }),
      movimiento({ cuentaId: visa.id, importe: 1_210_00, fecha: c.cierre }),
    ];
    expect(deudaAlCierre(visa, [...anotado, ...nuevos], c.cierre)).toBe(79_710_00);
    // La heladera quedó como cuotas 2 a 6: las cinco que faltan.
    expect(nuevos[1]).toMatchObject({ importe: 200_000_00, cuotas: 5 });
  });

  it('un consumo con fecha anterior a cargar la tarjeta igual cuenta', () => {
    const visa = cuenta({ tipo: 'tarjeta-credito', fechaSaldo: '2026-09-15' });
    const leido = leerResumen(texto);
    const c = conciliar(visa, [], leido)!;
    const coto = c.faltantes.find((f) => f.importe === 8_500_00)!;
    const x = consumoComoCompra(coto, c.cierre, visa.fechaSaldo);
    expect(x.fecha).toBe(c.cierre);
    expect(deudaAlCierre(visa, [movimiento({ cuentaId: visa.id, importe: x.importe, fecha: x.fecha })], c.cierre)).toBe(8_500_00);
  });

  it('un resumen anterior a cargar la tarjeta no se compara', () => {
    const visa = cuenta({ tipo: 'tarjeta-credito', fechaSaldo: '2026-10-01' });
    expect(conciliar(visa, [], leerResumen(texto))?.anteriorALaTarjeta).toBe(true);
  });

  it('las compras en cuotas muestran la próxima cuota', () => {
    const visa = cuenta({ tipo: 'tarjeta-credito', fechaSaldo: '2026-08-01' });
    const m = movimiento({ cuentaId: visa.id, importe: 60_000_00, cuotas: 6, fecha: '2026-08-10' });
    // Cuota 1 venció el 5/9; la 2 vence el 5/10.
    expect(comprasEnCuotas(visa, [m], HOY)[0]).toMatchObject({ proxima: 2, faltaVencer: 50_000_00 });
  });
});

describe('préstamos', () => {
  const p = cuenta({ tipo: 'prestamo', nombre: 'Préstamo', saldoInicial: 600_000_00, fechaSaldo: '2026-08-20', diaVencimiento: 12, cuotaMensual: 55_000_00, cuotasRestantes: 12 });

  it('su saldo es deuda: pagar la cuota baja la deuda y la cuenta, y no es gasto', () => {
    const banco = cuenta({ saldoInicial: 200_000_00 });
    const pago = movimiento({ tipo: 'pago-tarjeta', cuentaId: banco.id, cuentaDestinoId: p.id, importe: 55_000_00, fecha: '2026-09-10' });
    expect(saldo(p, [pago])).toBe(545_000_00);
    expect(saldo(banco, [pago])).toBe(145_000_00);
  });

  it('las cuotas vencen el día elegido y los pagos van a la más vieja', () => {
    expect(cuotasPrestamo(p, [], '2026-10-31').map((c) => c.vencimiento)).toEqual(['2026-09-12', '2026-10-12']);
    const pago = movimiento({ tipo: 'pago-tarjeta', cuentaId: 'x', cuentaDestinoId: p.id, importe: 55_000_00, fecha: '2026-09-10' });
    expect(proximaCuota(p, [pago], HOY)?.vencimiento).toBe('2026-10-12');
    expect(cuotasAPagarHasta(p, [pago], '2026-10-12')).toBe(55_000_00);
  });

  it('entra en el disponible una sola vez y aparece entre los vencimientos', () => {
    const banco = cuenta({ saldoInicial: 200_000_00 });
    const d = datos({ cuentas: [banco, p], preferencias: { ...datos().preferencias, periodo: 'fin-de-mes' } });
    // La cuota del 12/9 venció sin pagar: se resta; el préstamo no suma como plata.
    expect(calcularDisponible(d, 'ARS', HOY).importe).toBe(145_000_00);
    expect(vencimientos(d, HOY)[0]).toMatchObject({ tipo: 'prestamo', fecha: '2026-09-12', importe: 55_000_00 });
  });

  it('no genera más cuotas que las que quedan', () => {
    const corto = { ...p, cuotasRestantes: 1 };
    expect(cuotasPrestamo(corto, [], '2027-12-31')).toHaveLength(1);
  });
});

describe('escenarios de deuda', () => {
  it('simula meses e intereses con la tasa mensual = anual / 12', () => {
    // 100.000 al 120 % anual (10 % mensual), pagando 30.000 por mes.
    const e = simular(100_000_00, 12000, 30_000_00);
    expect(e).toMatchObject({ termina: true, meses: 5 });
    if (e.termina) expect(e.totalPagado - e.intereses).toBe(100_000_00);
  });

  it('si el pago no cubre los intereses, lo dice en vez de dar un plazo', () => {
    expect(simular(100_000_00, 12000, 9_000_00)).toEqual({ termina: false, interesPrimerMes: 10_000_00 });
  });

  it('sin tasa, termina en saldo / pago meses', () => {
    expect(simular(100_000_00, 0, 25_000_00)).toMatchObject({ termina: true, meses: 4, intereses: 0 });
  });

  it('lee tasas escritas a mano', () => {
    expect(parseTasa('85,5')).toBe(8550);
    expect(parseTasa('69 %')).toBe(6900);
    expect(parseTasa('abc')).toBeNull();
  });
});
