import { useColorScheme } from 'react-native';

/**
 * Sistema visual tomado de Pipí Cucú, para que las dos apps se lean como
 * hermanas. Las decisiones que lo definen:
 *
 * - **Atardecer.** El fondo es un degradado de celeste a lila a durazno.
 * - **El contorno es parte del dibujo**, no una línea de separación: por eso
 *   es tinta (2.5 px) y no un gris finito.
 * - **La sombra es dura y sin desenfoque.** Es lo que da el aire de
 *   calcomanía pegada sobre la página en vez de flotando encima.
 * - **Serif de display para títulos, sans redondeada para el cuerpo.**
 * - El oscuro no es el claro dado vuelta: es el mismo atardecer más tarde.
 *
 * Los pares de texto sobre fondo vienen medidos contra WCAG AA desde el
 * proyecto original; conservarlos tal cual es lo que mantiene esa garantía.
 */
export interface Palette {
  /** Las tres paradas del degradado de fondo, de arriba hacia abajo. */
  gradient: readonly [string, string, string];
  /** Color plano de respaldo, para superficies que no llevan degradado. */
  bg: string;
  surface: string;
  surfaceAlt: string;

  /** Tinta: texto, contornos y sombras salen todos de acá. */
  ink: string;
  text: string;
  textMuted: string;

  border: string;
  /** El color de la sombra dura, que en oscuro no es la tinta. */
  shadow: string;

  /** Lila: enlaces, selección, acentos suaves. */
  accent: string;
  accentSoft: string;
  accentInk: string;
  /** Naranja: la acción principal. */
  primary: string;
  /** Lo que va ENCIMA del naranja. Es tinta, no blanco: el blanco da 2,7:1. */
  primaryText: string;

  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;

  /** Menta, para la vista previa del mensaje. */
  bubble: string;
  bubbleText: string;
}

const light: Palette = {
  gradient: ['#d9ebfb', '#e9dff7', '#ffe3d2'],
  bg: '#e9dff7',
  surface: '#ffffff',
  surfaceAlt: '#f7f3fc',

  ink: '#1f1e47',
  text: '#1f1e47',
  textMuted: '#5f5880',

  border: '#1f1e47',
  shadow: '#1f1e47',

  accent: '#7b52ab',
  accentSoft: '#efe6fb',
  accentInk: '#5f3e87',
  primary: '#f77957',
  primaryText: '#1f1e47',

  warning: '#a63508',
  warningSoft: '#fbf1e2',
  danger: '#b33a4a',
  dangerSoft: '#fde6ea',

  bubble: '#e2f5ec',
  bubbleText: '#27674e',
};

const dark: Palette = {
  gradient: ['#1a1533', '#241b3d', '#33203c'],
  bg: '#241b3d',
  surface: '#2c2450',
  surfaceAlt: '#241d44',

  ink: '#f6f0fb',
  text: '#f6f0fb',
  textMuted: '#aba1c6',

  // Sobre oscuro una línea oscura no se ve: el contorno pasa a lila claro.
  border: '#9086c9',
  // La sombra dura necesita ser MÁS oscura que el fondo para leerse.
  shadow: '#0f0c1e',

  accent: '#c9b2ec',
  accentSoft: '#352b5c',
  accentInk: '#cdb6ee',
  primary: '#f77957',
  primaryText: '#1f1e47',

  warning: '#f0c48a',
  warningSoft: '#3d2a1c',
  danger: '#ff8a9b',
  dangerSoft: '#45222c',

  bubble: '#1f3f38',
  bubbleText: '#86d3ae',
};

export const spacing = (n: number): number => n * 8;

export const radius = { sm: 14, md: 22, lg: 28, pill: 999 };

/** Grosor del contorno. Es parte del dibujo, por eso es grueso. */
export const BORDER_WIDTH = 2.5;

/** Desplazamientos de la sombra dura, por tamaño. */
export const SHADOW_OFFSET = {
  sm: { x: 3, y: 3 },
  md: { x: 4, y: 5 },
  lg: { x: 6, y: 7 },
} as const;

export type ShadowSize = keyof typeof SHADOW_OFFSET;

export const fonts = {
  /** Títulos y cifras principales. */
  serif: 'PlayfairDisplay_700Bold',
  body: 'Nunito_400Regular',
  bodyBold: 'Nunito_700Bold',
  bodySemi: 'Nunito_600SemiBold',
} as const;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
