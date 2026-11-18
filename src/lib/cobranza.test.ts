import { describe, expect, it } from 'vitest';
import { cobranzaDelMes, cuentasPorPaciente, imputarPagos, sobranteNoImputado, totalesDelMes } from './cobranza';
import type { AppData, Patient, Payment, Session } from '../types';

const paciente = (id: string): Patient => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: `Paciente ${id}`,
  email: '',
  phone: '',
  defaultFee: 5000000,
  status: 'activo',
  colorIndex: 0,
  frequency: 'semanal',
  kind: 'particular',
  legalName: '',
  document: '',
  taxId: '',
  taxCondition: 'consumidor_final',
  memberNumber: '',
  insurer: '',
  institutionPercent: 0,
  lastRaise: null,
  notes: '',
  createdAt: '2026-01-01',
});

const sesion = (id: string, date: string, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId: 'p1',
  date,
  time: '10:00',
  durationMin: 50,
  status: 'realizada',
  fee: 5000000,
  chargeable: true,
  notes: '',
  ...extra,
});

const pago = (id: string, date: string, amount: number, extra: Partial<Payment> = {}): Payment => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId: 'p1',
  date,
  amount,
  method: 'efectivo',
  notes: '',
  ...extra,
});

const datos = (sessions: Session[], payments: Payment[] = [], patients = [paciente('p1')]): AppData =>
  ({ patients, sessions, payments }) as unknown as AppData;

describe('imputar los pagos a las sesiones', () => {
  it('el pago atado va a SU sesión, aunque haya otra más vieja impaga', () => {
    const ses = [sesion('vieja', '2026-10-07'), sesion('nueva', '2026-11-04')];
    const imp = imputarPagos(ses, [pago('g1', '2026-11-04', 5000000, { sessionId: 'nueva' })]);
    expect(imp.get('nueva')).toBe(5000000);
    expect(imp.get('vieja')).toBe(0);
  });

  it('lo suelto se imputa de la más vieja a la más nueva', () => {
    const ses = [sesion('b', '2026-11-04'), sesion('a', '2026-10-07')];
    const imp = imputarPagos(ses, [pago('g1', '2026-11-20', 5000000)]);
    expect(imp.get('a')).toBe(5000000);
    expect(imp.get('b')).toBe(0);
  });

  it('un pago grande cubre varias sesiones en orden', () => {
    const ses = [sesion('a', '2026-10-07'), sesion('b', '2026-10-14'), sesion('c', '2026-11-04')];
    const imp = imputarPagos(ses, [pago('g1', '2026-11-01', 12000000)]);
    expect(imp.get('a')).toBe(5000000);
    expect(imp.get('b')).toBe(5000000);
    expect(imp.get('c')).toBe(2000000);
  });

  it('lo que sobra de un pago atado se reparte, no se pierde', () => {
    const ses = [sesion('a', '2026-10-07'), sesion('b', '2026-11-04')];
    const imp = imputarPagos(ses, [pago('g1', '2026-11-04', 8000000, { sessionId: 'b' })]);
    expect(imp.get('b')).toBe(5000000);
    expect(imp.get('a')).toBe(3000000);
  });

  it('un pago de más no infla ninguna sesión', () => {
    const imp = imputarPagos([sesion('a', '2026-10-07')], [pago('g1', '2026-10-07', 9000000)]);
    expect(imp.get('a')).toBe(5000000);
  });

  it('un pago atado a una sesión que no factura cae en la bolsa', () => {
    const ses = [sesion('cancel', '2026-10-01', { status: 'cancelada' }), sesion('a', '2026-10-07')];
    const imp = imputarPagos(ses, [pago('g1', '2026-10-07', 5000000, { sessionId: 'cancel' })]);
    expect(imp.get('a')).toBe(5000000);
  });

  it('una ausencia que no se cobra no es una sesión a pagar', () => {
    const ses = [sesion('f', '2026-10-01', { status: 'ausente', chargeable: false }), sesion('a', '2026-10-07')];
    const imp = imputarPagos(ses, [pago('g1', '2026-10-07', 5000000)]);
    expect(imp.has('f')).toBe(false);
    expect(imp.get('a')).toBe(5000000);
  });
});

