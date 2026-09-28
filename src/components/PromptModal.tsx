import React, { useEffect, useState } from 'react';
import { Modal, Pressable, TextInput, View } from 'react-native';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Button, Title, Txt } from './ui';

/**
 * Alert.prompt existe solo en iOS, así que para pedir un texto usamos este
 * modal y el botón funciona igual en los dos sistemas.
 */
export function PromptModal({
  visible,
  title,
  detail,
  placeholder,
  initialValue = '',
  confirmLabel = 'Guardar',
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  title: string;
  detail?: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}): React.ReactElement {
  const p = usePalette();
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [initialValue, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cancelar"
        onPress={onCancel}
        style={{
          flex: 1,
          backgroundColor: '#00000066',
          justifyContent: 'center',
          padding: spacing(3),
        }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: p.surface,
            borderRadius: radius.lg,
            padding: spacing(3),
            gap: spacing(1.5),
          }}
        >
          <Title style={{ fontSize: 22, lineHeight: 28 }}>{title}</Title>
          {detail ? (
            <Txt style={{ color: p.textMuted, fontSize: 15, lineHeight: 21 }}>
              {detail}
            </Txt>
          ) : null}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={p.textMuted}
            autoFocus
            accessibilityLabel={title}
            style={{
              borderWidth: BORDER_WIDTH,
              borderColor: p.border,
              backgroundColor: p.surfaceAlt,
              borderRadius: radius.sm,
              paddingHorizontal: spacing(1.5),
              paddingVertical: spacing(1.5),
              fontSize: 16,
              color: p.text,
            }}
          />
          <Button
            label={confirmLabel}
            disabled={!value.trim()}
            onPress={() => onConfirm(value.trim())}
          />
          <Button label="Cancelar" variant="ghost" onPress={onCancel} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
