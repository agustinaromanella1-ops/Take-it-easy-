import { describe, expect, it } from 'vitest';
import { nombreDePila, textoPlantilla } from './contact';

describe('nombreDePila', () => {
  it('usa el primer nombre, que es como se le habla a alguien', () => {
    expect(nombreDePila('Ana Laura Gómez Sosa')).toBe('Ana');
    expect(nombreDePila('  Luis  ')).toBe('Luis');
  });
  it('no se rompe con un nombre vacío', () => {
    expect(nombreDePila('')).toBe('');
  });
});

describe('textoPlantilla', () => {
  const datos = { nombre: 'Ana Gómez', cuando: 'martes 17', hora: '10:00' };

  it('devuelve el día a minúscula, porque va en medio de la frase', () => {
    // En pantalla el día se muestra capitalizado porque encabeza una línea;
    // dentro de una oración en español va en minúscula.
    const t = textoPlantilla('recordatorio', { nombre: 'Ana', cuando: 'Jueves 17 de septiembre' });
    expect(t).toContain('el jueves 17 de septiembre');
    expect(t).not.toContain('el Jueves');
  });

  it('el recordatorio nombra el día y la hora', () => {
    const t = textoPlantilla('recordatorio', datos);
    expect(t).toContain('Ana');
    expect(t).toContain('martes 17');
    expect(t).toContain('10:00');
  });

  it('sin hora, no deja colgando "a las"', () => {
    const t = textoPlantilla('recordatorio', { nombre: 'Ana', cuando: 'martes 17' });
    expect(t).toContain('el martes 17');
    expect(t).not.toContain('a las ');
  });

  it('sin fecha ni hora, el mensaje sigue teniendo sentido', () => {
    const t = textoPlantilla('confirmar', { nombre: 'Ana' });
    expect(t).not.toContain('undefined');
    expect(t).not.toContain('  ');
  });

  it('el de cobro incluye el monto cuando lo hay', () => {
    expect(textoPlantilla('cobro', { nombre: 'Ana', monto: '$ 35.000' })).toContain('$ 35.000');
    expect(textoPlantilla('cobro', { nombre: 'Ana' })).not.toContain('undefined');
  });

  it('ninguna plantilla queda vacía', () => {
    for (const id of ['recordatorio', 'confirmar', 'reprogramar', 'cobro', 'saludo'] as const) {
      expect(textoPlantilla(id, { nombre: 'Ana' }).length).toBeGreaterThan(10);
    }
  });
});
