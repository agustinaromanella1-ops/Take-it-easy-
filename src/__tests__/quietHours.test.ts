import {
  DEFAULT_QUIET_HOURS,
  describeQuietHours,
  isWithinAllowed,
  nextAllowed,
} from '../domain/quietHours';

const ON = { enabled: true, startHour: 9, endHour: 21 };

describe('isWithinAllowed', () => {
  it('acepta todo si está apagado', () => {
    expect(isWithinAllowed('2026-09-14T03:00', DEFAULT_QUIET_HOURS)).toBe(true);
  });

  it('acepta dentro de la franja, incluido el borde de inicio', () => {
    expect(isWithinAllowed('2026-09-14T09:00', ON)).toBe(true);
    expect(isWithinAllowed('2026-09-14T20:59', ON)).toBe(true);
  });

  it('rechaza fuera de la franja, incluido el borde de fin', () => {
    expect(isWithinAllowed('2026-09-14T08:59', ON)).toBe(false);
    expect(isWithinAllowed('2026-09-14T21:00', ON)).toBe(false);
    expect(isWithinAllowed('2026-09-14T02:30', ON)).toBe(false);
  });
});

describe('nextAllowed', () => {
  it('deja igual lo que ya es válido', () => {
    expect(nextAllowed('2026-09-14T15:00', ON)).toBe('2026-09-14T15:00');
  });

  it('si es muy temprano, propone ese mismo día a la hora de inicio', () => {
    expect(nextAllowed('2026-09-14T06:30', ON)).toBe('2026-09-14T09:00');
  });

  it('si es de noche, propone el día siguiente', () => {
    expect(nextAllowed('2026-09-14T23:40', ON)).toBe('2026-09-15T09:00');
  });

  it('cruza bien el fin de mes', () => {
    expect(nextAllowed('2026-09-30T22:00', ON)).toBe('2026-10-01T09:00');
  });
});

describe('describeQuietHours', () => {
  it('describe el estado', () => {
    expect(describeQuietHours(DEFAULT_QUIET_HOURS)).toBe(
      'Sin restricción de horario',
    );
    expect(describeQuietHours(ON)).toBe('Solo entre 09:00 y 21:00');
  });
});
