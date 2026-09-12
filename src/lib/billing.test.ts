import { describe, expect, it } from 'vitest';
import type { Patient, Session } from '../types';
import { billingLine, billingText, formatDateList, invoiceFields, invoiceName } from './billing';

function patient(over: Partial<Patient> = {}): Patient {
  return {
    id: 'p1',
    name: 'María Gómez',
    email: '',
    phone: '',
    defaultFee: 3500000,
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
    lastRaise: null,
    notes: '',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

function session(id: string, date: string, over: Partial<Session> = {}): Session {
  return {
    id,
    patientId: 'p1',
    date,
    time: '10:00',
    durationMin: 50,
    status: 'realizada',
    fee: 3500000,
    chargeable: true,
    notes: '',
    ...over,
  };
}

const OPCIONES = { profession: 'psicología', currency: '$' };

describe('formatDateList', () => {
  it('agrupa los días bajo un solo mes', () => {
    expect(formatDateList(['2026-03-03', '2026-03-10', '2026-03-17'])).toBe('3, 10 y 17 de marzo');
  });

  it('con un solo día no usa la conjunción', () => {
    expect(formatDateList(['2026-03-03'])).toBe('3 de marzo');
  });

  it('con dos días usa solo "y", sin coma', () => {
    expect(formatDateList(['2026-03-03', '2026-03-10'])).toBe('3 y 10 de marzo');
  });

  it('separa por mes cuando el período los cruza', () => {
    expect(formatDateList(['2026-03-24', '2026-03-31', '2026-04-07'])).toBe('24 y 31 de marzo y 7 de abril');
  });

  it('ordena las fechas aunque lleguen desordenadas', () => {
    expect(formatDateList(['2026-03-17', '2026-03-03'])).toBe('3 y 17 de marzo');
  });

  it('sin fechas devuelve vacío', () => {
    expect(formatDateList([])).toBe('');
  });
});

describe('billingLine', () => {
  const sessions = [
    session('a', '2026-03-03'),
    session('b', '2026-03-10'),
    session('fuera', '2026-04-07'),
    session('cancelada', '2026-03-17', { status: 'cancelada' }),
    session('ausente-sin-cargo', '2026-03-24', { status: 'ausente', chargeable: false }),
    session('otro-paciente', '2026-03-05', { patientId: 'p2' }),
    session('programada', '2026-03-31', { status: 'programada' }),
  ];

  it('toma solo las sesiones facturables del paciente y del período', () => {
    const line = billingLine(patient(), sessions, '2026-03-01', '2026-03-31');
    expect(line.dates).toEqual(['2026-03-03', '2026-03-10']);
    expect(line.total).toBe(7000000);
  });

  it('incluye la ausencia que sí se cobra', () => {
    const conAusencia = [...sessions, session('ausente-con-cargo', '2026-03-26', { status: 'ausente', chargeable: true })];
    const line = billingLine(patient(), conAusencia, '2026-03-01', '2026-03-31');
    expect(line.dates).toContain('2026-03-26');
  });

  it('detecta el honorario único', () => {
    expect(billingLine(patient(), sessions, '2026-03-01', '2026-03-31').unitFee).toBe(3500000);
  });

  it('no inventa un honorario único si hubo aumento en el período', () => {
    const conAumento = [session('a', '2026-03-03', { fee: 3500000 }), session('b', '2026-03-24', { fee: 4000000 })];
    expect(billingLine(patient(), conAumento, '2026-03-01', '2026-03-31').unitFee).toBeNull();
  });

  it('sin sesiones devuelve la línea en cero', () => {
    const line = billingLine(patient(), [], '2026-03-01', '2026-03-31');
    expect(line.dates).toEqual([]);
    expect(line.total).toBe(0);
  });
});

describe('billingText', () => {
  const tres = [session('a', '2026-03-03'), session('b', '2026-03-10'), session('c', '2026-03-17')];

  it('arma el texto con afiliado, fechas y valor', () => {
    const line = billingLine(patient({ memberNumber: '123456/01' }), tres, '2026-03-01', '2026-03-31');
    expect(billingText(line, OPCIONES)).toBe(
      'Honorarios por sesión de psicología del paciente María Gómez, N.º de afiliado 123456/01, ' +
        'los días 3, 10 y 17 de marzo. Valor de la sesión: $ 35.000. Total: $ 105.000 (3 sesiones).',
    );
  });

  it('usa el DNI cuando no hay número de afiliado', () => {
    const line = billingLine(patient({ document: '30123456' }), tres, '2026-03-01', '2026-03-31');
    expect(billingText(line, OPCIONES)).toContain('DNI 30123456');
    expect(billingText(line, OPCIONES)).not.toContain('afiliado');
  });

  it('informa los dos cuando están los dos', () => {
    const line = billingLine(patient({ document: '30123456', memberNumber: '999' }), tres, '2026-03-01', '2026-03-31');
    expect(billingText(line, OPCIONES)).toContain('N.º de afiliado 999 y DNI 30123456');
  });

  it('omite los identificadores en vez de dejar el hueco vacío', () => {
    // Una factura que dice "DNI:" sin número se ve peor que una que no lo menciona.
    const texto = billingText(billingLine(patient(), tres, '2026-03-01', '2026-03-31'), OPCIONES);
    expect(texto).not.toContain('DNI');
    expect(texto).not.toContain('afiliado');
    expect(texto).toContain('del paciente María Gómez, los días');
  });

  it('usa el singular con una sola sesión y no muestra total', () => {
    const line = billingLine(patient(), [session('a', '2026-03-03')], '2026-03-01', '2026-03-31');
    const texto = billingText(line, OPCIONES);
    expect(texto).toContain('el día 3 de marzo');
    expect(texto).not.toContain('Total');
  });

  it('detalla sesión por sesión si hubo aumento en el período', () => {
    const conAumento = [session('a', '2026-03-03', { fee: 3500000 }), session('b', '2026-03-24', { fee: 4000000 })];
    const texto = billingText(billingLine(patient(), conAumento, '2026-03-01', '2026-03-31'), OPCIONES);
    expect(texto).toContain('Valor de cada sesión: 3/03: $ 35.000, 24/03: $ 40.000');
    expect(texto).toContain('Total: $ 75.000');
    expect(texto).not.toContain('Valor de la sesión:');
  });

  it('respeta la profesión configurada', () => {
    const line = billingLine(patient(), tres, '2026-03-01', '2026-03-31');
    expect(billingText(line, { ...OPCIONES, profession: 'psicopedagogía' })).toContain('sesión de psicopedagogía');
  });

  it('avisa cuando no hay nada que facturar', () => {
    const line = billingLine(patient(), [], '2026-03-01', '2026-03-31');
    expect(billingText(line, OPCIONES)).toBe('No hay sesiones facturables de María Gómez en el período elegido.');
  });
});

describe('invoiceName', () => {
  it('prefiere el nombre completo cuando está cargado', () => {
    expect(invoiceName(patient({ legalName: 'María Elena Gómez Sosa' }))).toBe('María Elena Gómez Sosa');
  });

  it('cae al nombre de la agenda si no hay nombre completo', () => {
    expect(invoiceName(patient())).toBe('María Gómez');
  });

  it('ignora un nombre completo que es solo espacios', () => {
    expect(invoiceName(patient({ legalName: '   ' }))).toBe('María Gómez');
  });

  it('el texto de la factura usa el nombre completo', () => {
    const p = patient({ legalName: 'María Elena Gómez Sosa' });
    const line = billingLine(p, [session('a', '2026-03-03')], '2026-03-01', '2026-03-31');
    expect(billingText(line, OPCIONES)).toContain('del paciente María Elena Gómez Sosa');
  });
});

describe('invoiceFields', () => {
  it('arma las filas para transcribir a la factura', () => {
    const p = patient({ legalName: 'María Elena Gómez', document: '30123456', taxId: '27301234568',
      taxCondition: 'monotributo', insurer: 'OSDE', memberNumber: '999/01' });
    expect(invoiceFields(p)).toEqual([
      { label: 'Nombre completo', value: 'María Elena Gómez' },
      { label: 'DNI', value: '30123456' },
      { label: 'CUIT / CUIL', value: '27301234568' },
      { label: 'Condición frente al IVA', value: 'Monotributista' },
      { label: 'Obra social', value: 'OSDE' },
      { label: 'N.º de afiliado', value: '999/01' },
    ]);
  });

  it('omite los campos sin dato en vez de mostrarlos vacíos', () => {
    // Con filas vacías habría que revisar cuáles están completas en lugar de
    // leer y copiar de corrido.
    const labels = invoiceFields(patient({ document: '30123456' })).map((f) => f.label);
    expect(labels).toEqual(['Nombre completo', 'DNI', 'Condición frente al IVA']);
  });

  it('la condición siempre está: consumidor final es un dato, no un vacío', () => {
    const campos = invoiceFields(patient());
    expect(campos.find((f) => f.label === 'Condición frente al IVA')?.value).toBe('Consumidor final');
  });
});
