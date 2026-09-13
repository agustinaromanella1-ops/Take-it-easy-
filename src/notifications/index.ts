import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { displayName } from '../domain/phone';
import { previewLines } from '../domain/grouping';
import type { ScheduledMessage } from '../domain/types';

export const CATEGORY_ID = 'scheduled-message';
export const ACTION_OPEN = 'open-whatsapp';
export const ACTION_SNOOZE = 'snooze-1h';
const CHANNEL_ID = 'scheduled-messages';

/** Cuando la app está abierta, igual queremos ver el aviso. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function configure(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Mensajes programados',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility:
        Notifications.AndroidNotificationVisibility.PRIVATE,
    });
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
      ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date,
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
