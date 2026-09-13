import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  bubble: string;
  bubbleText: string;
}

const light: Palette = {
  bg: '#FBF8F4',
  surface: '#FFFFFF',
  surfaceAlt: '#F2EEE8',
  border: '#E4DDD3',
  text: '#1B1815',
  textMuted: '#7A7168',
  accent: '#0F7A5F',
  accentText: '#FFFFFF',
  accentSoft: '#E1F0EA',
  warning: '#A65B12',
  warningSoft: '#FBEBD9',
  danger: '#B3261E',
  bubble: '#DCF3E4',
  bubbleText: '#12281D',
};

const dark: Palette = {
  bg: '#141311',
  surface: '#1E1C19',
  surfaceAlt: '#272420',
  border: '#38342E',
  text: '#F2EDE6',
  textMuted: '#A29A90',
  accent: '#4FCFA6',
  accentText: '#0C1F18',
  accentSoft: '#1C3A31',
  warning: '#E8A765',
  warningSoft: '#3A2C1B',
  danger: '#F2857C',
  bubble: '#1F4034',
  bubbleText: '#E4F5EB',
};

export const spacing = (n: number): number => n * 8;

export const radius = { sm: 8, md: 14, lg: 22, pill: 999 };

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
