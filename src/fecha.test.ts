import { afterEach, describe, expect, it, vi } from 'vitest';

import { enPalabras, hoy } from './fecha';

afterEach(() => {
  vi.useRealTimers();
});

/** 23:40 en Argentina, cuando en UTC ya es el día siguiente. */
function relojArgentinoDeMedianoche() {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-10T02:40:00Z'));
}

describe('hoy', () => {
  it('a las 23:40 de Argentina sigue siendo el día de acá, no el de UTC', () => {
    relojArgentinoDeMedianoche();

    expect(hoy()).toBe('2026-09-09');
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-09-10');
  });
});

describe('enPalabras', () => {
  it('no corre la fecha un día hacia atrás', () => {
    expect(enPalabras('2026-09-09')).toBe('miércoles 9 de septiembre');
  });

  it('funciona con el primero de mes, que es donde se nota el corrimiento', () => {
    expect(enPalabras('2026-09-01')).toBe('martes 1 de septiembre');
  });
});
