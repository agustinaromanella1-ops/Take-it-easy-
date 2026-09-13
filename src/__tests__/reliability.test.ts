import {
  assessReliability,
  delayMinutes,
  describeReliability,
  isOnTime,
  MAX_SAMPLES,
  recordSample,
  type DeliverySample,
} from '../domain/reliability';

const sample = (expectedIso: string, delayMin: number): DeliverySample => ({
  expectedAt: expectedIso,
  deliveredAt: new Date(
    new Date(expectedIso).getTime() + delayMin * 60000,
  ).toISOString(),
});

const base = '2026-09-14T12:00:00.000Z';

describe('delayMinutes', () => {
  it('mide el retraso en minutos', () => {
    expect(delayMinutes(sample(base, 7))).toBe(7);
  });

  it('nunca es negativo: un aviso no llega antes de tiempo', () => {
    expect(delayMinutes(sample(base, -5))).toBe(0);
  });

  it('devuelve 0 ante fechas inválidas en vez de romper', () => {
    expect(delayMinutes({ expectedAt: 'x', deliveredAt: base })).toBe(0);
  });
});

describe('recordSample', () => {
  it('agrega al final', () => {
    const result = recordSample([sample(base, 1)], sample(base, 2));
    expect(result).toHaveLength(2);
    expect(delayMinutes(result[1]!)).toBe(2);
  });

  it('descarta las más viejas al llegar al tope', () => {
    let samples: DeliverySample[] = [];
    for (let i = 0; i < MAX_SAMPLES + 5; i += 1) {
      samples = recordSample(samples, sample(base, i));
    }
    expect(samples).toHaveLength(MAX_SAMPLES);
    expect(delayMinutes(samples[0]!)).toBe(5);
  });
});

describe('assessReliability', () => {
  it('no opina con pocas muestras', () => {
    expect(assessReliability([sample(base, 40)])).toEqual({ level: 'unknown' });
  });

  it('da por buenos los retrasos chicos', () => {
    const result = assessReliability([
      sample(base, 0),
      sample(base, 1),
      sample(base, 2),
    ]);
    expect(result.level).toBe('ok');
  });

  it('avisa cuando el retraso se repite', () => {
    const result = assessReliability([
      sample(base, 0),
      sample(base, 12),
      sample(base, 1),
      sample(base, 18),
    ]);
    expect(result).toEqual({
      level: 'degraded',
      worstDelayMinutes: 18,
      lateCount: 2,
    });
  });

  it('no alarma por un único retraso moderado', () => {
    const result = assessReliability([
      sample(base, 0),
      sample(base, 12),
      sample(base, 1),
    ]);
    expect(result.level).toBe('ok');
  });

  it('avisa con un solo retraso grave reciente', () => {
    const result = assessReliability([
      sample(base, 0),
      sample(base, 1),
      sample(base, 45),
    ]);
    expect(result.level).toBe('degraded');
  });
});

describe('isOnTime y describeReliability', () => {
  it('tolera el ruido normal del sistema', () => {
    expect(isOnTime(sample(base, 2))).toBe(true);
    expect(isOnTime(sample(base, 3))).toBe(false);
  });

  it('describe cada estado', () => {
    expect(describeReliability({ level: 'unknown' })).toMatch(/todavía/i);
    expect(describeReliability({ level: 'ok', samples: 5 })).toMatch(/a horario/);
    expect(
      describeReliability({
        level: 'degraded',
        worstDelayMinutes: 22,
        lateCount: 3,
      }),
    ).toMatch(/22 minutos/);
  });
});
