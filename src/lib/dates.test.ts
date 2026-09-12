import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  daysBetween,
  fromISODate,
  isValidISODate,
  isValidTime,
  minutesToTime,
  monthKey,
  overlaps,
  startOfWeek,
  timeToMinutes,
  toISODate,
} from './dates';

describe('conversión de fechas', () => {
  it('no corre el día por zona horaria', () => {
    // El bug clásico: new Date("2026-03-10") se interpreta como UTC.
    expect(toISODate(fromISODate('2026-03-10'))).toBe('2026-03-10');
    expect(fromISODate('2026-03-10').getDate()).toBe(10);
    expect(fromISODate('2026-01-01').getMonth()).toBe(0);
  });

  it('valida formatos', () => {
    expect(isValidISODate('2026-03-10')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false); // no existe
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('10/03/2026')).toBe(false);
    expect(isValidTime('09:30')).toBe(true);
    expect(isValidTime('24:00')).toBe(false);
    expect(isValidTime('9:30')).toBe(false);
  });
});

describe('aritmética de días', () => {
  it('suma cruzando fin de mes y de año', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('maneja años bisiestos', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('cuenta días entre fechas', () => {
    expect(daysBetween('2026-03-10', '2026-03-17')).toBe(7);
    expect(daysBetween('2026-03-17', '2026-03-10')).toBe(-7);
    expect(daysBetween('2026-03-10', '2026-03-10')).toBe(0);
  });
});

describe('semanas', () => {
  it('la semana arranca el lunes', () => {
    // 2026-03-11 es miércoles.
    expect(startOfWeek('2026-03-11')).toBe('2026-03-09');
    expect(startOfWeek('2026-03-09')).toBe('2026-03-09'); // lunes
  });

  it('el domingo pertenece a la semana que arrancó el lunes anterior', () => {
    // 2026-03-15 es domingo: su semana empieza el lunes 9, no el 16.
    expect(startOfWeek('2026-03-15')).toBe('2026-03-09');
  });
});

describe('meses', () => {
  it('extrae y desplaza meses cruzando el año', () => {
    expect(monthKey('2026-03-10')).toBe('2026-03');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-03', 0)).toBe('2026-03');
  });
});

describe('horas', () => {
  it('convierte ida y vuelta', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(0)).toBe('00:00');
  });
});

describe('superposición de turnos', () => {
  it('detecta turnos que se pisan', () => {
    expect(overlaps(540, 50, 560, 50)).toBe(true); // 9:00-9:50 vs 9:20-10:10
  });

  it('turnos consecutivos NO se pisan', () => {
    expect(overlaps(540, 50, 590, 50)).toBe(false); // 9:00-9:50 y 9:50-10:40
  });

  it('un turno contenido dentro de otro se pisa', () => {
    expect(overlaps(540, 120, 560, 20)).toBe(true);
  });

  it('es simétrica', () => {
    expect(overlaps(560, 50, 540, 50)).toBe(overlaps(540, 50, 560, 50));
  });
});
