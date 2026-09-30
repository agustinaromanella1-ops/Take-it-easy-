import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Tono } from '../domain/estado';
import {
  BORDER_WIDTH,
  SHADOW_OFFSET,
  fonts,
  radius,
  spacing,
  usePalette,
  type Palette,
  type ShadowSize,
} from '../theme';

/**
 * El par de colores de cada tono, en un solo lugar.
 *
 * Estaba copiado en la tarjeta y en el resumen, que es justo lo que la
 * indirección de `Tono` viene a evitar: con dos copias, restilar uno o
 * agregar un tono nuevo deja los dos lados diciendo cosas distintas.
 */
export function coloresDeTono(
  p: Palette,
  tono: Tono,
): { texto: string; fondo: string } {
  switch (tono) {
    case 'aviso':
      return { texto: p.warning, fondo: p.warningSoft };
    case 'listo':
      return { texto: p.accentInk, fondo: p.accentSoft };
    case 'neutro':
      return { texto: p.textMuted, fondo: p.surfaceAlt };
  }
}

/* ------------------------------------------------------------------ *
 * Texto
 * ------------------------------------------------------------------ */

/**
 * Con tipografías propias el `fontWeight` deja de elegir el archivo correcto:
 * hay que nombrar la familia de cada peso. Este componente lo hace solo, a
 * partir del peso que ya trae el estilo, y neutraliza el `fontWeight` para
 * que Android no aplique encima una negrita sintética.
 */
const FAMILY_BY_WEIGHT: Record<string, string> = {
  normal: fonts.body,
  '400': fonts.body,
  '500': fonts.body,
  '600': fonts.bodySemi,
  bold: fonts.bodyBold,
  '700': fonts.bodyBold,
  '800': fonts.bodyBold,
  '900': fonts.bodyBold,
};

export function Txt({
  serif,
  style,
  ...rest
}: TextProps & { serif?: boolean }): React.ReactElement {
  const flat = StyleSheet.flatten(style) as TextStyle | undefined;
  const weight = String(flat?.fontWeight ?? '400');
  const family = serif
    ? fonts.serif
    : (FAMILY_BY_WEIGHT[weight] ?? fonts.body);

  return (
    <Text {...rest} style={[style, { fontFamily: family, fontWeight: 'normal' }]} />
  );
}

/** Título de pantalla: serif de display, como en Pipí Cucú. */
export function Title({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Txt
      serif
      style={[
        { color: p.text, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}

/* ------------------------------------------------------------------ *
 * Fondo
 * ------------------------------------------------------------------ */

/** El atardecer: celeste arriba, lila al medio, durazno abajo. */
export function ScreenBackground({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const p = usePalette();
  return (
    <LinearGradient
      colors={p.gradient}
      locations={[0, 0.45, 1]}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </LinearGradient>
  );
}

/* ------------------------------------------------------------------ *
 * Sombra dura
 * ------------------------------------------------------------------ */

/**
 * La sombra sin desenfoque que da el aire de calcomanía.
 *
 * No se puede hacer con las sombras nativas: en Android `elevation` siempre
 * desenfoca y no acepta desplazamiento. Así que la dibujamos: un rectángulo
 * del mismo tamaño, corrido, pintado detrás del contenido. Se ve idéntica en
 * los dos sistemas.
 *
 * Quien la use tiene que dejar margen abajo y a la derecha, o la sombra queda
 * pegada al elemento siguiente.
 */
export function HardShadow({
  children,
  size = 'md',
  corner = radius.md,
  hidden,
  style,
}: {
  children: React.ReactNode;
  size?: ShadowSize;
  corner?: number;
  /** Al apretar un botón la sombra desaparece y el botón "se hunde". */
  hidden?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const p = usePalette();
  const { x, y } = SHADOW_OFFSET[size];

  return (
    <View style={style}>
      {!hidden ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: x,
            top: y,
            right: -x,
            bottom: -y,
            borderRadius: corner,
            backgroundColor: p.shadow,
          }}
        />
      ) : null}
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ *
 * Controles
 * ------------------------------------------------------------------ */

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const p = usePalette();
  const [pressed, setPressed] = React.useState(false);

  const ghost = variant === 'ghost';
  const { x, y } = SHADOW_OFFSET.sm;

  const background =
    variant === 'primary'
      ? p.primary
      : variant === 'danger'
        ? p.dangerSoft
        : ghost
          ? 'transparent'
          : p.surface;

  const color =
    variant === 'primary'
      ? p.primaryText
      : variant === 'danger'
        ? p.danger
        : ghost
          ? p.accent
          : p.ink;

  const sunk = pressed && !ghost;

  return (
    <HardShadow
      size="sm"
      corner={radius.pill}
      hidden={ghost || sunk || disabled}
      style={[{ marginBottom: ghost ? 0 : y }, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !!disabled }}
        disabled={disabled || loading}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          backgroundColor: background,
          borderRadius: radius.pill,
          borderWidth: ghost ? 0 : BORDER_WIDTH,
          borderColor: p.border,
          paddingVertical: spacing(1.5),
          paddingHorizontal: spacing(2.75),
          minHeight: 44,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : 1,
          // Al apretar, el botón baja hasta donde estaba su sombra. Es el
          // mismo gesto que hacen los botones de verdad.
          transform: sunk ? [{ translateX: x }, { translateY: y }] : [],
        }}
      >
        {loading ? (
          <ActivityIndicator color={color} />
        ) : (
          <Txt style={{ color, fontSize: 16, fontWeight: '700' }}>{label}</Txt>
        )}
      </Pressable>
    </HardShadow>
  );
}

export function Chip({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? p.accentSoft : p.surface,
        borderColor: p.border,
        borderWidth: BORDER_WIDTH,
        borderRadius: radius.pill,
        paddingVertical: spacing(0.875),
        paddingHorizontal: spacing(1.75),
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt
        style={{
          color: selected ? p.accentInk : p.ink,
          fontSize: 14,
          fontWeight: '700',
        }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}

export function Card({
  children,
  style,
  tone = 'surface',
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'surface' | 'warning' | 'accent';
}): React.ReactElement {
  const p = usePalette();
  const background =
    tone === 'warning'
      ? p.warningSoft
      : tone === 'accent'
        ? p.accentSoft
        : p.surface;

  return (
    <HardShadow
      corner={radius.md}
      style={[{ marginBottom: SHADOW_OFFSET.md.y }, style]}
    >
      <View
        style={{
          backgroundColor: background,
          borderRadius: radius.md,
          borderWidth: BORDER_WIDTH,
          borderColor: p.border,
          padding: spacing(2.5),
        }}
      >
        {children}
      </View>
    </HardShadow>
  );
}

export function Label({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Txt
      style={[
        {
          color: p.textMuted,
          fontSize: 13,
          fontWeight: '700',
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: spacing(1),
        },
        style,
      ]}
    >
      {children}
    </Txt>
  );
}

export function EmptyState({
  title,
  detail,
}: {
  title: string;
  detail: string;
}): React.ReactElement {
  const p = usePalette();
  return (
    <View style={styles.empty}>
      <Txt
        serif
        style={{ color: p.text, fontSize: 21, textAlign: 'center' }}
      >
        {title}
      </Txt>
      <Txt
        style={{
          color: p.textMuted,
          fontSize: 15,
          textAlign: 'center',
          marginTop: spacing(1),
          lineHeight: 22,
        }}
      >
        {detail}
      </Txt>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(8),
    alignItems: 'center',
  },
});
