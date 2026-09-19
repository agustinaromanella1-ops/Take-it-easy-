import { beforeEach, describe, expect, it } from 'vitest';
import { guardarEnfoque, leerEnfoque } from './enfoque';

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

describe('enfoque', () => {
  beforeEach(() => localStorage.clear());

  it('arranca apagado', () => {
    expect(leerEnfoque()).toBe(false);
  });

  it('se recuerda entre aperturas', () => {
    guardarEnfoque(true);
    expect(leerEnfoque()).toBe(true);
  });

  it('apagarlo no deja rastro', () => {
    guardarEnfoque(true);
    guardarEnfoque(false);
    expect(leerEnfoque()).toBe(false);
    expect(localStorage.getItem('pipicucu:enfoque')).toBeNull();
  });

  it('no se mezcla con los datos', () => {
    guardarEnfoque(true);
    expect(localStorage.getItem('pipicucu:data')).toBeNull();
  });
});
