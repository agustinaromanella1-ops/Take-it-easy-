import { ACCIONES } from './recordatorios';

/**
 * Mandar una notificación al sistema.
 *
 * **Por qué no `new Notification()`.** En Chrome de Android ese constructor
 * directamente tira una excepción: ahí los avisos solo salen por el service
 * worker. El aviso de turno lo usaba con un `catch` vacío, así que en el
 * celular —que es donde se usa la app— no sonaba nunca y no había forma de
 * enterarse. `registration.showNotification()` funciona en los dos lados, y
 * además el aviso queda en la barra de notificaciones hasta que se lo toca,
 * en vez de desaparecer con la pestaña.
 *
 * Lo que se manda acá NO lleva nombres de pacientes. Una notificación se ve en
 * la pantalla bloqueada y queda en el historial del teléfono; ahí ya no la
 * controla la app. Ver `src/lib/aviso.ts`.
 */

export interface Aviso {
  titulo: string;
  cuerpo: string;
  /** Para que dos avisos de lo mismo se reemplacen en vez de apilarse. */
  tag: string;
  /** La sesión sobre la que preguntan los botones. Sin esto no van botones. */
  sesion?: string | null;
}

export function sePuedeAvisar(): boolean {
  return (
    typeof Notification !== 'undefined' &&
    Notification.permission === 'granted' &&
    'serviceWorker' in navigator
  );
}

/**
 * Cuántos botones entran.
 *
 * Android suele dar dos, no cuatro. Con `maxActions` se mandan los que
 * entren, en orden de uso: "Vino" y "Faltó" resuelven casi todo, y los otros
 * dos quedan a un toque —el del cuerpo del aviso, que abre la app con esa
 * sesión lista—. Recortar es mejor que mandar cuatro y que el sistema elija
 * dos al azar.
 */
function botones(): { action: string; title: string }[] {
  // `maxActions` y `actions` no están en los tipos del DOM de TypeScript
  // —son parte de la API del service worker, no la del constructor—, así que
  // se consultan a mano en vez de inventar un `as NotificationOptions` que
  // taparía cualquier otro error del objeto.
  const posible = (Notification as unknown as { maxActions?: number }).maxActions;
  const tope = typeof posible === 'number' ? posible : 2;
  return ACCIONES.slice(0, Math.max(0, tope)).map((a) => ({ action: a.action, title: a.title }));
}

export async function avisar(aviso: Aviso): Promise<boolean> {
  if (!sePuedeAvisar()) return false;
  try {
    const registro = await navigator.serviceWorker.ready;
    await registro.showNotification(aviso.titulo, {
      body: aviso.cuerpo,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: aviso.tag,
      // Sin esto, un aviso con el mismo `tag` reemplaza al anterior en
      // silencio: el segundo recordatorio del día no se notaría.
      renotify: true,
      data: { sesion: aviso.sesion ?? null },
      ...(aviso.sesion ? { actions: botones() } : {}),
    } as NotificationOptions);
    return true;
  } catch {
    // Un aviso es una ayuda, no una función de la que dependa nada: si el
    // navegador no puede, la app sigue igual.
    return false;
  }
}
