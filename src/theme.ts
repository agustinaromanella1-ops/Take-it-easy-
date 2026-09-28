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
  // El cielo al caer la tarde mirado desde abajo: verde agua arriba, donde
  // todavía queda día, y durazno abajo, sobre el horizonte.
  gradient: ['#ddf2ec', '#f1ecf9', '#fff0e6'],
  bg: '#f1ecf9',
  surface: '#ffffff',
  surfaceAlt: '#f2f8f6',

  ink: '#123f3c',
  text: '#123f3c',
  textMuted: '#4a6a66',

  border: '#123f3c',
  shadow: '#123f3c',

  accent: '#186b5c',
  accentSoft: '#d7f0e8',
  accentInk: '#0f5447',
  primary: '#ff9c80',
  primaryText: '#123f3c',

  warning: '#9a4a0a',
  warningSoft: '#fdeedd',
  danger: '#a8323f',
  dangerSoft: '#fde7ea',

  bubble: '#ddf3ec',
  bubbleText: '#10514a',
};

const dark: Palette = {
  // El mismo atardecer un rato más tarde: el verde agua se apaga en noche y
  // el durazno queda como un resto de ciruela sobre el horizonte.
  gradient: ['#0e2321', '#16202e', '#2a1f2b'],
  bg: '#16202e',
  surface: '#1b2e2c',
  surfaceAlt: '#162523',

  ink: '#eaf5f2',
  text: '#eaf5f2',
  textMuted: '#9db5b1',

  // Sobre oscuro una línea oscura no se ve: el contorno se aclara.
  border: '#71958e',
  // La sombra dura necesita ser MÁS oscura que el fondo para leerse.
  shadow: '#050f0e',

  accent: '#7fd9c4',
  accentSoft: '#1b3b36',
  accentInk: '#8fe0cc',
  primary: '#ff9c80',
  primaryText: '#123f3c',

  warning: '#f0c48a',
  warningSoft: '#3a2b1c',
  danger: '#ff8a9b',
  dangerSoft: '#42222a',

  bubble: '#1d423c',
  bubbleText: '#8ddcc6',
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

/** Las dos paletas, expuestas para que el test de contraste las mida. */
export const palettes = { light, dark } as const;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