describe('la cobranza de un mes', () => {
  it('el pago de noviembre por una sesión de octubre salda OCTUBRE', () => {
    // Es el caso que motivó todo esto: cobrar el mes vencido dejaba el mes
    // viejo impago para siempre y le bajaba lo pendiente al mes nuevo.
    const d = datos(
      [sesion('oct', '2026-10-07'), sesion('nov', '2026-11-04')],
      [pago('g1', '2026-11-05', 5000000)],
    );
    const octubre = cobranzaDelMes(d, '2026-10')[0];
    const noviembre = cobranzaDelMes(d, '2026-11')[0];
    expect(octubre?.pendiente).toBe(0);
    expect(noviembre?.pendiente).toBe(5000000);
  });

  it('pagar por adelantado no deja el mes siguiente entero por cobrar', () => {
    const d = datos(
      [sesion('nov', '2026-11-04')],
      [pago('g1', '2026-10-28', 5000000, { sessionId: 'nov' })],
    );
    expect(cobranzaDelMes(d, '2026-11')[0]?.pendiente).toBe(0);
  });

  it('solo aparece quien facturó ESE mes', () => {
    const d = datos([sesion('oct', '2026-10-07')]);
    expect(cobranzaDelMes(d, '2026-11')).toEqual([]);
    expect(cobranzaDelMes(d, '2026-10')).toHaveLength(1);
  });

  it('una deuda vieja no se arrastra al renglón del mes nuevo', () => {
    const d = datos([sesion('oct', '2026-10-07'), sesion('nov', '2026-11-04')]);
    expect(cobranzaDelMes(d, '2026-11')[0]?.facturado).toBe(5000000);
  });

  it('lo pendiente nunca es negativo, por más que haya pagado de más', () => {
    const d = datos([sesion('nov', '2026-11-04')], [pago('g1', '2026-11-04', 9000000)]);
    expect(cobranzaDelMes(d, '2026-11')[0]?.pendiente).toBe(0);
  });

  it('cada paciente lleva su propia cuenta', () => {
    const d = datos(
      [sesion('a', '2026-11-04'), sesion('b', '2026-11-05', { patientId: 'p2' })],
      [pago('g1', '2026-11-06', 5000000, { patientId: 'p2' })],
      [paciente('p1'), paciente('p2')],
    );
    const mes = cobranzaDelMes(d, '2026-11');
    expect(mes.find((f) => f.patient.id === 'p1')?.pendiente).toBe(5000000);
    expect(mes.find((f) => f.patient.id === 'p2')?.pendiente).toBe(0);
  });

  it('ordena por lo que falta cobrar', () => {
    const d = datos(
      [
        sesion('a', '2026-11-04', { fee: 1000000 }),
        sesion('b', '2026-11-05', { patientId: 'p2', fee: 9000000 }),
      ],
      [],
      [paciente('p1'), paciente('p2')],
    );
    expect(cobranzaDelMes(d, '2026-11')[0]?.patient.id).toBe('p2');
  });

  it('los totales suman lo que muestran las filas', () => {
    const d = datos(
      [sesion('a', '2026-11-04'), sesion('b', '2026-11-11')],
      [pago('g1', '2026-11-04', 5000000)],
    );
    expect(totalesDelMes(cobranzaDelMes(d, '2026-11'))).toEqual({
      facturado: 10000000,
      cobrado: 5000000,
      pendiente: 5000000,
    });
  });
});

