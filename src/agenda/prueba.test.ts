import { describe, expect, it } from 'vitest';

import { aLaHora, textoDeLaPrueba } from './prueba';

describe('el aviso de prueba', () => {
  it('dice el mismo texto que un recordatorio sin materia', () => {
    expect(textoDeLaPrueba()).toEqual({
      titulo: 'Take It Easy',
      cuerpo: 'Tenés una nota para hoy.',
    });
  });

  it('no promete una hora en el cuerpo, como el resto', () => {
    expect(textoDeLaPrueba().cuerpo).not.toMatch(/minuto|en \d/i);
  });

  it('la hora se lee del reloj del teléfono, no de UTC', () => {
    // 00:20 del 13 en Argentina, cuando en UTC ya es el 13 a las 03:20.
    expect(aLaHora(new Date('2026-09-13T03:20:00Z'))).toBe('00:20');
  });

  it('con un solo dígito completa con cero', () => {
    expect(aLaHora(new Date(2026, 8, 13, 7, 5))).toBe('07:05');
  });
});
