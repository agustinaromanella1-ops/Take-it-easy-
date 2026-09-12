import { beforeEach, describe, expect, it } from 'vitest';
import { loadData, saveData, STORAGE_KEY } from './storage';

const KEY_V1 = 'psicofinance:data';
const KEY_V2 = 'encuadre:data';

/** localStorage mínimo en memoria: los tests corren en Node, sin navegador. */
function installFakeStorage() {
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  };
  (globalThis as unknown as { localStorage: typeof fake }).localStorage = fake;
  return store;
}

const datosViejos = JSON.stringify({
  version: 1,
  patients: [{ id: 'p1', name: 'Paciente de antes', defaultFee: 3500000 }],
  sessions: [{ id: 's1', patientId: 'p1', date: '2026-03-10', time: '10:00', status: 'realizada', fee: 3500000 }],
  payments: [{ id: 'y1', patientId: 'p1', date: '2026-03-10', amount: 3500000 }],
  settings: { currency: 'US$' },
});

describe('cambio de nombre de la app', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = installFakeStorage();
  });

  it('rescata los datos guardados bajo el nombre viejo', () => {
    store.set(KEY_V1, datosViejos);
    const data = loadData();
    expect(data.patients).toHaveLength(1);
    expect(data.patients[0]!.name).toBe('Paciente de antes');
    expect(data.sessions).toHaveLength(1);
    expect(data.payments).toHaveLength(1);
    expect(data.settings.currency).toBe('US$');
  });

  it('el primer guardado los pasa a la clave nueva', () => {
    store.set(KEY_V1, datosViejos);
    saveData(loadData());
    expect(store.has(STORAGE_KEY)).toBe(true);
    expect(JSON.parse(store.get(STORAGE_KEY)!).patients).toHaveLength(1);
  });

  it('no borra la clave vieja: queda como respaldo', () => {
    store.set(KEY_V1, datosViejos);
    saveData(loadData());
    expect(store.get(KEY_V1)).toBe(datosViejos);
  });

  it('rescata los datos del segundo nombre que tuvo la app', () => {
    store.set(KEY_V2, datosViejos);
    expect(loadData().patients[0]!.name).toBe('Paciente de antes');
  });

  it('entre dos nombres viejos gana el más reciente', () => {
    // Quien pasó por las dos versiones tiene datos en ambas claves; los buenos
    // son los de la última que usó, no los del nombre original.
    store.set(KEY_V1, datosViejos);
    store.set(KEY_V2, JSON.stringify({ version: 1, patients: [{ id: 'p2', name: 'De la versión intermedia' }] }));
    expect(loadData().patients[0]!.name).toBe('De la versión intermedia');
  });

  it('la clave nueva tiene prioridad sobre las viejas', () => {
    store.set(KEY_V1, datosViejos);
    store.set(STORAGE_KEY, JSON.stringify({ version: 1, patients: [{ id: 'p2', name: 'Más reciente' }] }));
    expect(loadData().patients[0]!.name).toBe('Más reciente');
  });

  it('sin datos de ningún tipo arranca vacía', () => {
    expect(loadData().patients).toHaveLength(0);
  });

  it('datos viejos corruptos no rompen el arranque', () => {
    store.set(KEY_V1, '{roto');
    expect(loadData().patients).toHaveLength(0);
  });
});
