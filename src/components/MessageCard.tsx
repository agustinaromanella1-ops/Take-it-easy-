import React from 'react';
import { Pressable, View } from 'react-native';
import { previewLines, timeLabel } from '../domain/grouping';
import { displayName } from '../domain/phone';
import type { ScheduledMessage } from '../domain/types';
import { estadoDe, ETIQUETAS, TONOS } from '../domain/estado';
import { BORDER_WIDTH, SHADOW_OFFSET, radius, spacing, usePalette } from '../theme';
import { HardShadow, Txt } from './ui';

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
  const [pressed, setPressed] = React.useState(false);
  const who = displayName(message.contactName, message.phoneE164);
  const preview = previewLines(message.body);
  const time = message.localAt ? timeLabel(message.localAt) : trailing ?? '';
  const { x, y } = SHADOW_OFFSET.sm;

  const estado = estadoDe(message);
  const tono = estado ? TONOS[estado] : 'neutro';
  const colorEstado =
    tono === 'aviso' ? p.warning : tono === 'listo' ? p.accentInk : p.textMuted;
  const fondoEstado =
    tono === 'aviso' ? p.warningSoft : tono === 'listo' ? p.accentSoft : p.surfaceAlt;

  return (
    <HardShadow
      size="sm"
      corner={radius.md}
      hidden={pressed}
      style={{ marginBottom: spacing(1.5) + y }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Mensaje para ${who}${time ? `, ${time}` : ''}`}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={{
          backgroundColor: overdue ? p.warningSoft : p.surface,
          borderColor: p.border,
          borderWidth: BORDER_WIDTH,
          borderRadius: radius.md,
          padding: spacing(2),
          transform: pressed ? [{ translateX: x }, { translateY: y }] : [],
        }}
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
          <Txt
            numberOfLines={1}
            style={{ color: p.ink, fontSize: 16, fontWeight: '700', flex: 1 }}
          >
            {who}
          </Txt>
          <Txt
            style={{
              color: overdue ? p.warning : p.textMuted,
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            {time}
          </Txt>
        </View>
        <Txt
          numberOfLines={2}
          style={{ color: p.textMuted, fontSize: 15, lineHeight: 21 }}
        >
          {preview}
        </Txt>

        {estado ? (
          <View
            style={{
              alignSelf: 'flex-start',
              marginTop: spacing(1.25),
              backgroundColor: fondoEstado,
              borderColor: colorEstado,
              borderWidth: 1.5,
              borderRadius: radius.pill,
              paddingVertical: spacing(0.375),
              paddingHorizontal: spacing(1.25),
            }}
          >
            <Txt style={{ color: colorEstado, fontSize: 12, fontWeight: '700' }}>
              {message.recipientKind === 'grupo' ? '👥  ' : ''}
              {ETIQUETAS[estado]}
            </Txt>
          </View>
        ) : null}
      </Pressable>
    </HardShadow>
  );
}
