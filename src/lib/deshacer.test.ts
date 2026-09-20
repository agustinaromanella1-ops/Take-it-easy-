import { describe, expect, it } from 'vitest';
import { volverA } from './deshacer';
import { fusionar } from './fusion';
import type { AppData, Patient } from '../types';

const AJUSTES = {
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
  id, updatedAt, name, email: '', phone: '', defaultFee: 3500000, status: 'activo',
  colorIndex: 0, frequency: 'semanal', kind: 'particular', legalName: '', document: '',
  taxId: '', taxCondition: 'consumidor_final', memberNumber: '', insurer: '', lastRaise: null,
  notes: '', createdAt: '2026-01-01',
});

const datos = (p: Partial<AppData>): AppData => ({
  version: 2, patients: [], sessions: [], payments: [],
  deleted: { patients: [], sessions: [], payments: [] }, settings: AJUSTES, ...p,
});

const T1 = '2026-09-20T10:00:00.000Z';
const T2 = '2026-09-20T11:00:00.000Z';
const AHORA = '2026-09-20T12:00:00.000Z';

describe('volverA', () => {
  it('lo que vuelve, vuelve con sello fresco', () => {
    const antes = datos({ patients: [pac('p1', 'Ana', T1)] });
    const ahora = datos({ patients: [pac('p1', 'Ana Gómez', T2)] });
    const r = volverA(ahora, antes, AHORA);
    expect(r.patients[0]?.name).toBe('Ana');
    expect(r.patients[0]?.updatedAt).toBe(AHORA);
  });

  it('lo que nadie tocó no se vuelve a sellar', () => {
    // Sellar de nuevo algo que quedó igual lo haría parecer recién editado.
    const antes = datos({ patients: [pac('p1', 'Ana', T1), pac('p2', 'Luis', T1)] });
    const ahora = datos({ patients: [pac('p1', 'Ana Gómez', T2), pac('p2', 'Luis', T1)] });
    const r = volverA(ahora, antes, AHORA);
    expect(r.patients.find((p) => p.id === 'p2')?.updatedAt).toBe(T1);
  });

  it('deshacer un alta deja lápida, no borra a secas', () => {
    const antes = datos({});
    const ahora = datos({ patients: [pac('p1', 'Ana', T2)] });
    const r = volverA(ahora, antes, AHORA);
    expect(r.patients).toEqual([]);
    expect(r.deleted.patients).toEqual([{ id: 'p1', deletedAt: AHORA }]);
  });

  it('deshacer un borrado saca la lápida y devuelve el registro', () => {
    const antes = datos({ patients: [pac('p1', 'Ana', T1)] });
    const ahora = datos({
      deleted: { patients: [{ id: 'p1', deletedAt: T2 }], sessions: [], payments: [] },
    });
    const r = volverA(ahora, antes, AHORA);
    expect(r.patients.map((p) => p.id)).toEqual(['p1']);
    expect(r.deleted.patients).toEqual([]);
  });
});

describe('volverA + fusionar, que es donde importa', () => {
  it('el deshacer le gana a lo que ya estaba guardado', () => {
    // Sin resellar, la copia guardada —que tiene el cambio, con sello más
    // nuevo— ganaría la fusión y el deshacer no haría nada.
    const antes = datos({ patients: [pac('p1', 'Ana', T1)] });
    const guardado = datos({ patients: [pac('p1', 'Ana Gómez', T2)] });
    const deshecho = volverA(guardado, antes, AHORA);
    expect(fusionar(deshecho, guardado).patients[0]?.name).toBe('Ana');
  });

  it('deshacer un alta no la revive al fusionar con la copia guardada', () => {
    const antes = datos({});
    const guardado = datos({ patients: [pac('p1', 'Ana', T2)] });
    const deshecho = volverA(guardado, antes, AHORA);
    expect(fusionar(deshecho, guardado).patients).toEqual([]);
  });

  it('deshacer un borrado tampoco lo vuelve a matar al fusionar', () => {
    const antes = datos({ patients: [pac('p1', 'Ana', T1)] });
    const guardado = datos({
      deleted: { patients: [{ id: 'p1', deletedAt: T2 }], sessions: [], payments: [] },
    });
    const deshecho = volverA(guardado, antes, AHORA);
    expect(fusionar(deshecho, guardado).patients.map((p) => p.id)).toEqual(['p1']);
  });

  it('y no se lleva puesto lo que hizo la otra pestaña mientras tanto', () => {
    const antes = datos({ patients: [pac('p1', 'Ana', T1)] });
    const guardado = datos({ patients: [pac('p1', 'Ana Gómez', T2)] });
    // La otra pestaña cargó a Luis después de que tomáramos la copia.
    const conLuis = datos({ patients: [pac('p1', 'Ana Gómez', T2), pac('p2', 'Luis', T2)] });
    const deshecho = volverA(guardado, antes, AHORA);
    const r = fusionar(deshecho, conLuis);
    expect(r.patients.find((p) => p.id === 'p1')?.name).toBe('Ana');
    expect(r.patients.map((p) => p.id).sort()).toEqual(['p1', 'p2']);
  });
});
