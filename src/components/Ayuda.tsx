import React from 'react';
import { Linking, Modal, Pressable, View } from 'react-native';
import { siguienteConsejo, type Pantalla } from '../domain/ayuda';
import { describirVersion, type Publicacion } from '../domain/actualizacion';
import { useMessages } from '../state/MessagesContext';
import { BORDER_WIDTH, radius, spacing, usePalette } from '../theme';
import { Button, HardShadow, Title, Txt } from './ui';

/**
 * Un consejo por pantalla, la primera vez que se entra. Se descarta y no
 * vuelve, salvo que se pidan de nuevo desde el signo de pregunta.
 */
export function ConsejoDePantalla({
  pantalla,
}: {
  pantalla: Pantalla;
}): React.ReactElement | null {
  const p = usePalette();
  const { consejosVistos, descartarConsejo } = useMessages();
  const consejo = siguienteConsejo(pantalla, consejosVistos);

  if (!consejo) return null;

  return (
    <HardShadow
      size="sm"
      corner={radius.md}
      style={{ marginTop: spacing(2), marginBottom: spacing(1) }}
    >
      <View
        style={{
          backgroundColor: p.accentSoft,
          borderColor: p.border,
          borderWidth: BORDER_WIDTH,
          borderRadius: radius.md,
          padding: spacing(2),
        }}
      >
        <Txt style={{ color: p.ink, fontSize: 16, fontWeight: '700' }}>
          {consejo.titulo}
        </Txt>
        <Txt
          style={{
            color: p.ink,
            fontSize: 15,
            lineHeight: 21,
            marginTop: spacing(0.5),
          }}
        >
          {consejo.texto}
        </Txt>
        <Pressable
          accessibilityRole="button"
          onPress={() => void descartarConsejo(consejo.id)}
          style={{ alignSelf: 'flex-start', marginTop: spacing(1.25) }}
          hitSlop={8}
        >
          <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
            Entendido
          </Txt>
        </Pressable>
      </View>
    </HardShadow>
  );
}

/** Aviso de versión nueva. Lleva a la publicación; bajar e instalar es manual. */
export function AvisoDeVersion({
  publicacion,
}: {
  publicacion: Publicacion;
}): React.ReactElement {
  const p = usePalette();
  return (
    <HardShadow size="sm" corner={radius.md} style={{ marginTop: spacing(2) }}>
      <View
        accessibilityRole="alert"
        style={{
          backgroundColor: p.warningSoft,
          borderColor: p.border,
          borderWidth: BORDER_WIDTH,
          borderRadius: radius.md,
          padding: spacing(2),
        }}
      >
        <Txt style={{ color: p.ink, fontSize: 16, fontWeight: '700' }}>
          Hay una versión nueva
        </Txt>
        <Txt
          style={{
            color: p.ink,
            fontSize: 15,
            lineHeight: 21,
            marginTop: spacing(0.5),
          }}
        >
          Se baja e instala encima de esta. No perdés los mensajes que tenés
          programados.
        </Txt>
        <Button
          label="Bajar la versión nueva"
          variant="secondary"
          onPress={() => void Linking.openURL(publicacion.url)}
          style={{ marginTop: spacing(1.5) }}
        />
      </View>
    </HardShadow>
  );
}

/** El signo de pregunta que abre la ayuda. */
export function BotonAyuda({
  onPress,
}: {
  onPress: () => void;
}): React.ReactElement {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Ayuda"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        width: 38,
        height: 38,
        borderRadius: radius.pill,
        borderWidth: BORDER_WIDTH,
        borderColor: p.border,
        backgroundColor: p.surface,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Txt style={{ color: p.ink, fontSize: 18, fontWeight: '700' }}>?</Txt>
    </Pressable>
  );
}

export function HojaDeAyuda({
  visible,
  onCerrar,
}: {
  visible: boolean;
  onCerrar: () => void;
}): React.ReactElement {
  const p = usePalette();
  const { reiniciarTutorial, reiniciarConsejos, compiladaEn } = useMessages();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCerrar}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={onCerrar}
        style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}
      >
        <Pressable
          onPress={() => {}}
          style={{
            backgroundColor: p.surface,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
            padding: spacing(3),
            gap: spacing(1.5),
          }}
        >
          <Title style={{ fontSize: 22, lineHeight: 28 }}>¿Te damos una mano?</Title>

          <Button
            label="Ver el tutorial de nuevo"
            onPress={() => {
              onCerrar();
              void reiniciarTutorial();
            }}
          />
          <Button
            label="Mostrar los consejos otra vez"
            variant="secondary"
            onPress={() => {
              onCerrar();
              void reiniciarConsejos();
            }}
          />
          <Txt
            style={{
              color: p.textMuted,
              fontSize: 13,
              textAlign: 'center',
              marginTop: spacing(0.5),
            }}
          >
            {describirVersion(compiladaEn)}
          </Txt>
          <Button label="Cerrar" variant="ghost" onPress={onCerrar} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
