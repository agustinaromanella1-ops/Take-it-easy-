import React from 'react';
import { Linking, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMessages } from '../state/MessagesContext';
import { spacing, usePalette } from '../theme';
import { Button, Card, Label } from '../components/ui';

function Row({
  title,
  value,
}: {
  title: string;
  value: string;
}): React.ReactElement {
  const p = usePalette();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: spacing(1),
        gap: spacing(2),
      }}
    >
      <Text style={{ color: p.textMuted, fontSize: 15 }}>{title}</Text>
      <Text
        style={{ color: p.text, fontSize: 15, fontWeight: '600', flexShrink: 1 }}
      >
        {value}
      </Text>
    </View>
  );
}

const PERMISSION_LABEL = {
  granted: 'Activadas',
  denied: 'Bloqueadas',
  undetermined: 'Sin decidir',
} as const;

export function SettingsScreen(): React.ReactElement {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const { timezone, permission, ensurePermission, pending, drafts, history } =
    useMessages();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{
        padding: spacing(2),
        paddingBottom: insets.bottom + spacing(4),
        gap: spacing(3),
      }}
    >
      <Text style={{ color: p.text, fontSize: 30, fontWeight: '800' }}>
        Ajustes
      </Text>

      <View>
        <Label>Notificaciones</Label>
        <Card>
          <Row title="Estado" value={PERMISSION_LABEL[permission]} />
          <Text
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1),
            }}
          >
            Son la única forma que tiene la app de avisarte cuando llega el
            momento de mandar un mensaje.
          </Text>
          {permission !== 'granted' ? (
            <Button
              label={
                permission === 'denied'
                  ? 'Abrir ajustes del sistema'
                  : 'Activar notificaciones'
              }
              variant="secondary"
              onPress={
                permission === 'denied'
                  ? () => void Linking.openSettings()
                  : () => void ensurePermission()
              }
              style={{ marginTop: spacing(1.5) }}
            />
          ) : null}
        </Card>
      </View>

      <View>
        <Label>Fecha y hora</Label>
        <Card>
          <Row title="Zona horaria" value={timezone} />
          <Row title="Formato" value="24 horas" />
          <Text
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1),
            }}
          >
            Guardamos el día y la hora que elegiste, no un instante fijo. Si
            cambia el horario de verano, tu mensaje de las 9 sigue saliendo a las
            9.
          </Text>
        </Card>
      </View>

      <View>
        <Label>Tus datos</Label>
        <Card>
          <Row title="Programados" value={String(pending.length)} />
          <Row title="Borradores" value={String(drafts.length)} />
          <Row title="En el historial" value={String(history.length)} />
          <Text
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1),
            }}
          >
            Todo vive en este teléfono. No hay servidor, no hay cuenta, no hay
            analytics: ni el texto de los mensajes ni tus contactos salen del
            dispositivo. La app funciona sin internet.
          </Text>
        </Card>
      </View>

      <View>
        <Label>Cómo funciona el envío</Label>
        <Card>
          <Text style={{ color: p.text, fontSize: 15, lineHeight: 21 }}>
            WhatsApp no permite que otra app mande mensajes por vos. Lo que
            hacemos es dejártelo listo: a la hora que elegiste te avisamos, se
            abre el chat con el texto ya escrito y vos tocás enviar.
          </Text>
        </Card>
      </View>
    </ScrollView>
  );
}
