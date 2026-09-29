import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { timeLabel } from '../domain/grouping';
import { parsePhone } from '../domain/phone';
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  formatRule,
  parseRule,
  type Frequency,
} from '../domain/recurrence';
import { isWithinAllowed, nextAllowed } from '../domain/quietHours';
import {
  extractVariables,
  missingVariables,
  renderTemplate,
} from '../domain/templates';
import type { WallClock } from '../domain/time';
import { isPast } from '../domain/time';
import { useMessages } from '../state/MessagesContext';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Button, Chip, Label, Txt } from '../components/ui';
import { ChatBubblePreview } from '../components/ChatBubblePreview';
import { PromptModal } from '../components/PromptModal';
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
  const {
    messages,
    templates,
    quietHours,
    timezone,
    createMessage,
    createForMany,
    editMessage,
    saveTemplate,
  } = useMessages();

  const editingId = route.params?.id ?? null;
  const duplicateOf = route.params?.duplicateOf ?? null;
  const resendOf = route.params?.resendOf ?? null;
  /** De dónde salen los datos iniciales. Editar manda sobre las otras dos. */
  const copiaDe = editingId ?? duplicateOf ?? resendOf;

  const existing = useMemo(
    () => (editingId ? messages.find((m) => m.id === editingId) ?? null : null),
    [editingId, messages],
  );
  // Copiar no crea nada: los datos se cargan en el formulario y recién al
  // guardar hay una fila.
  const fuente = useMemo(
    () =>
      existing ??
      (copiaDe ? messages.find((m) => m.id === copiaDe) ?? null : null),
    [copiaDe, existing, messages],
  );

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [body, setBody] = useState('');
  const [when, setWhen] = useState<WallClock | null>(null);
  const [frequency, setFrequency] = useState<Frequency | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [namingTemplate, setNamingTemplate] = useState(false);

  // Se carga una sola vez por mensaje. Antes el efecto dependía del objeto,
  // cuya identidad cambia en cada refresh(): volver a la app o recibir un
  // aviso mientras se escribía pisaba el texto tipeado con el guardado.
  const cargado = useRef<string | null>(null);
  useEffect(() => {
    if (!fuente || !copiaDe || cargado.current === copiaDe) return;
    cargado.current = copiaDe;

    // Duplicar es "lo mismo para otra persona", así que el destinatario se
    // elige de nuevo. Reenviar es "de nuevo a esta persona" y lo conserva.
    setRecipients(
      duplicateOf ? [] : [{ name: fuente.contactName, e164: fuente.phoneE164 }],
    );
    setBody(fuente.body);
    setWhen(editingId ? fuente.localAt : null);
    setFrequency(parseRule(fuente.recurrenceRule));
  }, [copiaDe, duplicateOf, editingId, fuente]);

  useEffect(() => {
    navigation.setOptions({
      title: editingId
        ? 'Editar mensaje'
        : duplicateOf
          ? 'Duplicar mensaje'
          : resendOf
            ? 'Volver a mandarlo'
            : 'Nuevo mensaje',
    });
  }, [duplicateOf, editingId, navigation, resendOf]);

  const variables = useMemo(() => extractVariables(body), [body]);
  const rendered = useMemo(
    () => renderTemplate(body, values),
    [body, values],
  );

  const outsideAllowed = when !== null && !isWithinAllowed(when, quietHours);
  const canSave = recipients.length > 0 && body.trim().length > 0 && !saving;

  const addRecipient = (recipient: Recipient) =>
    setRecipients((current) =>
      current.some((r) => r.e164 === recipient.e164)
        ? current
        : editingId
          ? [recipient]
          : [...current, recipient],
    );

  const offerToSaveTemplate = () => {
    if (variables.length === 0) {
      Alert.alert(
        'Todavía no es una plantilla',
        'Poné algo entre llaves, como {nombre}, para que se complete distinto cada vez.',
      );
      return;
    }
    setNamingTemplate(true);
  };

  const save = async () => {
    const parsedAll = recipients.map((r) => parsePhone(r.e164));
    if (parsedAll.some((x) => !x.ok)) {
      Alert.alert('Revisá los números', 'Hay un teléfono que no pudimos interpretar.');
      return;
    }
    if (when && isPast(when, timezone)) {
      Alert.alert(
        'Ese momento ya pasó',
        'Elegí una fecha y hora que todavía no hayan llegado.',
      );
      return;
    }

    const pending = missingVariables(body, values);
    if (pending.length > 0) {
      Alert.alert(
        'Faltan completar datos',
        `Todavía no llenaste: ${pending.map((v) => `{${v}}`).join(', ')}. Si lo mandás así, se va a ver tal cual.`,
      );
      return;
    }

    setSaving(true);
    try {
      const text = rendered.trim();
      const recurrenceRule = frequency ? formatRule(frequency) : null;

      if (existing) {
        const first = recipients[0];
        if (!first) return;
        await editMessage(existing.id, {
          body: text,
          phoneE164: first.e164,
          contactName: first.name,
          recurrenceRule,
          ...(when && when !== existing.localAt ? { localAt: when } : {}),
        });
      } else if (recipients.length === 1) {
        const only = recipients[0];
        if (!only) return;
        await createMessage({
          contactName: only.name,
          phoneE164: only.e164,
          body: text,
          localAt: when,
          recurrenceRule,
        });
      } else {
        await createForMany(recipients, {
          body: text,
          localAt: when,
          recurrenceRule,
        });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: 'transparent' }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top + spacing(6)}
    >
      <ScrollView
        contentContainerStyle={{ padding: spacing(2), gap: spacing(3) }}
        keyboardShouldPersistTaps="handled"
      >
        <RecipientPicker
          selected={recipients}
          allowMultiple={!editingId}
          onAdd={addRecipient}
          onRemove={(e164) =>
            setRecipients((current) => current.filter((r) => r.e164 !== e164))
          }
        />

        {recipients.length > 1 ? (
          <Txt style={{ color: p.textMuted, fontSize: 13, marginTop: -spacing(2) }}>
            Se va a crear un mensaje individual para cada persona. No es una
            difusión: nadie ve a los demás.
          </Txt>
        ) : null}

        {templates.length > 0 && !editingId ? (
          <View>
            <Label>Empezar desde una plantilla</Label>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}
            >
              {templates.map((t) => (
                <Chip
                  key={t.id}
                  label={t.name}
                  onPress={() => {
                    setBody(t.body);
                    setValues({});
                  }}
                />
              ))}
            </View>
          </View>
        ) : null}

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
              borderWidth: BORDER_WIDTH,
              borderColor: p.border,
              backgroundColor: p.surface,
              borderRadius: radius.md,
              padding: spacing(1.75),
              fontSize: 16,
              lineHeight: 22,
              color: p.text,
            }}
          />
          {variables.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              onPress={offerToSaveTemplate}
              style={{ marginTop: spacing(1) }}
            >
              <Txt style={{ color: p.accent, fontSize: 14, fontWeight: '700' }}>
                Guardar como plantilla
              </Txt>
            </Pressable>
          ) : null}
        </View>

        {variables.length > 0 ? (
          <View>
            <Label>Completar</Label>
            {variables.map((name) => (
              <View key={name} style={{ marginBottom: spacing(1) }}>
                <Txt
                  style={{
                    color: p.textMuted,
                    fontSize: 13,
                    marginBottom: spacing(0.5),
                  }}
                >
                  {`{${name}}`}
                </Txt>
                <TextInput
                  value={values[name] ?? ''}
                  onChangeText={(text) =>
                    setValues((current) => ({ ...current, [name]: text }))
                  }
                  placeholder={name}
                  placeholderTextColor={p.textMuted}
                  accessibilityLabel={`Valor para ${name}`}
                  style={{
                    borderWidth: BORDER_WIDTH,
                    borderColor: p.border,
                    backgroundColor: p.surface,
                    borderRadius: radius.md,
                    paddingHorizontal: spacing(1.5),
                    paddingVertical: spacing(1.25),
                    fontSize: 16,
                    color: p.text,
                  }}
                />
              </View>
            ))}
          </View>
        ) : null}

        <WhenPicker timezone={timezone} value={when} onChange={setWhen} />

        {outsideAllowed && when ? (
          <View
            style={{
              backgroundColor: p.warningSoft,
              borderColor: p.warning,
              borderWidth: BORDER_WIDTH,
              borderRadius: radius.md,
              padding: spacing(1.75),
            }}
          >
            <Txt style={{ color: p.text, fontSize: 14, lineHeight: 20 }}>
              Esa hora queda fuera de la franja que elegiste para mandar
              mensajes.
            </Txt>
            <Pressable
              accessibilityRole="button"
              onPress={() => setWhen(nextAllowed(when, quietHours))}
              style={{ marginTop: spacing(1) }}
            >
              <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
                Mover a las{' '}
                {timeLabel(nextAllowed(when, quietHours))}
              </Txt>
            </Pressable>
          </View>
        ) : null}

        {when ? (
          <View>
            <Label>¿Se repite?</Label>
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}
            >
              <Chip
                label="Una sola vez"
                selected={frequency === null}
                onPress={() => setFrequency(null)}
              />
              {FREQUENCIES.map((f) => (
                <Chip
                  key={f}
                  label={FREQUENCY_LABELS[f]}
                  selected={frequency === f}
                  onPress={() => setFrequency(f)}
                />
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Label>Cómo se va a ver</Label>
          <ChatBubblePreview
            body={rendered}
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
          backgroundColor: 'transparent',
        }}
      >
        <Button
          label={
            !when
              ? 'Guardar sin fecha'
              : recipients.length > 1
                ? `Programar ${recipients.length} mensajes`
                : 'Programar'
          }
          onPress={() => void save()}
          disabled={!canSave}
          loading={saving}
        />
      </View>
      <PromptModal
        visible={namingTemplate}
        title="Guardar como plantilla"
        detail="Después la vas a poder elegir al escribir un mensaje nuevo."
        placeholder="Ej: Saludo de cumpleaños"
        onConfirm={(name) => {
          setNamingTemplate(false);
          void saveTemplate(name, body);
        }}
        onCancel={() => setNamingTemplate(false)}
      />
    </KeyboardAvoidingView>
  );
}
