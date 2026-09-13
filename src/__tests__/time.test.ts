import { isPast, utcToWall, wallToUtc } from '../domain/time';

const BA = 'America/Argentina/Buenos_Aires';
const MADRID = 'Europe/Madrid';

describe('conversión entre hora de pared e instante', () => {
  it('convierte una hora local de Buenos Aires a UTC', () => {
    // Buenos Aires está en UTC-3 todo el año.
    expect(wallToUtc('2026-09-14T09:00', BA).toISOString()).toBe(
      '2026-09-14T12:00:00.000Z',
    );
  });

  it('hace ida y vuelta sin perder la hora elegida', () => {
    const wall = '2026-12-24T21:30';
    expect(utcToWall(wallToUtc(wall, BA), BA)).toBe(wall);
  });

  it('respeta el horario de verano donde existe', () => {
    // Madrid: UTC+2 en verano, UTC+1 en invierno. La misma hora de pared
    // corresponde a instantes con distinto offset.
    const verano = wallToUtc('2026-07-01T09:00', MADRID).toISOString();
    const invierno = wallToUtc('2026-01-15T09:00', MADRID).toISOString();
    expect(verano).toBe('2026-07-01T07:00:00.000Z');
    expect(invierno).toBe('2026-01-15T08:00:00.000Z');
  });
});

describe('isPast', () => {
  const now = new Date('2026-09-14T12:00:00.000Z'); // 09:00 en Buenos Aires

  it('detecta un momento que ya pasó', () => {
    expect(isPast('2026-09-14T08:59', BA, now)).toBe(true);
  });

  it('detecta un momento futuro', () => {
    expect(isPast('2026-09-14T09:01', BA, now)).toBe(false);
  });
});
