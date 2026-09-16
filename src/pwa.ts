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
 */
type Aviso = (aplicar: () => void) => void;

let avisar: Aviso | null = null;
let pendiente: (() => void) | null = null;

/** Para que la interfaz se entere de que hay una versión nueva. */
export function alHaberVersionNueva(cb: Aviso): void {
  avisar = cb;
  // Si la versión nueva ya había llegado antes de que la interfaz escuchara,
  // no se pierde el aviso.
  if (pendiente) cb(pendiente);
}

export function setupPWA(): void {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      const aplicar = () => void updateSW(true);
      pendiente = aplicar;
      avisar?.(aplicar);
    },
  });
}
