// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { App } from '@capacitor/app';

/**
 * `volver` devuelve true si la app se hizo cargo del botón atrás. Si devuelve
 * false —ya no queda a dónde volver— recién ahí se cierra la app.
 *
 * Sin esto, el botón atrás cierra la app desde cualquier pantalla, que es
 * exactamente lo que la regla de "atrás guarda, no descarta" evita.
 */
export function escucharBotonAtras(volver: () => boolean): () => void {
  const pendiente = App.addListener('backButton', () => {
    if (!volver()) App.exitApp();
  });

  return () => {
    void pendiente.then((suscripcion) => suscripcion.remove());
  };
}
