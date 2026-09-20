import { registerSW } from 'virtual:pwa-register';

/**
 * Registra el service worker que hace que la app funcione sin conexión, y
 * avisa cuando hay una versión nueva lista.
 *
 * Antes esto intentaba ser astuto: aplicaba la versión nueva sola, pero solo
 * cuando la app pasaba a segundo plano. La idea era no interrumpir a nadie en
 * medio de cargar una sesión. El problema es que nadie puede adivinar esa
 * regla: si no salías y volvías de la app, te quedabas en la versión vieja sin
 * ninguna señal de que había otra. Actualizar tiene que ser algo que se ve y
 * se decide, no algo que pasa solo si hacés el gesto correcto.
 *
 * Registrarlo no alcanza para que el aviso llegue. El navegador busca una
 * versión nueva del service worker cuando se NAVEGA a la página, y como mucho
 * una vez por día. Una app instalada casi no navega: se abre, se manda a
 * segundo plano y se vuelve a traer, sin recargar nunca. Así el aviso podía
 * tardar un día entero en aparecer, o no aparecer. Por eso acá se le pide al
 * navegador que busque cada vez que la app vuelve a la pantalla, y cada tanto
 * mientras está abierta.
 */
type Aviso = (aplicar: () => void) => void;

let avisar: Aviso | null = null;
let pendiente: (() => void) | null = null;
let registro: ServiceWorkerRegistration | null = null;

/** Cada cuánto se busca sola una versión nueva con la app abierta. */
const CADA_MS = 60 * 60 * 1000;
/** Piso entre dos búsquedas, para no pedir el archivo en cada parpadeo. */
const MINIMO_MS = 60 * 1000;

/** Para que la interfaz se entere de que hay una versión nueva. */
export function alHaberVersionNueva(cb: Aviso): void {
  avisar = cb;
  // Si la versión nueva ya había llegado antes de que la interfaz escuchara,
  // no se pierde el aviso.
  if (pendiente) cb(pendiente);
}

/**
 * Busca una versión nueva ahora mismo. Lo usa el botón de Ajustes, para que
 * "¿estoy actualizada?" se pueda responder tocando algo en vez de esperando.
 *
 * `'nueva'` significa que hay una bajando o lista: la barra va a aparecer sola
 * cuando termine.
 */
export async function buscarVersionNueva(): Promise<'nueva' | 'al-dia' | 'sin-soporte'> {
  if (pendiente) return 'nueva';
  if (!registro) return 'sin-soporte';
  try {
    await registro.update();
  } catch {
    return 'sin-soporte';
  }
  return registro.installing || registro.waiting ? 'nueva' : 'al-dia';
}

/**
 * Cuánto se espera cuando la pestaña NUNCA estuvo controlada por un service
 * worker. Ahí no hay nada viejo que se pueda servir, así que recargar rápido
 * es seguro.
 */
const ESPERA_SIN_CONTROL_MS = 3000;

/**
 * La red de último recurso cuando sí hay un service worker al mando.
 *
 * Es larga a propósito: lo que se espera es que el nuevo termine de activarse,
 * y eso puede tardar —al activarse borra la caché anterior, que son casi 900
 * KB—. Es solo para que el botón no quede mudo si algo se traba.
 */
const ESPERA_CON_CONTROL_MS = 30000;

export function setupPWA(): void {
  if (!('serviceWorker' in navigator)) return;

  /**
   * Lo que hace el botón "Actualizar".
   *
   * `updateSW(true)` le pide al service worker nuevo que tome el control, y la
   * librería recarga cuando lo toma. Hay dos casos y NO se resuelven igual:
   *
   * **Sin controlador** —primera visita, y también la primera vez que se abre
   * la app instalada—: ese aviso no llega nunca, porque no hay cambio de
   * controlador que avisar, y el botón se quedaba sin hacer nada. Acá recargar
   * por las nuestras es seguro: la página vino de la red, no hay ningún
   * service worker sirviendo una copia vieja.
   *
   * **Con controlador**: recargar a ciegas es peligroso. Si el nuevo todavía
   * no terminó de activarse, el viejo sigue al mando y sirve su copia
   * precacheada: la app vuelve a arrancar en la versión vieja, y como ya no
   * queda ningún worker esperando, la barra no vuelve a aparecer. Quedaría
   * clavada hasta la próxima publicación. Por eso acá no se cuenta el tiempo:
   * se espera a que el worker nuevo llegue a `activated`, que es el momento
   * exacto en que recargar sirve.
   */
  const aplicar = () => {
    void updateSW(true);

    if (!navigator.serviceWorker.controller) {
      window.setTimeout(() => window.location.reload(), ESPERA_SIN_CONTROL_MS);
      return;
    }

    const entrante = registro?.waiting ?? registro?.installing ?? null;
    if (entrante) {
      entrante.addEventListener('statechange', () => {
        if (entrante.state === 'activated') window.location.reload();
      });
    }
    // Red de último recurso, para que el botón nunca quede mudo. Si la recarga
    // de arriba llega primero, este temporizador se muere con la página.
    window.setTimeout(() => window.location.reload(), ESPERA_CON_CONTROL_MS);
  };

  const updateSW = registerSW({
    onNeedRefresh() {
      pendiente = aplicar;
      avisar?.(aplicar);
    },
    onRegisteredSW(_url, r) {
      if (!r) return;
      registro = r;

      // Recién registrado: el archivo se acaba de pedir, no hay por qué
      // volver a pedirlo enseguida.
      let ultima = Date.now();
      const revisar = () => {
        if (document.visibilityState !== 'visible') return;
        if (Date.now() - ultima < MINIMO_MS) return;
        ultima = Date.now();
        void r.update().catch(() => {
          /* Sin internet no hay nada que buscar; se reintenta la próxima. */
        });
      };

      document.addEventListener('visibilitychange', revisar);
      window.addEventListener('focus', revisar);
      window.setInterval(revisar, CADA_MS);
    },
  });
}
