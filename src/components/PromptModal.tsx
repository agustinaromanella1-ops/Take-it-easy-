import React, { useEffect, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { radius, spacing, usePalette } from '../theme';
import { Button } from './ui';

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
          <Text style={{ color: p.text, fontSize: 20, fontWeight: '800' }}>
            {title}
          </Text>
          {detail ? (
            <Text style={{ color: p.textMuted, fontSize: 15, lineHeight: 21 }}>
              {detail}
            </Text>
          ) : null}
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder={placeholder}
            placeholderTextColor={p.textMuted}
            autoFocus
            accessibilityLabel={title}
            style={{
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.bg,
              borderRadius: radius.md,
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
