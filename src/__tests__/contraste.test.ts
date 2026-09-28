import { palettes, type Palette } from '../theme';

/**
 * El contraste no es una preferencia estética: si un texto no se distingue de
 * su fondo, la pantalla deja de servir a pleno sol o con la vista cansada.
 *
 * Este test mide cada par de texto sobre fondo contra WCAG 2.1 y falla si
 * alguno baja del mínimo. Así, aclarar la paleta no puede romper la
 * legibilidad sin que nos enteremos.
 */

/** Canal sRGB a luminancia relativa. Fórmula de WCAG 2.1. */
function canal(valor: number): number {
  const v = valor / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminancia(hex: string): number {
  const limpio = hex.replace('#', '');
  const r = parseInt(limpio.slice(0, 2), 16);
  const g = parseInt(limpio.slice(2, 4), 16);
  const b = parseInt(limpio.slice(4, 6), 16);
  return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
}

export function contraste(frente: string, fondo: string): number {
  const a = luminancia(frente);
  const b = luminancia(fondo);
  const claro = Math.max(a, b);
  const oscuro = Math.min(a, b);
  return (claro + 0.05) / (oscuro + 0.05);
}

/** Texto normal. */
const AA = 4.5;
/** Texto grande y elementos de interfaz (bordes, iconos). */
const AA_GRANDE = 3;

const pares = (p: Palette): { nombre: string; frente: string; fondo: string; minimo: number }[] => [
  // El texto se lee sobre las tarjetas y también sobre el degradado, así que
  // hay que medirlo contra las tres paradas.
  { nombre: 'texto sobre tarjeta', frente: p.text, fondo: p.surface, minimo: AA },
  { nombre: 'texto sobre tarjeta alterna', frente: p.text, fondo: p.surfaceAlt, minimo: AA },
  { nombre: 'texto sobre degradado (arriba)', frente: p.text, fondo: p.gradient[0], minimo: AA },
  { nombre: 'texto sobre degradado (medio)', frente: p.text, fondo: p.gradient[1], minimo: AA },
  { nombre: 'texto sobre degradado (abajo)', frente: p.text, fondo: p.gradient[2], minimo: AA },

  { nombre: 'texto apagado sobre tarjeta', frente: p.textMuted, fondo: p.surface, minimo: AA },
  { nombre: 'texto apagado sobre degradado (arriba)', frente: p.textMuted, fondo: p.gradient[0], minimo: AA },
  { nombre: 'texto apagado sobre degradado (abajo)', frente: p.textMuted, fondo: p.gradient[2], minimo: AA },

  { nombre: 'acento sobre tarjeta', frente: p.accent, fondo: p.surface, minimo: AA },
  { nombre: 'acento sobre su relleno', frente: p.accentInk, fondo: p.accentSoft, minimo: AA },

  // Lo que va ENCIMA del naranja del botón principal.
  { nombre: 'texto sobre el botón principal', frente: p.primaryText, fondo: p.primary, minimo: AA },

  { nombre: 'aviso sobre su relleno', frente: p.warning, fondo: p.warningSoft, minimo: AA },
  { nombre: 'texto sobre relleno de aviso', frente: p.text, fondo: p.warningSoft, minimo: AA },
  { nombre: 'peligro sobre tarjeta', frente: p.danger, fondo: p.surface, minimo: AA },
  { nombre: 'peligro sobre su relleno', frente: p.danger, fondo: p.dangerSoft, minimo: AA },

  { nombre: 'texto de la burbuja', frente: p.bubbleText, fondo: p.bubble, minimo: AA },

  // El contorno es parte del dibujo: tiene que verse sobre todos los fondos.
  { nombre: 'contorno sobre tarjeta', frente: p.border, fondo: p.surface, minimo: AA_GRANDE },
  { nombre: 'contorno sobre degradado (medio)', frente: p.border, fondo: p.gradient[1], minimo: AA_GRANDE },
];

describe.each([
  ['claro', palettes.light],
  ['oscuro', palettes.dark],
])('paleta %s', (_nombre, paleta) => {
  it.each(pares(paleta))('$nombre cumple WCAG AA', ({ frente, fondo, minimo }) => {
    expect(contraste(frente, fondo)).toBeGreaterThanOrEqual(minimo);
  });
});

describe('la función de contraste', () => {
  it('da 21 entre negro y blanco', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 1);
  });

  it('da 1 entre un color y sí mismo', () => {
    expect(contraste('#3a7d6b', '#3a7d6b')).toBeCloseTo(1, 5);
  });

  it('es simétrica', () => {
    expect(contraste('#123f3c', '#ffffff')).toBeCloseTo(
      contraste('#ffffff', '#123f3c'),
      5,
    );
  });
});
