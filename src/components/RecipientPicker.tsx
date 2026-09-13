import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import type { CountryCode } from 'libphonenumber-js';
import {
  COMMON_COUNTRIES,
  DEFAULT_COUNTRY,
  callingCode,
  formatAsYouType,
  parsePhone,
} from '../domain/phone';
import { radius, spacing, usePalette } from '../theme';
import { Chip, Label } from './ui';

export interface Recipient {
  name: string | null;
  e164: string;
}

export function RecipientPicker({
  value,
  onChange,
}: {
  value: Recipient | null;
  onChange: (recipient: Recipient | null) => void;
}): React.ReactElement {
  const p = usePalette();
  const [country, setCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [raw, setRaw] = useState('');
  const [showCountries, setShowCountries] = useState(false);

  const parsed = parsePhone(raw, country);

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

    setRaw(number);
    onChange({ name: contact.name ?? null, e164: fromContact.e164 });
  };

  const onChangeRaw = (text: string) => {
    setRaw(formatAsYouType(text, country));
    const next = parsePhone(text, country);
    onChange(next.ok && next.e164 ? { name: null, e164: next.e164 } : null);
  };

  return (
    <View>
      <Label>¿A quién?</Label>

      {value?.name ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: p.accentSoft,
            borderRadius: radius.md,
            padding: spacing(1.5),
            marginBottom: spacing(1),
          }}
        >
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {value.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quitar contacto"
            hitSlop={12}
            onPress={() => {
              onChange(null);
              setRaw('');
            }}
          >
            <Text style={{ color: p.accent, fontWeight: '700' }}>Cambiar</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing(1) }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Código de país, ${callingCode(country)}`}
          onPress={() => setShowCountries((s) => !s)}
          style={{
            borderWidth: 1,
            borderColor: p.border,
            backgroundColor: p.surface,
            borderRadius: radius.md,
            paddingHorizontal: spacing(1.5),
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: p.text, fontSize: 16, fontWeight: '700' }}>
            {callingCode(country)} ▾
          </Text>
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
            borderWidth: 1,
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

      <Pressable
        accessibilityRole="button"
        onPress={() => void pickFromContacts()}
        style={{ marginTop: spacing(1) }}
      >
        <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
          Elegir de mis contactos
        </Text>
      </Pressable>

      {raw && !parsed.ok ? (
        <Text style={{ color: p.danger, fontSize: 13, marginTop: spacing(1) }}>
          Ese número no parece válido para {callingCode(country)}.
        </Text>
      ) : null}

      {parsed.ok && parsed.assumedArgentineMobile ? (
        <Text style={{ color: p.textMuted, fontSize: 13, marginTop: spacing(1) }}>
          Lo tomamos como celular: {parsed.e164}. WhatsApp necesita el 9 después
          del +54.
        </Text>
      ) : null}
    </View>
  );
}
