import { describe, expect, it } from 'vitest';
import { pendientes } from './pendientes';
import type { AppData, Patient, Payment, Session } from '../types';

const HOY = '2026-09-19';

const paciente = (id: string, extra: Partial<Patient> = {}): Patient => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  name: `Paciente ${id}`,
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
  createdAt: '2026-01-01',
  ...extra,
});

const sesion = (id: string, patientId: string, date: string, extra: Partial<Session> = {}): Session => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId,
  date,
  time: '10:00',
  durationMin: 50,
  status: 'realizada',
  fee: 3500000,
  chargeable: true,
  notes: '',
  ...extra,
});

const pago = (id: string, patientId: string, date: string, amount: number): Payment => ({
  id,
  updatedAt: '2026-01-01T00:00:00.000Z',
  patientId,
  date,
  amount,
  method: 'transferencia',
  notes: '',
});

const datos = (p: Partial<AppData>): AppData => ({
  version: 2,
  patients: [],
  sessions: [],
  payments: [],
  deleted: { patients: [], sessions: [], payments: [] },
  settings: {
    profession: 'psicología',
    currency: '$',
    defaultDurationMin: 50,
    chargeNoShowByDefault: true,
    monthlyGoal: 0,
    reminderMinutes: 30,
    avisarAntesMin: 0,
    rateInputs: {} as AppData['settings']['rateInputs'],
  },
  ...p,
});

