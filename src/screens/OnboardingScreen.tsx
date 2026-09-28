import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../state/MessagesContext';
import { radius, spacing, usePalette } from '../theme';
import { Button, Title, Txt } from '../components/ui';
import { AndroidReliabilityActions } from '../components/Reliability';

interface Step {
  key: string;
  title: string;
  body: string;
}

/**
 * Lo más importante que tiene que quedar claro en el primer arranque es que la
 * app NO manda el mensaje sola. Si alguien instala esperando envío automático,
 * la app le va a parecer rota. Decirlo de entrada, con todas las letras, es más
 * barato que explicarlo después en las reseñas.
 */
const STEPS: Step[] = [
  {
    key: 'write',
    title: 'Escribilo cuando lo pensás',
    body: 'Ese mensaje que se te ocurre un domingo a la noche pero no es momento de mandar. Escribilo ahora y elegí el día y la hora en que querés que salga.',
  },
  {
    key: 'remind',
    title: 'Te avisamos en el momento justo',
    body: 'Llegada la hora te llega una notificación, con la app cerrada o el teléfono bloqueado. No hace falta que te acuerdes de nada.',
  },
  {
    key: 'send',
    title: 'Lo mandás vos, con un toque',
    body: 'Al tocar el aviso se abre WhatsApp en ese chat con el texto ya escrito. Solo tocás enviar.\n\nWhatsApp no permite que otra app mande mensajes en tu nombre, así que el último paso siempre es tuyo. Esta app no es oficial ni está asociada a WhatsApp.',
  },
];

export function OnboardingScreen(): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { completeOnboarding, ensurePermission } = useMessages();
  const [index, setIndex] = useState(0);

  const isLast = index === STEPS.length - 1;
  const step = STEPS[index];

  const finish = async () => {
    // El permiso se pide acá, al final de la explicación, para que la usuaria
    // ya sepa para qué sirve antes de que aparezca el cartel del sistema.
    await ensurePermission();
    await completeOnboarding();
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: 'transparent',
        paddingTop: insets.top + spacing(4),
        paddingBottom: insets.bottom + spacing(2),
        paddingHorizontal: spacing(3),
      }}
    >
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <Txt
          style={{
            color: p.accent,
            fontSize: 14,
            fontWeight: '800',
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: spacing(1.5),
          }}
        >
          Listo para enviar
        </Txt>
        <Title>{step?.title}</Title>
        <Txt
          style={{
            color: p.textMuted,
            fontSize: 17,
            lineHeight: 25,
            marginTop: spacing(2),
          }}
        >
          {step?.body}
        </Txt>

        {isLast && Platform.OS === 'android' ? (
          <View
            style={{
              marginTop: spacing(3),
              backgroundColor: p.surfaceAlt,
              borderRadius: radius.md,
              padding: spacing(2),
            }}
          >
            <Txt style={{ color: p.text, fontSize: 15, fontWeight: '700' }}>
              Una cosa más, para que los avisos lleguen puntuales
            </Txt>
            <Txt
              style={{
                color: p.textMuted,
                fontSize: 14,
                lineHeight: 20,
                marginTop: spacing(0.5),
              }}
            >
              Android demora los avisos para ahorrar batería. Podés arreglarlo
              ahora o más tarde desde Ajustes.
            </Txt>
            <View style={{ marginTop: spacing(1.5) }}>
              <AndroidReliabilityActions />
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ gap: spacing(1.5) }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: spacing(0.75),
          }}
        >
          {STEPS.map((s, i) => (
            <View
              key={s.key}
              style={{
                width: i === index ? 20 : 7,
                height: 7,
                borderRadius: radius.pill,
                backgroundColor: i === index ? p.accent : p.border,
              }}
            />
          ))}
        </View>

        <Button
          label={isLast ? 'Empezar' : 'Siguiente'}
          onPress={() => {
            if (isLast) void finish();
            else setIndex((i) => i + 1);
          }}
        />

        {!isLast ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void finish()}
            style={{ alignSelf: 'center', padding: spacing(1) }}
          >
            <Txt style={{ color: p.textMuted, fontSize: 15 }}>Saltear</Txt>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
