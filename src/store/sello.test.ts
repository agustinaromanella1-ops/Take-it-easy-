import { describe, expect, it } from 'vitest';
import { reducer, type Action } from './reducer';
import { emptyData, parseAppData, SCHEMA_VERSION } from '../lib/storage';
import type { AppData } from '../types';

/**
 * El sello y las lápidas.
 *
 * Nada de esto se ve en pantalla: existe para que el día que la app
 * sincronice entre dispositivos se pueda decidir cuál de dos versiones del
 * mismo registro es la buena, y distinguir "esto es nuevo acá" de "esto se
 * borró allá". Ver SINCRONIZACION.md.
 */
const aplicar = (estado: AppData, ...acciones: Action[]): AppData =>
  acciones.reduce(reducer, estado);

function conUnPaciente(): AppData {
  return reducer(emptyData(), {
    type: 'patient/add',
    payload: {
      name: 'Ana', email: '', phone: '', defaultFee: 500000, status: 'activo', colorIndex: 0,
      frequency: 'semanal', kind: 'particular', legalName: '', taxId: '', taxCondition: 'consumidor_final',
      memberId: '', notes: '', lastRaise: null,
    } as never,
  });
}

describe('sello de modificación', () => {
  it('se pone al crear', () => {
    const d = conUnPaciente();
    expect(d.patients[0]!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('se renueva al editar', async () => {
    const d = conUnPaciente();
    const antes = d.patients[0]!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    const despues = reducer(d, { type: 'patient/update', payload: { ...d.patients[0]!, name: 'Ana María' } });
    expect(despues.patients[0]!.updatedAt > antes).toBe(true);
  });

  it('no toca a los demás registros', async () => {
    let d = conUnPaciente();
    d = reducer(d, { type: 'session/add', payload: {
      patientId: d.patients[0]!.id, date: '2026-03-10', time: '10:00', durationMin: 50,
      status: 'programada', fee: 500000, chargeable: true, notes: '',
    } });
    const selloSesion = d.sessions[0]!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    d = reducer(d, { type: 'patient/update', payload: { ...d.patients[0]!, name: 'Otra' } });
    expect(d.sessions[0]!.updatedAt).toBe(selloSesion);
  });

  it('lo pone el reducer y no quien despacha: cambiar el estado de una sesión también sella', async () => {
    let d = conUnPaciente();
    d = reducer(d, { type: 'session/add', payload: {
      patientId: d.patients[0]!.id, date: '2026-03-10', time: '10:00', durationMin: 50,
      status: 'programada', fee: 500000, chargeable: true, notes: '',
    } });
    const antes = d.sessions[0]!.updatedAt;
    await new Promise((r) => setTimeout(r, 2));
    d = reducer(d, { type: 'session/setStatus', payload: { id: d.sessions[0]!.id, status: 'realizada' } });
    expect(d.sessions[0]!.updatedAt > antes).toBe(true);
  });
});

describe('lápidas', () => {
  it('borrar una sesión deja su marca', () => {
    let d = conUnPaciente();
    d = reducer(d, { type: 'session/add', payload: {
      patientId: d.patients[0]!.id, date: '2026-03-10', time: '10:00', durationMin: 50,
      status: 'programada', fee: 500000, chargeable: true, notes: '',
    } });
    const id = d.sessions[0]!.id;
    d = reducer(d, { type: 'session/remove', payload: { id } });
    expect(d.sessions).toHaveLength(0);
    expect(d.deleted.sessions.map((l) => l.id)).toEqual([id]);
  });

  it('borrar un paciente entierra también sus sesiones y sus pagos', () => {
    let d = conUnPaciente();
    const pac = d.patients[0]!.id;
    d = aplicar(d,
      { type: 'session/add', payload: { patientId: pac, date: '2026-03-10', time: '10:00', durationMin: 50, status: 'realizada', fee: 500000, chargeable: true, notes: '' } },
      { type: 'payment/add', payload: { patientId: pac, date: '2026-03-10', amount: 500000, method: 'efectivo', notes: '' } },
      { type: 'patient/remove', payload: { id: pac } },
    );
    expect(d.patients).toHaveLength(0);
    expect(d.deleted.patients).toHaveLength(1);
    // Sin esto, otro dispositivo devolvería las sesiones de un paciente que ya
    // no existe.
    expect(d.deleted.sessions).toHaveLength(1);
    expect(d.deleted.payments).toHaveLength(1);
  });

  it('la lápida guarda el id y la fecha, nunca el contenido', () => {
    let d = conUnPaciente();
    const pac = d.patients[0]!.id;
    d = reducer(d, { type: 'patient/remove', payload: { id: pac } });
    const lapida = d.deleted.patients[0]!;
    expect(Object.keys(lapida).sort()).toEqual(['deletedAt', 'id']);
    expect(JSON.stringify(d.deleted)).not.toContain('Ana');
  });

  it('borrar dos veces el mismo id no duplica la marca', () => {
    let d = conUnPaciente();
    const pac = d.patients[0]!.id;
    d = reducer(d, { type: 'patient/remove', payload: { id: pac } });
    d = reducer(d, { type: 'patient/remove', payload: { id: pac } });
    expect(d.deleted.patients).toHaveLength(1);
  });
});

describe('migración desde la versión 1', () => {
  const viejo = {
    version: 1,
    patients: [{ id: 'p1', name: 'Ana', email: '', phone: '', defaultFee: 500000, status: 'activo',
      colorIndex: 0, frequency: 'semanal', kind: 'particular', legalName: '', taxId: '',
      taxCondition: 'consumidor_final', memberId: '', notes: '', createdAt: '2025-01-01', lastRaise: null }],
    sessions: [{ id: 's1', patientId: 'p1', date: '2026-03-10', time: '10:00', durationMin: 50,
      status: 'realizada', fee: 500000, chargeable: true, notes: '' }],
    payments: [{ id: 'g1', patientId: 'p1', date: '2026-03-10', amount: 500000, method: 'efectivo', notes: '' }],
    settings: {},
  };

  it('no pierde ningún registro', () => {
    const d = parseAppData(viejo);
    expect(d.patients).toHaveLength(1);
    expect(d.sessions).toHaveLength(1);
    expect(d.payments).toHaveLength(1);
  });

  it('le inventa un sello a lo que no lo tenía, porque esa fecha no existe en ningún lado', () => {
    const d = parseAppData(viejo);
    expect(d.patients[0]!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(d.sessions[0]!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(d.payments[0]!.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('respeta el sello que ya viene, en vez de pisarlo', () => {
    const conSello = { ...viejo, patients: [{ ...viejo.patients[0], updatedAt: '2026-01-05T12:00:00.000Z' }] };
    expect(parseAppData(conSello).patients[0]!.updatedAt).toBe('2026-01-05T12:00:00.000Z');
  });

  it('deja las listas de borrados vacías y no undefined', () => {
    const d = parseAppData(viejo);
    expect(d.deleted).toEqual({ patients: [], sessions: [], payments: [] });
  });

  it('sube la versión del esquema', () => {
    expect(parseAppData(viejo).version).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe(2);
  });

  it('descarta una lápida rota en vez de romper la carga entera', () => {
    const d = parseAppData({ ...viejo, deleted: { patients: [{ id: 'x', deletedAt: '2026-01-01T00:00:00Z' }, { id: '' }, null], sessions: 'no es una lista', payments: [] } });
    expect(d.deleted.patients).toHaveLength(1);
    expect(d.deleted.sessions).toEqual([]);
  });
});

describe('la migración se guarda, no solo se aplica al leer', () => {
  it('el sello de un registro migrado no cambia entre arranques', () => {
    // Si la versión migrada no se persiste, cada arranque le inventa un sello
    // nuevo a lo que no lo tenía: un registro que nadie tocó parecería recién
    // editado cada vez que se abre la app.
    const viejo = {
      version: 1,
      patients: [{ id: 'p1', name: 'Ana', email: '', phone: '', defaultFee: 500000, status: 'activo',
        colorIndex: 0, frequency: 'semanal', kind: 'particular', legalName: '', taxId: '',
        taxCondition: 'consumidor_final', memberId: '', notes: '', createdAt: '2025-01-01', lastRaise: null }],
      sessions: [], payments: [], settings: {},
    };
    const primera = parseAppData(viejo);
    // Lo que se guarda vuelve a leerse igual: el sello ya viaja en los datos.
    const segunda = parseAppData(JSON.parse(JSON.stringify(primera)));
    expect(segunda.patients[0]!.updatedAt).toBe(primera.patients[0]!.updatedAt);
  });
});
