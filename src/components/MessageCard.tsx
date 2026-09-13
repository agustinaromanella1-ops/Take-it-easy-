import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { previewLines, timeLabel } from '../domain/grouping';
import { displayName } from '../domain/phone';
import type { ScheduledMessage } from '../domain/types';
import { radius, spacing, usePalette } from '../theme';

export function MessageCard({
  message,
  onPress,
  overdue,
  trailing,
}: {
  message: ScheduledMessage;
  onPress: () => void;
  overdue?: boolean;
  trailing?: string;
}): React.ReactElement {
  const p = usePalette();
  const who = displayName(message.contactName, message.phoneE164);
  const preview = previewLines(message.body);
  const time = message.localAt ? timeLabel(message.localAt) : trailing ?? '';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Mensaje para ${who}${time ? `, ${time}` : ''}`}
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: overdue ? p.warningSoft : p.surface,
        borderColor: overdue ? p.warning : p.border,
        borderWidth: 1,
        borderRadius: radius.md,
        padding: spacing(2),
        marginBottom: spacing(1.25),
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: spacing(0.75),
          gap: spacing(1),
        }}
      >
        <Text
          numberOfLines={1}
          style={{ color: p.text, fontSize: 16, fontWeight: '700', flex: 1 }}
        >
          {who}
        </Text>
        <Text
          style={{
            color: overdue ? p.warning : p.textMuted,
            fontSize: 14,
            fontWeight: '600',
          }}
        >
          {time}
        </Text>
      </View>
      <Text numberOfLines={2} style={{ color: p.textMuted, fontSize: 15, lineHeight: 20 }}>
        {preview}
      </Text>
    </Pressable>
  );
}
