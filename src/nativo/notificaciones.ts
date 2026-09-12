// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { LocalNotifications } from '@capacitor/local-notifications';

import { textoDelAviso, type Aviso } from '../agenda/aviso';
import { esNativa } from './plataforma';

/**
 * Recordatorios locales: los programa el teléfono y suenan en el teléfono. No
 * hay servidor, no hay push, no sale nada.
 *
 * `programar` recibe un **caso**, no un texto. Así no hay forma de que el
 * título que escribió la docente termine en la pantalla bloqueada: la función
 * que arma el texto no lo recibe.
 */

export function hayNotificaciones(): boolean {
  return esNativa();
}

export async function tenemosPermiso(): Promise<boolean> {
  if (!hayNotificaciones()) return false;
  const { display } = await LocalNotifications.checkPermissions();
  return display === 'granted';
}

export async function pedirPermiso(): Promise<boolean> {
  if (!hayNotificaciones()) return false;
  const { display } = await LocalNotifications.requestPermissions();
  return display === 'granted';
}

/**
 * Sin `allowWhileIdle` y sin pedir la alarma exacta de Android: el recordatorio
 * puede llegar unos minutos más tarde, y a cambio la docente no tiene que ir a
 * una pantalla de ajustes del sistema a dar un permiso especial.
 */
export async function programar(
  idNotificacion: number,
  aviso: Aviso,
  cuando: Date,
): Promise<void> {
  if (!hayNotificaciones()) return;
  const { titulo, cuerpo } = textoDelAviso(aviso);
  await LocalNotifications.schedule({
    notifications: [
      { id: idNotificacion, title: titulo, body: cuerpo, schedule: { at: cuando } },
    ],
  });
}

export async function cancelar(idNotificacion: number): Promise<void> {
  if (!hayNotificaciones()) return;
  await LocalNotifications.cancel({ notifications: [{ id: idNotificacion }] });
}

/** Los ids que el sistema tiene programados ahora mismo. */
export async function programadas(): Promise<number[]> {
  if (!hayNotificaciones()) return [];
  const { notifications } = await LocalNotifications.getPending();
  return notifications.map((n) => n.id);
}
