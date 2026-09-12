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
 * Inexacto a propósito, pero entregado igual. Las dos opciones de abajo no son
 * ajustes finos: sin ellas el aviso no suena.
 *
 * `isExactNotification: false` — la opción viene en `true` por defecto, y con
 * eso el plugin, al ver que la app no puede programar alarmas exactas, abre la
 * pantalla de ajustes «Alarmas y recordatorios» del sistema para que la docente
 * dé el permiso. Como la app lo saca del manifiesto a propósito, esa pantalla
 * aparece con el interruptor gris: es un callejón sin salida que abrimos
 * nosotros. Pidiendo inexacto desde el principio, no hay pantalla que abrir.
 *
 * `allowWhileIdle: true` — sin esto el plugin programa con `AlarmManager.RTC`,
 * que además de inexacto **no despierta al teléfono**, así que Doze lo posterga
 * sin límite: un aviso para las 7:30 en un teléfono guardado no llega. Con esto
 * usa `setAndAllowWhileIdle(RTC_WAKEUP)`, que sí despierta y sí se entrega
 * durante Doze. No hace falta ningún permiso para eso: el permiso especial lo
 * piden las variantes *exactas*, no ésta.
 *
 * El precio es el que la app ya venía prometiendo: Android entrega como mucho
 * uno de estos cada nueve minutos por app, así que puede llegar unos minutos
 * más tarde. Por eso ningún texto promete una hora (1.5).
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
      {
        id: idNotificacion,
        title: titulo,
        body: cuerpo,
        isExactNotification: false,
        schedule: { at: cuando, allowWhileIdle: true },
      },
    ],
  });
}

/**
 * Lo mismo pero ahora, sin alarma de por medio. Sirve para separar dos cosas
 * que se confunden cuando un aviso no llega: que el teléfono no muestre
 * notificaciones de esta app, o que sí las muestre y lo que falle sea la
 * alarma que la despierta más tarde.
 */
export async function mostrarAhora(idNotificacion: number, aviso: Aviso): Promise<void> {
  if (!hayNotificaciones()) return;
  const { titulo, cuerpo } = textoDelAviso(aviso);
  await LocalNotifications.schedule({
    notifications: [{ id: idNotificacion, title: titulo, body: cuerpo }],
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
