import { registerSW } from 'virtual:pwa-register';

/**
 * Registra el service worker que hace que la app funcione sin conexión.
 *
 * `autoUpdate` aplica la versión nueva apenas está lista. Se recarga sola solo
 * si la persona no está en medio de algo: interrumpir la carga de una sesión
 * para actualizar sería peor que esperar al próximo arranque.
 */
export function setupPWA(): void {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      // Se aplica al volver a la app, no mientras se está usando.
      const applyWhenIdle = () => {
        if (document.visibilityState === 'hidden') {
          document.removeEventListener('visibilitychange', applyWhenIdle);
          void updateSW(true);
        }
      };
      document.addEventListener('visibilitychange', applyWhenIdle);
    },
  });
}
