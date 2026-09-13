import { quickOptions, shiftWall, snoozeOneHour } from '../domain/schedule';

const BA = 'America/Argentina/Buenos_Aires';

/** Lunes 14/09/2026, 10:32 en Buenos Aires. */
const MONDAY_MORNING = new Date('2026-09-14T13:32:00.000Z');
/** Lunes 14/09/2026, 20:10 en Buenos Aires. */
const MONDAY_NIGHT = new Date('2026-09-14T23:10:00.000Z');

const byId = (now: Date) =>
  Object.fromEntries(quickOptions(BA, now).map((o) => [o.id, o.wall]));

describe('quickOptions', () => {
  it('redondea "en 2 horas" a los 5 minutos', () => {
    expect(byId(MONDAY_MORNING)['in-2h']).toBe('2026-09-14T12:35');
  });

  it('ofrece "esta tarde" solo si todavía no son las 18', () => {
    expect(byId(MONDAY_MORNING)['this-afternoon']).toBe('2026-09-14T18:00');
    expect(byId(MONDAY_NIGHT)['this-afternoon']).toBeUndefined();
  });

  it('propone mañana a las 9', () => {
    expect(byId(MONDAY_MORNING)['tomorrow-9']).toBe('2026-09-15T09:00');
  });

  it('si es lunes pasadas las 9, "lunes" es el lunes que viene', () => {
    expect(byId(MONDAY_MORNING)['monday-9']).toBe('2026-09-21T09:00');
  });

  it('si es lunes antes de las 9, "lunes" es hoy', () => {
    const mondayEarly = new Date('2026-09-14T10:00:00.000Z'); // 07:00 en BA
    expect(byId(mondayEarly)['monday-9']).toBe('2026-09-14T09:00');
  });

  it('nunca propone un momento que ya pasó', () => {
    for (const now of [MONDAY_MORNING, MONDAY_NIGHT]) {
      for (const option of quickOptions(BA, now)) {
        expect(new Date(option.wall).getTime()).toBeGreaterThan(
          new Date(now.getTime() - 3 * 60 * 60 * 1000).getTime(),
        );
      }
    }
  });
});

describe('shiftWall', () => {
  it('suma una hora', () => {
    expect(shiftWall('2026-09-14T09:00', 'plus-1h')).toBe('2026-09-14T10:00');
  });

  it('suma un día', () => {
    expect(shiftWall('2026-09-14T09:00', 'plus-1d')).toBe('2026-09-15T09:00');
  });

  it('salta al lunes siguiente a las 9', () => {
    expect(shiftWall('2026-09-16T14:20', 'next-monday')).toBe(
      '2026-09-21T09:00',
    );
  });
});

describe('snoozeOneHour', () => {
  it('pospone una hora desde ahora, no desde la hora vieja', () => {
    expect(snoozeOneHour(BA, MONDAY_MORNING)).toBe('2026-09-14T11:35');
  });
});
