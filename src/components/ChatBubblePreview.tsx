import React from 'react';
import { Text, View } from 'react-native';
import { radius, spacing, usePalette } from '../theme';

/**
 * Vista previa con forma de burbuja de chat. No es decoración: leer el texto
 * como lo va a ver la otra persona ayuda a corregir el tono antes de mandarlo.
 */
export function ChatBubblePreview({
  body,
  time,
}: {
  body: string;
  time: string;
}): React.ReactElement {
  const p = usePalette();
  const text = body.trim();

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        style={{
          backgroundColor: p.bubble,
          borderRadius: radius.md,
          borderTopRightRadius: radius.sm / 2,
          paddingVertical: spacing(1.25),
          paddingHorizontal: spacing(1.75),
          maxWidth: '92%',
        }}
      >
        <Text
          style={{
            color: text ? p.bubbleText : p.textMuted,
            fontSize: 16,
            lineHeight: 22,
            fontStyle: text ? 'normal' : 'italic',
          }}
        >
          {text || 'Escribí el mensaje para verlo acá'}
        </Text>
        <Text
          style={{
            color: p.textMuted,
            fontSize: 11,
            alignSelf: 'flex-end',
            marginTop: spacing(0.5),
          }}
        >
          {time}
        </Text>
      </View>
    </View>
  );
}
