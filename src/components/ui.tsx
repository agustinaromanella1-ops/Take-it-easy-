import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { radius, spacing, usePalette } from '../theme';

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

  const bg =
    variant === 'primary'
      ? p.accent
      : variant === 'secondary'
        ? p.surfaceAlt
        : 'transparent';
  const fg =
    variant === 'primary'
      ? p.accentText
      : variant === 'danger'
        ? p.danger
        : p.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderRadius: radius.pill,
          paddingVertical: spacing(1.75),
          paddingHorizontal: spacing(3),
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.45 : pressed ? 0.8 : 1,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: p.border,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: 16, fontWeight: '600' }}>
          {label}
        </Text>
      )}
    </Pressable>
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
        borderColor: selected ? p.accent : p.border,
        borderWidth: 1,
        borderRadius: radius.pill,
        paddingVertical: spacing(1),
        paddingHorizontal: spacing(1.75),
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? p.accent : p.text,
          fontSize: 14,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}): React.ReactElement {
  const p = usePalette();
  return (
    <View
      style={[
        {
          backgroundColor: p.surface,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: p.border,
          padding: spacing(2),
        },
        style,
      ]}
    >
      {children}
    </View>
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
    <Text
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
    </Text>
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
      <Text
        style={{
          color: p.text,
          fontSize: 18,
          fontWeight: '700',
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: p.textMuted,
          fontSize: 15,
          textAlign: 'center',
          marginTop: spacing(1),
          lineHeight: 21,
        }}
      >
        {detail}
      </Text>
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
