import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import {
  MOTIVOS,
  avisoDeTamano,
  emojiDe,
  formatearTamano,
  tipoLegible,
  type Adjunto,
} from '../domain/adjunto';
import { elegirYGuardar } from '../files/adjuntos';
import { newId } from '../db/index';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Label, Txt } from './ui';

/**
 * Elegir, ver y sacar el archivo que va con el mensaje.
 *
 * Copia el archivo apenas se elige, antes de guardar el mensaje. Es a
 * propósito: el permiso de lectura que da el selector del sistema se vence
 * al rato, así que si esperáramos a "Programar" ya podría no servir.
 * La contra es que un archivo elegido y después descartado queda ocupando
 * lugar hasta el próximo arranque, que es cuando se limpian los huérfanos.
 */
export function AdjuntoPicker({
  adjunto,
  onChange,
}: {
  adjunto: Adjunto | null;
  onChange: (adjunto: Adjunto | null) => void;
}): React.ReactElement {
  const p = usePalette();
  const [eligiendo, setEligiendo] = useState(false);

  const elegir = async () => {
    setEligiendo(true);
    try {
      const resultado = await elegirYGuardar(newId);
      if (!resultado.ok) {
        if (resultado.motivo !== 'cancelado') {
          Alert.alert('No podemos adjuntarlo', MOTIVOS[resultado.motivo]);
        }
        return;
      }
      const aviso = avisoDeTamano(resultado.adjunto);
      if (aviso) {
        Alert.alert('Ojo con el tamaño', aviso);
      }
      onChange(resultado.adjunto);
    } catch {
      Alert.alert(
        'No pudimos copiar el archivo',
        'Puede que no haya lugar en el teléfono, o que la app que lo tiene no nos deje leerlo. Probá con otro.',
      );
    } finally {
      setEligiendo(false);
    }
  };

  return (
    <View>
      <Label>Archivo adjunto</Label>

      {adjunto ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing(1.25),
            borderWidth: BORDER_WIDTH,
            borderColor: p.border,
            backgroundColor: p.accentSoft,
            borderRadius: radius.md,
            padding: spacing(1.5),
          }}
        >
          <Txt style={{ fontSize: 22 }}>{emojiDe(adjunto.mime)}</Txt>
          <View style={{ flex: 1 }}>
            <Txt
              numberOfLines={1}
              style={{ color: p.text, fontSize: 15, fontWeight: '700' }}
            >
              {adjunto.nombre}
            </Txt>
            <Txt style={{ color: p.textMuted, fontSize: 13 }}>
              {tipoLegible(adjunto.mime)} · {formatearTamano(adjunto.bytes)}
            </Txt>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Sacar el archivo ${adjunto.nombre}`}
            hitSlop={10}
            onPress={() => onChange(null)}
          >
            <Txt style={{ color: p.danger, fontSize: 15, fontWeight: '700' }}>
              Sacar
            </Txt>
          </Pressable>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Adjuntar un archivo"
          disabled={eligiendo}
          onPress={() => void elegir()}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing(1),
            borderWidth: BORDER_WIDTH,
            borderColor: p.border,
            borderStyle: 'dashed',
            backgroundColor: p.surface,
            borderRadius: radius.md,
            paddingVertical: spacing(1.75),
            opacity: eligiendo ? 0.6 : 1,
          }}
        >
          {eligiendo ? (
            <ActivityIndicator color={p.accent} />
          ) : (
            <Txt style={{ fontSize: 18 }}>📎</Txt>
          )}
          <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
            {eligiendo ? 'Copiando el archivo…' : 'Adjuntar foto o documento'}
          </Txt>
        </Pressable>
      )}

      <Txt
        style={{
          color: p.textMuted,
          fontSize: 13,
          lineHeight: 19,
          marginTop: spacing(1),
        }}
      >
        {adjunto
          ? 'Con archivo, a la hora del aviso se abre la lista de chats de WhatsApp para que elijas a quién mandárselo, y el texto te queda copiado para pegarlo abajo de la foto. WhatsApp no deja mandar archivos directo a un chat desde otra app.'
          : 'Se guarda una copia dentro de la app para que el archivo siga estando el día del mensaje, aunque para entonces lo hayas movido o borrado.'}
      </Txt>
    </View>
  );
}
