import {
  describeRule,
  formatRule,
  nextOccurrence,
  parseRule,
} from '../domain/recurrence';

const BA = 'America/Argentina/Buenos_Aires';
/** Lunes 14/09/2026, 10:00 en Buenos Aires. */
const NOW = new Date('2026-09-14T13:00:00.000Z');

describe('parseRule / formatRule', () => {
  it('hacen ida y vuelta', () => {
    expect(parseRule(formatRule('WEEKLY'))).toBe('WEEKLY');
  });

  it('devuelven null para lo que no reconocen', () => {
    expect(parseRule(null)).toBeNull();
    expect(parseRule('FREQ=CADA_TANTO')).toBeNull();
    expect(parseRule('cualquier cosa')).toBeNull();
  });
});

describe('nextOccurrence', () => {
  it('avanza una semana', () => {
    expect(nextOccurrence('2026-09-14T09:00', 'FREQ=WEEKLY', BA, NOW)).toBe(
      '2026-09-21T09:00',
    );
  });

  it('avanza un día', () => {
    expect(nextOccurrence('2026-09-14T09:00', 'FREQ=DAILY', BA, NOW)).toBe(
      '2026-09-15T09:00',
    );
  });

  it('avanza un año manteniendo el día', () => {
    expect(nextOccurrence('2026-09-14T09:00', 'FREQ=YEARLY', BA, NOW)).toBe(
      '2027-09-14T09:00',
    );
  });

  it('no arrastra repeticiones vencidas si el teléfono estuvo apagado', () => {
    // Última salida hace más de un mes, con repetición semanal: la próxima
    // tiene que ser futura, no las cuatro que se perdieron.
    const next = nextOccurrence('2026-08-03T09:00', 'FREQ=WEEKLY', BA, NOW);
    expect(next).toBe('2026-09-21T09:00');
  });

  it('recorta al último día del mes cuando no existe el 31', () => {
    expect(
      nextOccurrence('2027-01-31T09:00', 'FREQ=MONTHLY', BA, NOW),
    ).toBe('2027-02-28T09:00');
  });

  it('devuelve null si el mensaje no es recurrente', () => {
    expect(nextOccurrence('2026-09-14T09:00', null, BA, NOW)).toBeNull();
  });
});

describe('describeRule', () => {
  it('describe en castellano', () => {
    expect(describeRule('FREQ=WEEKLY', '2026-09-14T09:00')).toBe(
      'Todos los lunes a las 09:00',
    );
    expect(describeRule('FREQ=DAILY', '2026-09-14T21:30')).toBe(
      'Todos los días a las 21:30',
    );
    expect(describeRule('FREQ=MONTHLY', '2026-09-14T09:00')).toBe(
      'El 14 de cada mes a las 09:00',
    );
    expect(describeRule('FREQ=YEARLY', '2026-09-14T09:00')).toBe(
      'Cada 14 de septiembre a las 09:00',
    );
  });

  it('no describe nada si no hay regla', () => {
    expect(describeRule(null, '2026-09-14T09:00')).toBeNull();
  });
});
