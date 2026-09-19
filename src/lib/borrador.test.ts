import { beforeEach, describe, expect, it } from 'vitest';
import { guardarBorrador, leerBorrador, limpiarBorrador, tieneContenido } from './borrador';

// Las pruebas corren en Node, que no tiene localStorage. Con este doble
// alcanza: el módulo solo usa getItem, setItem, removeItem y clear.
const memoria = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => memoria.get(k) ?? null,
  setItem: (k: string, v: string) => void memoria.set(k, v),
  removeItem: (k: string) => void memoria.delete(k),
  clear: () => memoria.clear(),
  key: (i: number) => [...memoria.keys()][i] ?? null,
  get length() {
    return memoria.size;
  },
} as Storage;

describe('borrador', () => {
  beforeEach(() => localStorage.clear());

  it('devuelve null cuando no hay nada', () => {
    expect(leerBorrador('paciente')).toBeNull();
  });

  it('guarda y recupera lo escrito', () => {
    guardarBorrador('paciente', { name: 'Ana', fee: '35000' });
    expect(leerBorrador('paciente')).toEqual({ name: 'Ana', fee: '35000' });
  });

  it('se borra cuando el formulario se guardó de verdad', () => {
    guardarBorrador('paciente', { name: 'Ana' });
    limpiarBorrador('paciente');
    expect(leerBorrador('paciente')).toBeNull();
  });

  it('no se cae con un borrador corrupto', () => {
    localStorage.setItem('pipicucu:borrador:paciente', '{roto');
    expect(leerBorrador('paciente')).toBeNull();
  });

  it('no confunde un texto suelto con un formulario', () => {
    localStorage.setItem('pipicucu:borrador:paciente', '"hola"');
    expect(leerBorrador('paciente')).toBeNull();
  });

  it('no vive en la misma clave que los datos', () => {
    guardarBorrador('paciente', { name: 'Ana' });
    expect(localStorage.getItem('pipicucu:data')).toBeNull();
  });
});

describe('tieneContenido', () => {
  const vacio = { name: '', fee: '', notes: '' };

  it('un formulario en blanco no cuenta como borrador', () => {
    expect(tieneContenido({ ...vacio }, vacio)).toBe(false);
  });

  it('los espacios tampoco', () => {
    expect(tieneContenido({ ...vacio, name: '   ' }, vacio)).toBe(false);
  });

  it('una letra ya alcanza para no perderlo', () => {
    expect(tieneContenido({ ...vacio, name: 'A' }, vacio)).toBe(true);
  });

  it('ignora lo que no se escribe a mano', () => {
    expect(tieneContenido({ ...vacio, colorIndex: 3 }, { ...vacio, colorIndex: 0 })).toBe(false);
  });
});
