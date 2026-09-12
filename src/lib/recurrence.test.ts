import { describe, expect, it } from 'vitest';
import { MAX_OCCURRENCES, occurrences } from './recurrence';

describe('occurrences', () => {
  it('sin repetición devuelve solo la fecha original', () => {
    expect(occurrences('2026-03-10', 'ninguna', 5)).toEqual(['2026-03-10']);
  });

  it('siempre incluye la fecha de inicio', () => {
    expect(occurrences('2026-03-10', 'semanal', 3)[0]).toBe('2026-03-10');
    expect(occurrences('2026-03-10', 'mensual', 3)[0]).toBe('2026-03-10');
  });

  it('repite cada 7 días', () => {
    expect(occurrences('2026-03-10', 'semanal', 4)).toEqual([
      '2026-03-10', '2026-03-17', '2026-03-24', '2026-03-31',
    ]);
  });

  it('repite cada 15 días', () => {
    expect(occurrences('2026-03-10', 'quincenal', 3)).toEqual(['2026-03-10', '2026-03-24', '2026-04-07']);
  });

  it('cruza el fin de año sin romperse', () => {
    expect(occurrences('2026-12-28', 'semanal', 3)).toEqual(['2026-12-28', '2027-01-04', '2027-01-11']);
  });

  it('repite el mismo día de cada mes', () => {
    expect(occurrences('2026-03-10', 'mensual', 4)).toEqual([
      '2026-03-10', '2026-04-10', '2026-05-10', '2026-06-10',
    ]);
  });

  it('acota al último día del mes cuando el día no existe', () => {
    // No hay 31 de abril ni de junio.
    expect(occurrences('2026-03-31', 'mensual', 4)).toEqual([
      '2026-03-31', '2026-04-30', '2026-05-31', '2026-06-30',
    ]);
  });

  it('no arrastra el recorte: vuelve al día original al mes siguiente', () => {
    // Enero 31 -> febrero 28 (recortado) -> marzo 31, NO marzo 28.
    expect(occurrences('2026-01-31', 'mensual', 3)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31']);
  });

  it('respeta el 29 de febrero en año bisiesto', () => {
    expect(occurrences('2027-12-29', 'mensual', 3)).toEqual(['2027-12-29', '2028-01-29', '2028-02-29']);
  });

  it('corta en el tope para que un tipeo no llene la agenda', () => {
    expect(occurrences('2026-03-10', 'semanal', 500)).toHaveLength(MAX_OCCURRENCES);
  });

  it('nunca devuelve una lista vacía', () => {
    expect(occurrences('2026-03-10', 'semanal', 0)).toHaveLength(1);
    expect(occurrences('2026-03-10', 'semanal', -3)).toHaveLength(1);
  });

  it('no genera fechas repetidas', () => {
    for (const r of ['semanal', 'quincenal', 'mensual'] as const) {
      const dates = occurrences('2026-01-15', r, 12);
      expect(new Set(dates).size).toBe(dates.length);
    }
  });
});
