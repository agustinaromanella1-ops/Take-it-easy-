import React, { useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackupError } from '../domain/backup';
import { describeQuietHours } from '../domain/quietHours';
import { useMessages } from '../state/MessagesContext';
import { spacing, usePalette } from '../theme';
import { Button, Card, Chip, Label } from '../components/ui';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const HOUR_CHOICES = [6, 7, 8, 9, 10, 11, 12];
const END_HOUR_CHOICES = [18, 19, 20, 21, 22, 23];

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
  const navigation = useNavigation<Nav>();
  const {
    timezone,
    permission,
    ensurePermission,
    pending,
    drafts,
    history,
    templates,
    quietHours,
    updateQuietHours,
    exportBackup,
    importBackup,
  } = useMessages();
  const [busy, setBusy] = useState(false);

  const runImport = async () => {
    setBusy(true);
    try {
      const result = await importBackup();
      if (!result) return;
      Alert.alert(
        'Backup importado',
        `Se agregaron ${result.messages} mensajes y ${result.templates} plantillas.`,
      );
    } catch (error) {
      Alert.alert(
        'No pudimos importar',
        error instanceof BackupError
          ? error.message
          : 'El archivo no se pudo leer.',
      );
    } finally {
      setBusy(false);
    }
  };

  const runExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
    } catch {
      Alert.alert('No pudimos exportar', 'Probá de nuevo en un momento.');
    } finally {
      setBusy(false);
    }
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
        <Label>Horario permitido</Label>
        <Card>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing(2),
            }}
          >
            <Text style={{ color: p.text, fontSize: 15, flex: 1 }}>
              {describeQuietHours(quietHours)}
            </Text>
            <Switch
              value={quietHours.enabled}
              onValueChange={(enabled) =>
                void updateQuietHours({ ...quietHours, enabled })
              }
              accessibilityLabel="Activar horario permitido"
            />
          </View>

          {quietHours.enabled ? (
            <View style={{ marginTop: spacing(1.5), gap: spacing(1) }}>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>Desde</Text>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}
              >
                {HOUR_CHOICES.map((hour) => (
                  <Chip
                    key={hour}
                    label={`${hour}:00`}
                    selected={quietHours.startHour === hour}
                    onPress={() =>
                      void updateQuietHours({ ...quietHours, startHour: hour })
                    }
                  />
                ))}
              </View>
              <Text style={{ color: p.textMuted, fontSize: 13 }}>Hasta</Text>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}
              >
                {END_HOUR_CHOICES.map((hour) => (
                  <Chip
                    key={hour}
                    label={`${hour}:00`}
                    selected={quietHours.endHour === hour}
                    onPress={() =>
                      void updateQuietHours({ ...quietHours, endHour: hour })
                    }
                  />
                ))}
              </View>
            </View>
          ) : null}

          <Text
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1.5),
            }}
          >
            No bloquea nada: si elegís una hora fuera de la franja, te propone la
            siguiente válida y vos decidís.
          </Text>
        </Card>
      </View>

      <View>
        <Label>Plantillas</Label>
        <Card>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Templates')}
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ color: p.text, fontSize: 15 }}>
              {templates.length === 1
                ? '1 plantilla guardada'
                : `${templates.length} plantillas guardadas`}
            </Text>
            <Text style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              Ver
            </Text>
          </Pressable>
        </Card>
      </View>

      <View>
        <Label>Backup</Label>
        <Card>
          <Text style={{ color: p.textMuted, fontSize: 14, lineHeight: 20 }}>
            Un archivo con tus mensajes y plantillas. Elegís vos dónde guardarlo:
            no se sube a ningún lado.
          </Text>
          <Button
            label="Exportar backup"
            variant="secondary"
            disabled={busy}
            onPress={() => void runExport()}
            style={{ marginTop: spacing(1.5) }}
          />
          <Button
            label="Importar backup"
            variant="secondary"
            disabled={busy}
            onPress={() => void runImport()}
            style={{ marginTop: spacing(1) }}
          />
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
