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
 * Cuánto se espera a que el service worker nuevo tome el control antes de
 * recargar por las nuestras.
 */
const ESPERA_RECARGA_MS = 3000;

export function setupPWA(): void {
  if (!('serviceWorker' in navigator)) return;

  /**
   * Lo que hace el botón "Actualizar".
   *
   * `updateSW(true)` le pide al service worker nuevo que tome el control y
   * recarga cuando lo toma. Pero si esta pestaña nunca estuvo controlada por
   * ninguno —pasa en la primera visita, y también la primera vez que se abre
   * la app instalada—, ese aviso no llega nunca y el botón se queda sin hacer
   * nada. Un botón que no hace nada es peor que no tener botón, así que si en
   * unos segundos no pasó, se recarga igual. Si la recarga de la librería
   * llega primero, este temporizador se muere con la página.
   */
  const aplicar = () => {
    void updateSW(true);
    window.setTimeout(() => window.location.reload(), ESPERA_RECARGA_MS);
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