describe('pendientes', () => {
  it('sin datos no inventa tareas', () => {
    expect(pendientes(datos({}), HOY)).toEqual([]);
  });

  it('pone primero una sesión que ya pasó y quedó sin cerrar', () => {
    const d = datos({
      patients: [paciente('p1')],
      sessions: [sesion('s1', 'p1', '2026-09-15', { status: 'programada' })],
    });
    const r = pendientes(d, HOY);
    expect(r[0]).toMatchObject({ tipo: 'cerrar' });
  });

  it('una sesión de hoy todavía no es algo sin cerrar', () => {
    const d = datos({
      patients: [paciente('p1')],
      sessions: [sesion('s1', 'p1', HOY, { status: 'programada' })],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'cerrar')).toBe(false);
  });

  it('entre dos sin cerrar, primero la más vieja', () => {
    const d = datos({
      patients: [paciente('p1')],
      sessions: [
        sesion('s1', 'p1', '2026-09-17', { status: 'programada' }),
        sesion('s2', 'p1', '2026-09-01', { status: 'programada' }),
      ],
    });
    const r = pendientes(d, HOY).filter((x) => x.tipo === 'cerrar');
    expect(r[0]?.tipo === 'cerrar' && r[0].sesion.id).toBe('s2');
  });

  it('avisa del paciente semanal que se quedó sin próximo turno', () => {
    const d = datos({
      patients: [paciente('p1')],
      sessions: [sesion('s1', 'p1', '2026-09-05')],
      payments: [pago('g1', 'p1', '2026-09-05', 3500000)],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'agendar')).toBe(true);
  });

  it('no avisa si ya tiene el próximo turno agendado', () => {
    const d = datos({
      patients: [paciente('p1')],
      sessions: [
        sesion('s1', 'p1', '2026-09-05'),
        sesion('s2', 'p1', '2026-09-26', { status: 'programada' }),
      ],
      payments: [pago('g1', 'p1', '2026-09-05', 3500000)],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'agendar')).toBe(false);
  });

  it('a un quincenal le da su tiempo antes de avisar', () => {
    const hace10dias = datos({
      patients: [paciente('p1', { frequency: 'quincenal' })],
      sessions: [sesion('s1', 'p1', '2026-09-09')],
      payments: [pago('g1', 'p1', '2026-09-09', 3500000)],
    });
    expect(pendientes(hace10dias, HOY).some((x) => x.tipo === 'agendar')).toBe(false);
  });

  it('no persigue a quien viene solo cuando puede', () => {
    const d = datos({
      patients: [paciente('p1', { frequency: 'puntual' })],
      sessions: [sesion('s1', 'p1', '2026-01-05')],
      payments: [pago('g1', 'p1', '2026-01-05', 3500000)],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'agendar')).toBe(false);
  });

  it('ni a quien ya no está en tratamiento', () => {
    const d = datos({
      patients: [paciente('p1', { status: 'inactivo' })],
      sessions: [sesion('s1', 'p1', '2026-01-05')],
    });
    expect(pendientes(d, HOY)).toEqual([]);
  });

  it('nombra una deuda vieja', () => {
    const d = datos({
      patients: [paciente('p1', { frequency: 'puntual' })],
      sessions: [sesion('s1', 'p1', '2026-06-01')],
    });
    const r = pendientes(d, HOY);
    expect(r.some((x) => x.tipo === 'cobrar')).toBe(true);
  });

  it('no nombra la del mes en curso: cobrar a fin de mes es lo normal', () => {
    const d = datos({
      patients: [paciente('p1', { frequency: 'puntual' })],
      sessions: [sesion('s1', 'p1', '2026-09-10')],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'cobrar')).toBe(false);
  });

  it('quien paga todos los meses y debe el último no tiene una deuda vieja', () => {
    // Paciente desde marzo, al día salvo la sesión de la semana pasada.
    const d = datos({
      patients: [paciente('p1', { frequency: 'puntual' })],
      sessions: [
        sesion('s1', 'p1', '2026-03-02'),
        sesion('s2', 'p1', '2026-04-02'),
        sesion('s3', 'p1', '2026-09-12'),
      ],
      payments: [pago('g1', 'p1', '2026-04-05', 7000000)],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'cobrar')).toBe(false);
  });

  it('pero sí la de quien dejó de pagar hace meses', () => {
    const d = datos({
      patients: [paciente('p1', { frequency: 'puntual' })],
      sessions: [
        sesion('s1', 'p1', '2026-03-02'),
        sesion('s2', 'p1', '2026-04-02'),
        sesion('s3', 'p1', '2026-09-12'),
      ],
      payments: [pago('g1', 'p1', '2026-03-05', 3500000)],
    });
    const r = pendientes(d, HOY);
    const cobrar = r.find((x) => x.tipo === 'cobrar');
    expect(cobrar?.tipo === 'cobrar' && cobrar.monto).toBe(7000000);
  });

  it('una ausencia que no se cobra no genera deuda', () => {
    const d = datos({
      patients: [paciente('p1', { frequency: 'puntual' })],
      sessions: [sesion('s1', 'p1', '2026-06-01', { status: 'ausente', chargeable: false })],
    });
    expect(pendientes(d, HOY).some((x) => x.tipo === 'cobrar')).toBe(false);
  });

  it('entre dos sin turno, primero el que hace más que no viene', () => {
    // Antes desempataba la clave, o sea el id al azar: de dos pacientes sin
    // turno podía salir primero el de 8 días en vez del de 300.
    const d = datos({
      patients: [paciente('zzz'), paciente('aaa')],
      sessions: [sesion('s1', 'zzz', '2025-11-20'), sesion('s2', 'aaa', '2026-09-05')],
      payments: [pago('g1', 'zzz', '2025-11-20', 3500000), pago('g2', 'aaa', '2026-09-05', 3500000)],
    });
    const r = pendientes(d, HOY).filter((x) => x.tipo === 'agendar');
    expect(r[0]?.tipo === 'agendar' && r[0].paciente.id).toBe('zzz');
  });

  it('entre dos deudas, primero la más vieja', () => {
    const d = datos({
      patients: [paciente('zzz', { frequency: 'puntual' }), paciente('aaa', { frequency: 'puntual' })],
      sessions: [sesion('s1', 'zzz', '2025-12-01'), sesion('s2', 'aaa', '2026-07-20')],
    });
    const r = pendientes(d, HOY).filter((x) => x.tipo === 'cobrar');
    expect(r[0]?.tipo === 'cobrar' && r[0].paciente.id).toBe('zzz');
  });

  it('una sesión de anoche que todavía corre no "quedó sin marcar"', () => {
    const d = datos({
      patients: [paciente('p1')],
      // De 23:00 a 01:00; son las 00:10.
      sessions: [sesion('s1', 'p1', '2026-09-18', { status: 'programada', time: '23:00', durationMin: 120 })],
    });
    expect(pendientes(d, HOY, 10).some((x) => x.tipo === 'cerrar')).toBe(false);
    // Y una vez terminada, sí.
    expect(pendientes(d, HOY, 65).some((x) => x.tipo === 'cerrar')).toBe(true);
  });

  it('cuenta los días desde la fecha local, no desde la UTC', () => {
    // Cargado un jueves 22:00 en Argentina: el sello UTC ya dice viernes.
    const d = datos({
      patients: [paciente('p1', { createdAt: '2026-09-11T01:00:00.000Z' })],
    });
    const r = pendientes(d, '2026-09-18').find((x) => x.tipo === 'agendar');
    // 10 de septiembre local -> 8 días, no 7.
    expect(r?.tipo === 'agendar' && r.desdeDias).toBe(8);
  });

  it('lo sin cerrar va antes que lo demás', () => {
    const d = datos({
      patients: [paciente('p1'), paciente('p2', { frequency: 'puntual' })],
      sessions: [
        sesion('s1', 'p1', '2026-09-17', { status: 'programada' }),
        sesion('s2', 'p2', '2026-06-01'),
      ],
    });
    expect(pendientes(d, HOY)[0]?.tipo).toBe('cerrar');
  });
});
