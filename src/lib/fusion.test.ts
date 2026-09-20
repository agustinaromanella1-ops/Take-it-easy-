import { describe, expect, it } from 'vitest';
import { fusionar } from './fusion';
import type { AppData, Patient, Session } from '../types';

const AJUSTES: AppData['settings'] = {
  profession: 'psicología',
  currency: '$',
  defaultDurationMin: 50,
  chargeNoShowByDefault: true,
  monthlyGoal: 0,
  reminderMinutes: 30,
  avisarAntesMin: 0,
  rateInputs: {} as AppData['settings']['rateInputs'],
};

const pac = (id: string, name: string, updatedAt: string): Patient => ({
  id,
  updatedAt,
  name,
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
});

const ses = (id: string, updatedAt: string, status: Session['status'] = 'programada'): Session => ({
  id,
  updatedAt,
  patientId: 'p1',
  date: '2026-09-20',
  time: '10:00',
  durationMin: 50,
  status,
  fee: 3500000,
  chargeable: true,
  notes: '',
});

const datos = (p: Partial<AppData>): AppData => ({
  version: 2,
  patients: [],
  sessions: [],
  payments: [],
  deleted: { patients: [], sessions: [], payments: [] },
  settings: AJUSTES,
  ...p,
});

const T1 = '2026-09-20T10:00:00.000Z';
const T2 = '2026-09-20T11:00:00.000Z';
const T3 = '2026-09-20T12:00:00.000Z';

describe('fusionar', () => {
  it('junta lo que cada lado agregó por su cuenta', () => {
    // El caso de las dos pestañas: en una se marcó una sesión, en la otra se
    // cargó un paciente. Antes, la segunda en guardar borraba lo de la primera.
    const a = datos({ patients: [pac('p1', 'Ana', T1)] });
    const b = datos({ patients: [pac('p2', 'Luis', T1)] });
    const r = fusionar(a, b);
    expect(r.patients.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });

  it('del mismo registro gana el sello más nuevo, venga de donde venga', () => {
    const viejo = datos({ patients: [pac('p1', 'Ana', T1)] });
    const nuevo = datos({ patients: [pac('p1', 'Ana Gómez', T2)] });
    expect(fusionar(viejo, nuevo).patients[0]?.name).toBe('Ana Gómez');
    expect(fusionar(nuevo, viejo).patients[0]?.name).toBe('Ana Gómez');
  });

  it('una lápida más nueva que la edición borra', () => {
    const conDato = datos({ patients: [pac('p1', 'Ana', T1)] });
    const conLapida = datos({
      deleted: { patients: [{ id: 'p1', deletedAt: T2 }], sessions: [], payments: [] },
    });
    expect(fusionar(conDato, conLapida).patients).toEqual([]);
    expect(fusionar(conLapida, conDato).patients).toEqual([]);
  });

  it('pero una edición más nueva que la lápida gana: así se deshace un borrado', () => {
    const revivido = datos({ patients: [pac('p1', 'Ana', T3)] });
    const conLapida = datos({
      deleted: { patients: [{ id: 'p1', deletedAt: T2 }], sessions: [], payments: [] },
    });
    expect(fusionar(revivido, conLapida).patients.map((p) => p.id)).toEqual(['p1']);
  });

  it('el lado que no vio el borrado no revive lo borrado', () => {
    // Pestaña A borró a Ana. Pestaña B, que nunca se enteró, todavía la tiene.
    const aBorro = datos({
      deleted: { patients: [{ id: 'p1', deletedAt: T2 }], sessions: [], payments: [] },
    });
    const bNoSabe = datos({ patients: [pac('p1', 'Ana', T1)] });
    expect(fusionar(bNoSabe, aBorro).patients).toEqual([]);
  });

  it('las lápidas se acumulan de los dos lados', () => {
    const a = datos({ deleted: { patients: [{ id: 'p1', deletedAt: T1 }], sessions: [], payments: [] } });
    const b = datos({ deleted: { patients: [{ id: 'p2', deletedAt: T2 }], sessions: [], payments: [] } });
    expect(fusionar(a, b).deleted.patients.map((l) => l.id).sort()).toEqual(['p1', 'p2']);
  });

  it('de dos lápidas del mismo id queda la más nueva', () => {
    const a = datos({ deleted: { patients: [{ id: 'p1', deletedAt: T1 }], sessions: [], payments: [] } });
    const b = datos({ deleted: { patients: [{ id: 'p1', deletedAt: T3 }], sessions: [], payments: [] } });
    expect(fusionar(a, b).deleted.patients).toEqual([{ id: 'p1', deletedAt: T3 }]);
  });

  it('fusiona las tres colecciones, no solo los pacientes', () => {
    const a = datos({ sessions: [ses('s1', T1)] });
    const b = datos({ sessions: [ses('s1', T2, 'realizada')], patients: [pac('p1', 'Ana', T1)] });
    const r = fusionar(a, b);
    expect(r.sessions[0]?.status).toBe('realizada');
    expect(r.patients).toHaveLength(1);
  });

  it('es conmutativa salvo en los ajustes', () => {
    const a = datos({ patients: [pac('p1', 'Ana', T2)], sessions: [ses('s1', T1)] });
    const b = datos({
      patients: [pac('p1', 'Otra', T1), pac('p2', 'Luis', T1)],
      deleted: { patients: [], sessions: [{ id: 's1', deletedAt: T3 }], payments: [] },
    });
    const ab = fusionar(a, b);
    const ba = fusionar(b, a);
    expect(ab.patients.map((p) => p.id).sort()).toEqual(ba.patients.map((p) => p.id).sort());
    expect(ab.sessions).toEqual(ba.sessions);
  });

  it('fusionar algo consigo mismo no lo cambia', () => {
    const a = datos({ patients: [pac('p1', 'Ana', T1)], sessions: [ses('s1', T1)] });
    const r = fusionar(a, a);
    expect(r.patients).toEqual(a.patients);
    expect(r.sessions).toEqual(a.sessions);
  });

  it('los ajustes son los de quien guarda', () => {
    const a = datos({ settings: { ...AJUSTES, currency: 'U$S' } });
    const b = datos({ settings: { ...AJUSTES, currency: '€' } });
    expect(fusionar(a, b).settings.currency).toBe('U$S');
  });

  it('se queda con la versión de esquema más alta', () => {
    expect(fusionar(datos({ version: 2 }), datos({ version: 3 })).version).toBe(3);
  });

  it('aguanta que al otro lado le falten las listas de borrados', () => {
    const viejo = { ...datos({ patients: [pac('p1', 'Ana', T1)] }) };
    // @ts-expect-error: datos de una versión anterior, sin `deleted`.
    delete viejo.deleted;
    expect(fusionar(datos({}), viejo).patients).toHaveLength(1);
  });
});
