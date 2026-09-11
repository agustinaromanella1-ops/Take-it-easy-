import { afterEach, describe, expect, it, vi } from 'vitest';

import { diaSemanaDe, enMinutos, enPalabras, hoy, horaActualEnMinutos } from './fecha';

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

describe('día de la semana', () => {
  it('el lunes es 1 y el domingo es 7', () => {
    // getDay() cuenta el domingo como 0: acá tiene que ser 7.
    expect(diaSemanaDe('2026-09-07')).toBe(1);
    expect(diaSemanaDe('2026-09-13')).toBe(7);
  });

  it('recorre la semana sin saltarse ninguno', () => {
    const dias = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10',
                  '2026-09-11', '2026-09-12', '2026-09-13'];
    expect(dias.map(diaSemanaDe)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('no se corre de día cerca de la medianoche', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-14T02:40:00Z')); // 23:40 del domingo 13
    expect(diaSemanaDe(hoy())).toBe(7);
  });
});

describe('horas', () => {
  it('convierte a minutos desde la medianoche', () => {
    expect(enMinutos('09:20')).toBe(560);
    expect(enMinutos('00:00')).toBe(0);
    expect(enMinutos('23:59')).toBe(1439);
  });

  it('la hora actual sale del reloj local', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-10T12:30:00Z')); // 9:30 en Argentina
    expect(horaActualEnMinutos()).toBe(570);
  });
});