describe('la cuenta de cada paciente, mes por mes', () => {
  it('arma un renglón por mes con sesiones, del más nuevo al más viejo', () => {
    const d = datos([sesion('a', '2026-10-07'), sesion('b', '2026-10-14'), sesion('c', '2026-11-04')]);
    const cuenta = cuentasPorPaciente(d)[0]!;
    expect(cuenta.meses.map((m) => m.mes)).toEqual(['2026-11', '2026-10']);
    expect(cuenta.meses[1]!.sesiones).toBe(2);
    expect(cuenta.meses[1]!.facturado).toBe(10000000);
  });

  it('un mes sin sesiones no es un renglón vacío', () => {
    const d = datos([sesion('a', '2026-09-07'), sesion('b', '2026-11-04')]);
    expect(cuentasPorPaciente(d)[0]!.meses.map((m) => m.mes)).toEqual(['2026-11', '2026-09']);
  });

  it('el depósito de noviembre se ve saldando octubre, que es la pregunta', () => {
    const d = datos(
      [sesion('oct', '2026-10-07'), sesion('nov', '2026-11-04')],
      [pago('g1', '2026-11-10', 5000000)],
    );
    const meses = cuentasPorPaciente(d)[0]!.meses;
    expect(meses.find((m) => m.mes === '2026-10')?.cobrado).toBe(5000000);
    expect(meses.find((m) => m.mes === '2026-11')?.cobrado).toBe(0);
  });

  it('los totales son la suma de los meses', () => {
    const d = datos(
      [sesion('a', '2026-10-07'), sesion('b', '2026-11-04')],
      [pago('g1', '2026-11-10', 5000000)],
    );
    const cuenta = cuentasPorPaciente(d)[0]!;
    expect(cuenta.facturado).toBe(10000000);
    expect(cuenta.cobrado).toBe(5000000);
    expect(cuenta.debe).toBe(5000000);
  });

  it('lo pagado de más queda como saldo a favor y no se pierde', () => {
    const d = datos([sesion('a', '2026-11-04')], [pago('g1', '2026-11-04', 8000000)]);
    const cuenta = cuentasPorPaciente(d)[0]!;
    expect(cuenta.debe).toBe(0);
    expect(cuenta.aFavor).toBe(3000000);
  });

  it('sin deuda ni pagos de más, no hay saldo a favor', () => {
    const d = datos([sesion('a', '2026-11-04')], [pago('g1', '2026-11-04', 5000000)]);
    expect(cuentasPorPaciente(d)[0]!.aFavor).toBe(0);
  });

  it('primero quien más debe, porque es una lista para reclamar', () => {
    const d = datos(
      [sesion('a', '2026-11-04', { fee: 1000000 }), sesion('b', '2026-11-05', { patientId: 'p2', fee: 9000000 })],
      [],
      [paciente('p1'), paciente('p2')],
    );
    expect(cuentasPorPaciente(d).map((c) => c.patient.id)).toEqual(['p2', 'p1']);
  });

  it('un paciente sin sesiones ni pagos no ocupa lugar', () => {
    const d = datos([sesion('a', '2026-11-04')], [], [paciente('p1'), paciente('p2')]);
    expect(cuentasPorPaciente(d).map((c) => c.patient.id)).toEqual(['p1']);
  });

  it('pero uno que solo pagó sí aparece, con su saldo a favor', () => {
    const d = datos([], [pago('g1', '2026-11-04', 5000000)]);
    const cuenta = cuentasPorPaciente(d)[0]!;
    expect(cuenta.meses).toEqual([]);
    expect(cuenta.aFavor).toBe(5000000);
  });
});

describe('el sobrante sin imputar', () => {
  it('es lo que entró menos lo que se pudo asignar', () => {
    expect(sobranteNoImputado([sesion('a', '2026-11-04')], [pago('g1', '2026-11-04', 8000000)])).toBe(3000000);
  });

  it('nunca es negativo', () => {
    expect(sobranteNoImputado([sesion('a', '2026-11-04')], [])).toBe(0);
  });
});
