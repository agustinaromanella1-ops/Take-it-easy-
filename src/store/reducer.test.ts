import { describe, expect, it } from 'vitest';
import { emptyData } from '../lib/storage';
import { reducer } from './reducer';
import type { AppData } from '../types';

function seeded(): AppData {
  let state = reducer(emptyData(), {
    type: 'patient/add',
    payload: { name: 'Ana', email: '', phone: '', defaultFee: 500000, status: 'activo', colorIndex: 0, frequency: 'semanal', notes: '' },
  });
  const id = state.patients[0]!.id;
  state = reducer(state, {
    type: 'session/add',
    payload: {
      patientId: id,
      date: '2026-03-10',
      time: '10:00',
      durationMin: 50,
      status: 'realizada',
      fee: 500000,
      chargeable: true,
      notes: '',
    },
  });
  state = reducer(state, {
    type: 'payment/add',
    payload: { patientId: id, date: '2026-03-10', amount: 500000, method: 'efectivo', notes: '' },
  });
  return state;
}

describe('pacientes', () => {
  it('asigna un id y una fecha de alta', () => {
    const state = reducer(emptyData(), {
      type: 'patient/add',
      payload: { name: 'Ana', email: '', phone: '', defaultFee: 0, status: 'activo', colorIndex: 0, frequency: 'semanal', notes: '' },
    });
    expect(state.patients).toHaveLength(1);
    expect(state.patients[0]!.id).toBeTruthy();
    expect(state.patients[0]!.createdAt).toBeTruthy();
  });

  it('genera ids distintos para cada alta', () => {
    let state = emptyData();
    for (const name of ['Ana', 'Bruno', 'Carla']) {
      state = reducer(state, {
        type: 'patient/add',
        payload: { name, email: '', phone: '', defaultFee: 0, status: 'activo', colorIndex: 0, frequency: 'semanal', notes: '' },
      });
    }
    expect(new Set(state.patients.map((p) => p.id)).size).toBe(3);
  });

  it('al borrar arrastra sesiones y pagos, sin dejar huérfanos', () => {
    const state = seeded();
    const id = state.patients[0]!.id;
    const next = reducer(state, { type: 'patient/remove', payload: { id } });
    expect(next.patients).toHaveLength(0);
    expect(next.sessions).toHaveLength(0);
    expect(next.payments).toHaveLength(0);
  });

  it('borrar un paciente no toca los datos de otro', () => {
    let state = seeded();
    state = reducer(state, {
      type: 'patient/add',
      payload: { name: 'Bruno', email: '', phone: '', defaultFee: 0, status: 'activo', colorIndex: 0, frequency: 'semanal', notes: '' },
    });
    const bruno = state.patients[1]!.id;
    state = reducer(state, {
      type: 'session/add',
      payload: {
        patientId: bruno,
        date: '2026-03-11',
        time: '11:00',
        durationMin: 50,
        status: 'realizada',
        fee: 300000,
        chargeable: true,
        notes: '',
      },
    });
    const next = reducer(state, { type: 'patient/remove', payload: { id: state.patients[0]!.id } });
    expect(next.patients.map((p) => p.name)).toEqual(['Bruno']);
    expect(next.sessions).toHaveLength(1);
    expect(next.sessions[0]!.patientId).toBe(bruno);
  });
});

describe('sesiones', () => {
  it('cambia el estado sin tocar el resto de los campos', () => {
    const state = seeded();
    const s = state.sessions[0]!;
    const next = reducer(state, { type: 'session/setStatus', payload: { id: s.id, status: 'ausente' } });
    expect(next.sessions[0]!.status).toBe('ausente');
    expect(next.sessions[0]!.fee).toBe(s.fee);
    expect(next.sessions[0]!.date).toBe(s.date);
  });

  it('ignora acciones sobre ids inexistentes en vez de romper', () => {
    const state = seeded();
    const next = reducer(state, { type: 'session/setStatus', payload: { id: 'no-existe', status: 'ausente' } });
    expect(next.sessions).toEqual(state.sessions);
  });
});

describe('inmutabilidad', () => {
  it('no muta el estado anterior', () => {
    const state = seeded();
    const sessionsBefore = state.sessions;
    const countBefore = state.patients.length;
    reducer(state, {
      type: 'patient/add',
      payload: { name: 'Nuevo', email: '', phone: '', defaultFee: 0, status: 'activo', colorIndex: 0, frequency: 'semanal', notes: '' },
    });
    expect(state.patients).toHaveLength(countBefore);
    expect(state.sessions).toBe(sessionsBefore);
  });

  it('conserva la referencia de las colecciones que no cambian', () => {
    const state = seeded();
    const next = reducer(state, { type: 'settings/update', payload: { currency: 'US$' } });
    // Si cambian settings, pacientes y sesiones deben seguir siendo el mismo array:
    // así los useMemo que dependen de ellos no se recalculan al pedo.
    expect(next.patients).toBe(state.patients);
    expect(next.sessions).toBe(state.sessions);
    expect(next.settings.currency).toBe('US$');
  });
});

describe('settings', () => {
  it('hace merge parcial sin pisar el resto', () => {
    const state = reducer(emptyData(), { type: 'settings/update', payload: { currency: '€' } });
    expect(state.settings.currency).toBe('€');
    expect(state.settings.defaultDurationMin).toBe(emptyData().settings.defaultDurationMin);
  });
});
