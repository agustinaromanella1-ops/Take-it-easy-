import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BackupError } from '../domain/backup';
import { describeQuietHours } from '../domain/quietHours';
import { describeReliability } from '../domain/reliability';
import { AndroidReliabilityActions } from '../components/Reliability';
import { ConsejoDePantalla } from '../components/Ayuda';
import { describirVersion } from '../domain/actualizacion';
import { NOMBRES, puedeElegirApp } from '../share/whatsapp';
import { useMessages } from '../state/MessagesContext';
import { spacing, usePalette } from '../theme';
import { Button, Card, Chip, Label, Title, Txt } from '../components/ui';
import {
  THEME_LABELS,
  THEME_OPTIONS,
  useThemePreference,
} from '../theme';
import { Platform } from 'react-native';
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
      <Txt style={{ color: p.textMuted, fontSize: 15 }}>{title}</Txt>
      <Txt
        style={{ color: p.text, fontSize: 15, fontWeight: '600', flexShrink: 1 }}
      >
        {value}
      </Txt>
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
    reliability,
    osScheduled,
    awaitingNotification,
    checkScheduled,
    testNotification,
    updateTheme,
    compiladaEn,
    publicacion,
    hayVersionNueva,
    buscandoVersion,
    buscarVersion,
    appWhatsApp,
    updateAppWhatsApp,
  } = useMessages();
  const tema = useThemePreference();
  const [busy, setBusy] = useState(false);

  // Ajustes es una pestaña y queda montada, así que un useEffect correría una
  // sola vez en toda la sesión. El número del sistema cambia solo —un aviso
  // que sonó, uno que el teléfono descartó—, por eso se relee cada vez que la
  // pestaña vuelve al frente.
  useFocusEffect(
    useCallback(() => {
      void checkScheduled();
    }, [checkScheduled]),
  );

  const lanzarPrueba = async () => {
    try {
      const permiso = await testNotification(30);
      if (permiso !== 'granted') {
        Alert.alert(
          'Faltan los permisos',
          'Sin permiso de notificaciones no podemos avisarte de nada. Activalo y volvé a probar.',
        );
        return;
      }
      Alert.alert(
        'Aviso de prueba agendado',
        'Cerrá la app del todo ahora y esperá 30 segundos. Si el aviso llega, los avisos funcionan y el problema está en otro lado.',
      );
    } catch {
      Alert.alert('No pudimos agendar la prueba', 'Probá de nuevo en un momento.');
    }
  };

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
      style={{ flex: 1, backgroundColor: 'transparent' }}
      contentContainerStyle={{
        padding: spacing(2),
        paddingBottom: insets.bottom + spacing(4),
        gap: spacing(3),
      }}
    >
      <Title>Ajustes</Title>

      <ConsejoDePantalla pantalla="ajustes" />

      <View>
        <Label>Versión</Label>
        <Card>
          <Txt style={{ color: p.text, fontSize: 15, lineHeight: 21 }}>
            {describirVersion(compiladaEn)}
          </Txt>
          <Txt
            style={{
              color: hayVersionNueva ? p.warning : p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(0.5),
            }}
          >
            {hayVersionNueva
              ? 'Hay una versión nueva para bajar.'
              : publicacion
                ? 'Estás al día.'
                : 'No pudimos consultar si hay una versión nueva.'}
          </Txt>
          {hayVersionNueva && publicacion ? (
            <Button
              label="Bajar la versión nueva"
              onPress={() => void Linking.openURL(publicacion.url)}
              style={{ marginTop: spacing(1.5) }}
            />
          ) : (
            <Button
              label={buscandoVersion ? 'Buscando…' : 'Buscar actualizaciones'}
              variant="secondary"
              disabled={buscandoVersion}
              onPress={() => void buscarVersion()}
              style={{ marginTop: spacing(1.5) }}
            />
          )}
          <Txt
            style={{
              color: p.textMuted,
              fontSize: 13,
              lineHeight: 19,
              marginTop: spacing(1),
            }}
          >
            Es la única vez que la app usa internet: consulta si el archivo
            publicado es más nuevo que el que tenés. No manda nada tuyo.
          </Txt>
        </Card>
      </View>

      <View>
        <Label>Notificaciones</Label>
        <Card>
          <Row title="Estado" value={PERMISSION_LABEL[permission]} />
          <Txt
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1),
            }}
          >
            Son la única forma que tiene la app de avisarte cuando llega el
            momento de mandar un mensaje.
          </Txt>
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
          <Txt
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
          </Txt>
        </Card>
      </View>

      <View>
        <Label>Desde qué WhatsApp</Label>
        <Card>
          {puedeElegirApp() ? (
            <>
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}
              >
                {(['normal', 'business', 'preguntar'] as const).map((opcion) => (
                  <Chip
                    key={opcion}
                    label={
                      opcion === 'preguntar'
                        ? 'Preguntar cada vez'
                        : NOMBRES[opcion]
                    }
                    selected={appWhatsApp === opcion}
                    onPress={() => void updateAppWhatsApp(opcion)}
                  />
                ))}
              </View>
              <Txt
                style={{
                  color: p.textMuted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginTop: spacing(1.5),
                }}
              >
                Cada mensaje puede usar otra distinta: se elige al escribirlo.
                Esto es lo que se usa cuando el mensaje no lo dice.
              </Txt>
            </>
          ) : (
            <Txt style={{ color: p.textMuted, fontSize: 14, lineHeight: 20 }}>
              En iPhone no se puede elegir: las dos apps se anuncian igual ante
              el sistema y abre la que él decida. En Android sí se puede.
            </Txt>
          )}
        </Card>
      </View>

      <View>
        <Label>Cómo se ve</Label>
        <Card>
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1) }}
          >
            {THEME_OPTIONS.map((opcion) => (
              <Chip
                key={opcion}
                label={THEME_LABELS[opcion]}
                selected={tema === opcion}
                onPress={() => void updateTheme(opcion)}
              />
            ))}
          </View>
          <Txt
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1.5),
            }}
          >
            En automático manda el teléfono, que es lo que querés si se pone
            oscuro al atardecer.
          </Txt>
        </Card>
      </View>

      <View>
        <Label>Puntualidad de los avisos</Label>
        <Card>
          <Txt style={{ color: p.text, fontSize: 15, lineHeight: 21 }}>
            {describeReliability(reliability)}
          </Txt>

          <View style={{ marginTop: spacing(1.5) }}>
            <Row
              title="Avisos que deberían estar agendados"
              value={String(awaitingNotification)}
            />
            <Row
              title="Avisos agendados en el sistema"
              value={osScheduled === null ? '—' : String(osScheduled)}
            />
          </View>

          {osScheduled !== null && osScheduled < awaitingNotification ? (
            <Txt
              style={{
                color: p.warning,
                fontSize: 14,
                lineHeight: 20,
                marginTop: spacing(1),
              }}
            >
              El sistema tiene agendados menos avisos de los que corresponden.
              {Platform.OS === 'android'
                ? ' Suele pasar cuando el teléfono cierra la app para ahorrar batería; los dos ajustes de abajo lo resuelven.'
                : ' Revisá que la app pueda avisarte incluso en modo concentración.'}
            </Txt>
          ) : null}

          <Button
            label="Probar con la app cerrada"
            variant="secondary"
            onPress={() => void lanzarPrueba()}
            style={{ marginTop: spacing(1.5) }}
          />
          {Platform.OS === 'android' ? (
            <>
              <Txt
                style={{
                  color: p.textMuted,
                  fontSize: 14,
                  lineHeight: 20,
                  marginTop: spacing(1),
                }}
              >
                Android puede demorar los avisos para ahorrar batería, sobre todo
                en Xiaomi, Samsung, Huawei y Oppo. Estos dos ajustes son los que
                hacen la diferencia.
              </Txt>
              <View style={{ marginTop: spacing(1.5) }}>
                <AndroidReliabilityActions />
              </View>
            </>
          ) : null}
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
            <Txt style={{ color: p.text, fontSize: 15, flex: 1 }}>
              {describeQuietHours(quietHours)}
            </Txt>
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
              <Txt style={{ color: p.textMuted, fontSize: 13 }}>Desde</Txt>
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
              <Txt style={{ color: p.textMuted, fontSize: 13 }}>Hasta</Txt>
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

          <Txt
            style={{
              color: p.textMuted,
              fontSize: 14,
              lineHeight: 20,
              marginTop: spacing(1.5),
            }}
          >
            No bloquea nada: si elegís una hora fuera de la franja, te propone la
            siguiente válida y vos decidís.
          </Txt>
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
            <Txt style={{ color: p.text, fontSize: 15 }}>
              {templates.length === 1
                ? '1 plantilla guardada'
                : `${templates.length} plantillas guardadas`}
            </Txt>
            <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              Ver
            </Txt>
          </Pressable>
        </Card>
      </View>

      <View>
        <Label>Backup</Label>
        <Card>
          <Txt style={{ color: p.textMuted, fontSize: 14, lineHeight: 20 }}>
            Un archivo con tus mensajes y plantillas. Elegís vos dónde guardarlo:
            no se sube a ningún lado.
          </Txt>
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
          <Txt
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
          </Txt>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate('Privacy')}
            style={{ marginTop: spacing(1.5) }}
          >
            <Txt style={{ color: p.accent, fontSize: 15, fontWeight: '700' }}>
              Leer la política de privacidad
            </Txt>
          </Pressable>
        </Card>
      </View>

      <View>
        <Label>Cómo funciona el envío</Label>
        <Card>
          <Txt style={{ color: p.text, fontSize: 15, lineHeight: 21 }}>
            WhatsApp no permite que otra app mande mensajes por vos. Lo que
            hacemos es dejártelo listo: a la hora que elegiste te avisamos, se
            abre el chat con el texto ya escrito y vos tocás enviar.
          </Txt>
        </Card>
      </View>
    </ScrollView>
  );
}
