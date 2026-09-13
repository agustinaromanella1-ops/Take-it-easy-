import React, { useMemo } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { dayLabel, timeLabel } from '../domain/grouping';
import { displayName } from '../domain/phone';
import { describeRule } from '../domain/recurrence';
import { SHIFT_LABELS, shiftWall, type ShiftKind } from '../domain/schedule';
import { isPast } from '../domain/time';
import { useMessages } from '../state/MessagesContext';
import { spacing, usePalette } from '../theme';
import { Button, Card, Chip, Label } from '../components/ui';
import { ChatBubblePreview } from '../components/ChatBubblePreview';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Detail'>;

export function MessageDetailScreen({
  navigation,
  route,
}: Props): React.ReactElement | null {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const {
    messages,
    timezone,
    rescheduleMessage,
    duplicateMessage,
    deleteMessage,
    openInWhatsApp,
    confirmSent,
  } = useMessages();

  const message = useMemo(
    () => messages.find((m) => m.id === route.params.id) ?? null,
    [messages, route.params.id],
  );

  if (!message) return null;

  const who = displayName(message.contactName, message.phoneE164);
  const recurrence = describeRule(message.recurrenceRule, message.localAt);
  const overdue =
    message.localAt !== null && isPast(message.localAt, message.timezone);

  const applyShift = async (kind: ShiftKind) => {
    const base = message.localAt ?? new Date().toISOString().slice(0, 16);
    const next = shiftWall(base, kind);
    if (isPast(next, timezone)) {
      Alert.alert('Ese momento ya pasó', 'Probá con otro corrimiento.');
      return;
    }
    await rescheduleMessage(message.id, next);
  };

  const confirmDelete = () => {
    Alert.alert('¿Cancelar este mensaje?', 'Lo vas a poder deshacer un momento.', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Cancelar mensaje',
        style: 'destructive',
        onPress: () => {
          void deleteMessage(message.id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        padding: spacing(2),
        paddingBottom: insets.bottom + spacing(4),
        gap: spacing(3),
      }}
    >
      <View>
        <Text style={{ color: p.text, fontSize: 26, fontWeight: '800' }}>
          {who}
        </Text>
        <Text
          style={{
            color: overdue ? p.warning : p.textMuted,
            fontSize: 15,
            marginTop: spacing(0.5),
          }}
        >
          {message.localAt
            ? `${overdue ? 'Estaba para' : 'Sale'} ${dayLabel(
                message.localAt,
                timezone,
              ).toLowerCase()} a las ${timeLabel(message.localAt)}`
            : 'Sin fecha: guardado como borrador'}
        </Text>
        {recurrence ? (
          <Text
            style={{
              color: p.accent,
              fontSize: 14,
              fontWeight: '700',
              marginTop: spacing(0.5),
            }}
          >
            🔁 {recurrence}
          </Text>
        ) : null}
      </View>

      <ChatBubblePreview
        body={message.body}
        time={message.localAt ? timeLabel(message.localAt) : '--:--'}
      />

      {overdue ? (
        <Card style={{ backgroundColor: p.warningSoft, borderColor: p.warning }}>
          <Text style={{ color: p.text, fontSize: 15, lineHeight: 21 }}>
            La hora pasó y todavía no se mandó. Podés mandarlo ahora o correrlo a
            otro momento.
          </Text>
        </Card>
      ) : null}

      <View style={{ gap: spacing(1) }}>
        <Button
          label="Abrir WhatsApp con el mensaje"
          onPress={() => void openInWhatsApp(message.id)}
        />
        <Text
          style={{
            color: p.textMuted,
            fontSize: 13,
            textAlign: 'center',
            lineHeight: 18,
          }}
        >
          Se abre el chat con el texto ya escrito. El envío lo confirmás vos.
        </Text>
      </View>

      <View>
        <Label>Reprogramar</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}>
          {(Object.keys(SHIFT_LABELS) as ShiftKind[]).map((kind) => (
            <Chip
              key={kind}
              label={SHIFT_LABELS[kind]}
              onPress={() => void applyShift(kind)}
            />
          ))}
          <Chip
            label="Elegir momento…"
            onPress={() => navigation.navigate('Compose', { id: message.id })}
          />
        </View>
      </View>

      <View style={{ gap: spacing(1) }}>
        <Button
          label="Editar texto o destinatario"
          variant="secondary"
          onPress={() => navigation.navigate('Compose', { id: message.id })}
        />
        <Button
          label="Duplicar para otra persona"
          variant="secondary"
          onPress={() => {
            void (async () => {
              const copy = await duplicateMessage(message.id);
              if (copy) navigation.replace('Compose', { id: copy.id });
            })();
          }}
        />
        <Button
          label="Marcar como enviado"
          variant="ghost"
          onPress={() => {
            void confirmSent(message.id);
            navigation.goBack();
          }}
        />
        <Button label="Cancelar mensaje" variant="danger" onPress={confirmDelete} />
      </View>
    </ScrollView>
  );
}
