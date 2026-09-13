import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { timeLabel } from '../domain/grouping';
import { parsePhone } from '../domain/phone';
import type { WallClock } from '../domain/time';
import { isPast } from '../domain/time';
import { useMessages } from '../state/MessagesContext';
import { radius, spacing, usePalette } from '../theme';
import { Button, Label } from '../components/ui';
import { ChatBubblePreview } from '../components/ChatBubblePreview';
import { RecipientPicker, type Recipient } from '../components/RecipientPicker';
import { WhenPicker } from '../components/WhenPicker';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Compose'>;

export function ComposeScreen({
  navigation,
  route,
}: Props): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { messages, timezone, createMessage, editMessage, rescheduleMessage } =
    useMessages();

  const editingId = route.params?.id ?? null;
  const existing = useMemo(
    () => messages.find((m) => m.id === editingId) ?? null,
    [editingId, messages],
  );

  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [body, setBody] = useState('');
  const [when, setWhen] = useState<WallClock | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setRecipient({
      name: existing.contactName,
      e164: existing.phoneE164,
    });
    setBody(existing.body);
    setWhen(existing.localAt);
  }, [existing]);

  useEffect(() => {
    navigation.setOptions({
      title: editingId ? 'Editar mensaje' : 'Nuevo mensaje',
    });
  }, [editingId, navigation]);

  const canSave = !!recipient && body.trim().length > 0 && !saving;

  const save = async () => {
    if (!recipient) return;
    const parsed = parsePhone(recipient.e164);
    if (!parsed.ok || !parsed.e164) {
      Alert.alert('Revisá el número', 'No pudimos interpretar ese teléfono.');
      return;
    }
    if (when && isPast(when, timezone)) {
      Alert.alert(
        'Ese momento ya pasó',
        'Elegí una fecha y hora que todavía no hayan llegado.',
      );
      return;
    }

    setSaving(true);
    try {
      if (existing) {
        await editMessage(existing.id, {
          body: body.trim(),
          phoneE164: parsed.e164,
          contactName: recipient.name,
        });
        if (when && when !== existing.localAt) {
          await rescheduleMessage(existing.id, when);
        }
      } else {
        await createMessage({
          contactName: recipient.name,
          phoneE164: parsed.e164,
          body: body.trim(),
          localAt: when,
        });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.bg }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + spacing(6)}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing(2), gap: spacing(3) }}
        keyboardShouldPersistTaps="handled"
      >
        <RecipientPicker value={recipient} onChange={setRecipient} />

        <View>
          <Label>El mensaje</Label>
          <TextInput
            value={body}
            onChangeText={setBody}
            multiline
            autoFocus={!editingId}
            textAlignVertical="top"
            placeholder="Escribí lo que querés mandar…"
            placeholderTextColor={p.textMuted}
            accessibilityLabel="Texto del mensaje"
            style={{
              minHeight: 140,
              borderWidth: 1,
              borderColor: p.border,
              backgroundColor: p.surface,
              borderRadius: radius.md,
              padding: spacing(1.75),
              fontSize: 16,
              lineHeight: 22,
              color: p.text,
            }}
          />
        </View>

        <WhenPicker timezone={timezone} value={when} onChange={setWhen} />

        <View>
          <Label>Cómo se va a ver</Label>
          <ChatBubblePreview
            body={body}
            time={when ? timeLabel(when) : '--:--'}
          />
        </View>
      </ScrollView>

      <View
        style={{
          padding: spacing(2),
          paddingBottom: insets.bottom + spacing(2),
          borderTopWidth: 1,
          borderTopColor: p.border,
          backgroundColor: p.bg,
        }}
      >
        <Button
          label={when ? 'Programar' : 'Guardar sin fecha'}
          onPress={() => void save()}
          disabled={!canSave}
          loading={saving}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
