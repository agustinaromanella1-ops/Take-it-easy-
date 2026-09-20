import { describe, expect, it } from 'vitest';
import { plural } from './plural';

describe('plural', () => {
  it('usa el singular para uno', () => {
    expect(plural(1, 'sesión', 'sesiones')).toBe('1 sesión');
  });

  it('y el plural para el resto', () => {
    expect(plural(0, 'sesión', 'sesiones')).toBe('0 sesiones');
    expect(plural(2, 'sesión', 'sesiones')).toBe('2 sesiones');
  });

  it('nunca escribe paréntesis', () => {
    expect(plural(2, 'pago', 'pagos')).not.toContain('(');
  });
});
