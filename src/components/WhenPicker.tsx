import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
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
import { Chip, Label, Txt } from './ui';

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
  /**
   * Qué atajo se tocó. No alcanza con comparar el valor contra el del atajo:
   * "En 2 horas" se recalcula y a los pocos minutos ya no coincide consigo
   * mismo. Pero tampoco alcanza con recordar el id, porque el valor puede
   * cambiarlo otro control —el aviso de horario permitido, por ejemplo—; por
   * eso se guarda también lo último que emitimos y la marca se limpia si el
   * valor dejó de ser ese.
   */
  const [elegido, setElegido] = useState<string | null>(null);
  const emitido = useRef<WallClock | null>(null);

  useEffect(() => {
    if (value !== emitido.current) setElegido(null);
  }, [value]);

  // Sin memorizar: si la pantalla queda abierta un rato, "En 2 horas"
  // apuntaría a un momento ya pasado y el guardado lo rechazaría.
  const options = quickOptions(timezone);
  // Al editar un mensaje cuya hora coincide exactamente con un atajo, se marca
  // ese atajo aunque nadie lo haya tocado en esta pantalla.
  const marcado = elegido ?? options.find((o) => o.wall === value)?.id ?? null;

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
            selected={marcado === o.id}
            onPress={() => {
              // Recalculado al tocar, no al dibujar: entre una cosa y la otra
              // pudo pasar el tiempo suficiente para que el valor sea pasado.
              const fresco = quickOptions(timezone).find((x) => x.id === o.id);
              // Si el atajo venció entre el dibujado y el toque, ya no está
              // en la lista nueva. Caer al valor viejo sería agendar en el
              // pasado, que es justo lo que este recálculo evita.
              if (!fresco) return;
              emitido.current = fresco.wall;
              setElegido(o.id);
              onChange(fresco.wall);
            }}
          />
        ))}
        <Chip
          label="Otro momento…"
          onPress={() => {
            setElegido(null);
            emitido.current = null;
            openCustomPicker();
          }}
        />
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
        <Txt style={{ color: p.text, fontSize: 15 }}>
          Sale{' '}
          <Txt style={{ fontWeight: '800' }}>
            {dayLabel(value, timezone).toLowerCase()} a las {timeLabel(value)}
          </Txt>
        </Txt>
      ) : (
        <Txt style={{ color: p.textMuted, fontSize: 15 }}>
          Sin fecha todavía: se guarda como borrador.
        </Txt>
      )}
    </View>
  );
}
