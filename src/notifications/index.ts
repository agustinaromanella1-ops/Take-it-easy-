import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { displayName } from '../domain/phone';
import { previewLines } from '../domain/grouping';
import type { ScheduledMessage } from '../domain/types';

export const CATEGORY_ID = 'scheduled-message';
export const ACTION_OPEN = 'open-whatsapp';
export const ACTION_SNOOZE = 'snooze-1h';
import { CANALES, CANAL_VIEJO, type Sonido } from '../domain/sonido';

/**
 * El sonido elegido. Vive acá y no se pasa por parámetro porque scheduleFor
 * se llama desde media docena de lugares y ninguno decide el sonido: lo
 * decide Ajustes, una vez, para toda la app.
 */
let sonidoActivo: Sonido = 'predeterminado';
/** Marca del aviso de prueba, para poder excluirlo de la cuenta. */
const TEST_FLAG = 'esPrueba';

/** Cuando la app está abierta, igual queremos ver el aviso. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configure(sonido: Sonido = 'predeterminado'): Promise<void> {
  sonidoActivo = sonido;

  if (Platform.OS === 'android') {
    // Se crea solo el canal de la opción elegida. Crear los tres dejaría tres
    // entradas en los ajustes del sistema y no se sabría cuál toca.
    await Notifications.setNotificationChannelAsync(CANALES[sonido], {
      name: 'Mensajes programados',
      importance: Notifications.AndroidImportance.HIGH,
      // Sin declararlo, el canal puede quedar mudo: por eso estaba saliendo
      // sin sonido. 'default' es el tono de notificación del teléfono.
      sound: sonido === 'predeterminado' ? 'default' : null,
      vibrationPattern: sonido === 'silencioso' ? undefined : [0, 250, 250, 250],
      enableVibrate: sonido !== 'silencioso',
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PRIVATE,
    });

    // Los canales de las otras opciones y el de la primera versión se borran,
    // para que en los ajustes del sistema quede una sola entrada.
    const sobrantes = [
      CANAL_VIEJO,
      ...Object.entries(CANALES)
        .filter(([clave]) => clave !== sonido)
        .map(([, id]) => id),
    ];
    for (const id of sobrantes) {
      try {
        await Notifications.deleteNotificationChannelAsync(id);
      } catch {
        // No existía: nada que borrar.
      }
    }
  }

  await Notifications.setNotificationCategoryAsync(CATEGORY_ID, [
    {
      identifier: ACTION_OPEN,
      buttonTitle: 'Abrir WhatsApp',
      options: { opensAppToForeground: true },
    },
    {
      identifier: ACTION_SNOOZE,
      buttonTitle: 'Posponer 1 hora',
      options: { opensAppToForeground: false },
    },
  ]);
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function getPermission(): Promise<PermissionState> {
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined' || canAskAgain) return 'undetermined';
  return 'denied';
}

/**
 * Los permisos se piden recién cuando la usuaria programa su primer mensaje,
 * no en el arranque: en ese momento el pedido tiene un porqué evidente.
 */
export async function requestPermission(): Promise<PermissionState> {
  const { status } = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return status === 'granted' ? 'granted' : 'denied';
}

/**
 * Agenda el aviso de un mensaje. Devuelve el id para poder cancelarlo después:
 * sin esto, reprogramar dejaría la notificación vieja viva y llegarían dos.
 */
export async function scheduleFor(
  message: ScheduledMessage,
): Promise<string | null> {
  if (!message.scheduledAt) return null;

  const date = new Date(message.scheduledAt);
  if (date.getTime() <= Date.now()) return null;

  const who = displayName(message.contactName, message.phoneE164);

  return Notifications.scheduleNotificationAsync({
    content: {
      title: `Mensaje para ${who}`,
      body: previewLines(message.body),
      data: { messageId: message.id },
      categoryIdentifier: CATEGORY_ID,
      // En iOS el sonido va por notificación, no por canal. Un booleano
      // alcanza: true es el tono de notificación del teléfono.
      sound: sonidoActivo === 'predeterminado',
    },
    // El canal va en el disparador, no en el contenido. Puesto en el
    // contenido se ignora sin avisar, y el aviso termina en el canal por
    // defecto: sin la importancia alta que configuramos, Android no lo
    // muestra en pantalla y lo puede demorar.
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
      ...(Platform.OS === 'android'
        ? { channelId: CANALES[sonidoActivo] }
        : {}),
    },
  });
}

/**
 * Cuántos avisos tiene agendados el sistema operativo ahora mismo.
 *
 * Es el dato que decide de quién es el problema cuando un mensaje no suena:
 * si la app tiene tres pendientes y el sistema tiene tres agendados, el
 * teléfono los está descartando o demorando. Si tiene cero, el problema es
 * nuestro.
 */
export async function scheduledCount(): Promise<number> {
  const agendados = await Notifications.getAllScheduledNotificationsAsync();
  // El aviso de prueba no cuenta: si no, durante sus 30 segundos infla el
  // número y tapa un faltante real justo mientras se está diagnosticando.
  return agendados.filter(
    (a) => a.content.data?.[TEST_FLAG] !== true,
  ).length;
}

/**
 * Un aviso de prueba, para poder verificar con la app cerrada sin tener que
 * inventar un mensaje de mentira y después borrarlo.
 */
export async function scheduleTest(seconds: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Prueba de aviso',
      body: 'Si estás leyendo esto con la app cerrada, los avisos funcionan.',
      data: { [TEST_FLAG]: true },
      sound: sonidoActivo === 'predeterminado',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: false,
      ...(Platform.OS === 'android'
        ? { channelId: CANALES[sonidoActivo] }
        : {}),
    },
  });
}

export async function cancel(notificationId: string | null): Promise<void> {
  if (!notificationId) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // Ya no existía (se disparó o el sistema la limpió): no hay nada que hacer.
  }
}

export function extractMessageId(
  notification: Notifications.Notification,
): string | null {
  const id = notification.request.content.data?.['messageId'];
  return typeof id === 'string' ? id : null;
}
