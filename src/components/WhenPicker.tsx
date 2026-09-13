import React, { useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { parseISO } from 'date-fns';
import { dayLabel, timeLabel } from '../domain/grouping';
import { quickOptions } from '../domain/schedule';
import { toWallString } from '../domain/time';
import type { WallClock } from '../domain/time';
import { spacing, usePalette } from '../theme';
import { Chip, Label } from './ui';

/**
 * Atajos primero, date picker después. La idea es que programar sea tocar
 * "Mañana 9:00" y listo; el selector completo está para el caso raro.
 */
export function WhenPicker({
  timezone,
  value,
  onChange,
}: {
  timezone: string;
  value: WallClock | null;
  onChange: (wall: WallClock) => void;
}): React.ReactElement {
  const p = usePalette();
  const [iosPickerVisible, setIosPickerVisible] = useState(false);
  const options = useMemo(() => quickOptions(timezone), [timezone]);

  const openCustomPicker = () => {
    const base = value ? parseISO(value) : new Date();

    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: base,
        mode: 'date',
        minimumDate: new Date(),
        onChange: (_event: DateTimePickerEvent, date?: Date) => {
          if (!date) return;
          DateTimePickerAndroid.open({
            value: date,
            mode: 'time',
            is24Hour: true,
            onChange: (__: DateTimePickerEvent, time?: Date) => {
              if (!time) return;
              const merged = new Date(date);
              merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
              onChange(toWallString(merged));
            },
          });
        },
      });
      return;
    }

    setIosPickerVisible((v) => !v);
  };

  return (
    <View>
      <Label>¿Cuándo?</Label>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing(1),
          marginBottom: spacing(1.5),
        }}
      >
        {options.map((o) => (
          <Chip
            key={o.id}
            label={o.label}
            selected={value === o.wall}
            onPress={() => onChange(o.wall)}
          />
        ))}
        <Chip label="Otro momento…" onPress={openCustomPicker} />
      </View>

      {iosPickerVisible && Platform.OS === 'ios' ? (
        <DateTimePicker
          value={value ? parseISO(value) : new Date()}
          mode="datetime"
          display="inline"
          minimumDate={new Date()}
          locale="es-AR"
          onChange={(_e: DateTimePickerEvent, date?: Date) => {
            if (date) onChange(toWallString(date));
          }}
        />
      ) : null}

      {value ? (
        <Text style={{ color: p.text, fontSize: 15 }}>
          Sale{' '}
          <Text style={{ fontWeight: '800' }}>
            {dayLabel(value, timezone).toLowerCase()} a las {timeLabel(value)}
          </Text>
        </Text>
      ) : (
        <Text style={{ color: p.textMuted, fontSize: 15 }}>
          Sin fecha todavía: se guarda como borrador.
        </Text>
      )}
    </View>
  );
}
