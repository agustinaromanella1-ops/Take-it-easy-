import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import type { CountryCode } from 'libphonenumber-js';
import {
  COMMON_COUNTRIES,
  DEFAULT_COUNTRY,
  callingCode,
  formatAsYouType,
  parsePhone,
} from '../domain/phone';
import type { RecipientKind } from '../domain/types';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Chip, Label, Txt } from './ui';

export interface Recipient {
  kind: RecipientKind;
  name: string | null;
  /** Vacío cuando es un grupo: WhatsApp no los identifica por número. */
  e164: string;
}

/** Clave estable para listas y borrados: un grupo no tiene número. */
export const claveDe = (r: Recipient): string =>
  r.kind === 'grupo' ? `grupo:${r.name ?? ''}` : r.e164;

export function RecipientPicker({
  selected,
  onAdd,
  onRemove,
  allowMultiple = false,
}: {
  selected: Recipient[];
  onAdd: (recipient: Recipient) => void;
  onRemove: (e164: string) => void;
  allowMultiple?: boolean;
}): React.ReactElement {
  const p = usePalette();
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [raw, setRaw] = useState('');
  const [showCountries, setShowCountries] = useState(false);
  const [kind, setKind] = useState<RecipientKind>('contacto');
  const [grupo, setGrupo] = useState('');

  const parsed = parsePhone(raw, country);

  const commit = (recipient: Recipient) => {
    onAdd(recipient);
    if (allowMultiple) setRaw('');
  };


  const pickFromContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Sin acceso a los contactos',
        'Podés escribir el número a mano igual. Los contactos nunca salen del teléfono.',
      );
      return;
    }

    const contact = await Contacts.presentContactPickerAsync();
    const number = contact?.phoneNumbers?.[0]?.number;
    if (!contact || !number) return;

    const fromContact = parsePhone(number, country);
    if (!fromContact.ok || !fromContact.e164) {
      // El número de la agenda puede venir en cualquier formato: lo dejamos
      // cargado en el input para que se pueda corregir a mano.
      setRaw(number);
      Alert.alert(
        'No pudimos leer ese número',
        'Lo dejamos cargado para que lo revises.',
      );
      return;
    }

    setRaw(allowMultiple ? '' : number);
    commit({ kind: 'contacto', name: contact.name ?? null, e164: fromContact.e164 });
  };

  const onChangeRaw = (text: string) => {
    setRaw(formatAsYouType(text, country));
    const next = parsePhone(text, country);
    if (next.ok && next.e164) {
      // En modo simple el número tipeado es el destinatario; en modo múltiple
      // hace falta confirmarlo con "Agregar" para poder cargar varios.
      if (!allowMultiple) commit({ kind: 'contacto', name: null, e164: next.e164 });
    } else if (!allowMultiple && selected.length > 0) {
      onRemove(claveDe(selected[0] ?? { kind: 'contacto', name: null, e164: '' }));
    }
  };

  return (
    <View>
      <Label>¿A quién?</Label>

      <View
        style={{
          flexDirection: 'row',
          gap: spacing(1),
          marginBottom: spacing(1.5),
        }}
      >
        <Chip
          label="Un contacto"
          selected={kind === 'contacto'}
          onPress={() => setKind('contacto')}
        />
        <Chip
          label="Un grupo"
          selected={kind === 'grupo'}
          onPress={() => setKind('grupo')}
        />
      </View>

      {selected.length > 0 ? (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: spacing(1),
            marginBottom: spacing(1.5),
          }}
        >
          {selected.map((r) => (
            <Pressable
              key={claveDe(r)}
              accessibilityRole="button"
              accessibilityLabel={`Quitar ${r.name ?? r.e164}`}
              onPress={() => onRemove(claveDe(r))}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing(0.75),
                backgroundColor: p.accentSoft,
                borderRadius: radius.pill,
                paddingVertical: spacing(0.75),
                paddingHorizontal: spacing(1.5),
              }}
            >
              <Txt style={{ color: p.text, fontSize: 15, fontWeight: '600' }}>
                {r.kind === 'grupo' ? `👥 ${r.name ?? ''}` : (r.name ?? r.e164)}
              </Txt>
              <Txt style={{ color: p.textMuted, fontSize: 15 }}>✕</Txt>
            </Pressable>
          ))}
        </View>
      ) : null}

      {kind === 'grupo' ? (
        <View>
          <TextInput
            value={grupo}
            onChangeText={setGrupo}
            placeholder="Nombre del grupo, ej: Familia"
            placeholderTextColor={p.textMuted}
            accessibilityLabel="Nombre del grupo"
            onSubmitEditing={() => {
              if (grupo.trim()) commit({ kind: 'grupo', name: grupo.trim(), e164: '' });
              setGrupo('');
            }}
            style={{
              borderWidth: BORDER_WIDTH,
              borderColor: p.border,
              backgroundColor: p.surface,
              borderRadius: radius.md,
              paddingHorizontal: spacing(1.5),
              paddingVertical: spacing(1.5),
              fontSize: 16,
              color: p.text,
            }}
          />
          <Txt
            style={{
              color: p.textMuted,
              fontSize: 13,
              lineHeight: 19,
              marginTop: spacing(1),
            }}
          >
            El nombre es para que sepas de qué mensaje se trata. WhatsApp no
            deja abrir un grupo desde afuera, así que a la hora del aviso se
            abre tu lista de chats con el texto ya escrito y elegís el grupo.
          </Txt>
          {grupo.trim() ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                commit({ kind: 'grupo', name: grupo.trim(), e164: '' });
                setGrupo('');
              }}
              style={{ marginTop: spacing(1) }}
            >
              <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
                ＋ Agregar "{grupo.trim()}"
              </Txt>
            </Pressable>
          ) : null}
        </View>
      ) : (
      <>
      <View style={{ flexDirection: 'row', gap: spacing(1) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Código de país, ${callingCode(country)}`}
          onPress={() => setShowCountries((s) => !s)}
          style={{
            borderWidth: BORDER_WIDTH,
            borderColor: p.border,
            backgroundColor: p.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing(1.5),
            justifyContent: 'center',
          }}
        >
          <Txt style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {callingCode(country)} ▾
          </Txt>
        </Pressable>

        <TextInput
          value={raw}
          onChangeText={onChangeRaw}
          placeholder="11 2345-6789"
          placeholderTextColor={p.textMuted}
          keyboardType="phone-pad"
          accessibilityLabel="Número de teléfono"
          style={{
            flex: 1,
            borderWidth: BORDER_WIDTH,
            borderColor: parsed.ok || !raw ? p.border : p.danger,
            backgroundColor: p.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing(1.5),
            paddingVertical: spacing(1.5),
            fontSize: 16,
            color: p.text,
          }}
        />
      </View>

      {showCountries ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing(1), paddingVertical: spacing(1) }}
        >
          {COMMON_COUNTRIES.map((c) => (
            <Chip
              key={c.code}
              label={`${c.label} ${callingCode(c.code)}`}
              selected={c.code === country}
              onPress={() => {
                setCountry(c.code);
                setShowCountries(false);
                onChangeRaw(raw);
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: spacing(1),
          gap: spacing(2),
        }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => void pickFromContacts()}
        >
          <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
            Elegir de mis contactos
          </Txt>
        </Pressable>

        {allowMultiple && parsed.ok && parsed.e164 ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (parsed.e164) commit({ kind: 'contacto', name: null, e164: parsed.e164 });
            }}
          >
            <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              ＋ Agregar
            </Txt>
          </Pressable>
        ) : null}
      </View>

      {raw && !parsed.ok ? (
        <Txt style={{ color: p.danger, fontSize: 13, marginTop: spacing(1) }}>
          Ese número no parece válido para {callingCode(country)}.
        </Txt>
      ) : null}

      {parsed.ok && parsed.assumedArgentineMobile ? (
        <Txt style={{ color: p.textMuted, fontSize: 13, marginTop: spacing(1) }}>
          Lo tomamos como celular: {parsed.e164}. WhatsApp necesita el 9 después
          del +54.
        </Txt>
      ) : null}
      </>
      )}
    </View>
  );
}
