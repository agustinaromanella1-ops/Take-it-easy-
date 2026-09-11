// Las pantallas no llaman plugins de Capacitor directo: pasan por un módulo
// propio por función, para que cambiar de plugin sea tocar un solo archivo.

import { App } from '@capacitor/app';

const dePantalla: (() => boolean)[] = [];

/**
 * Una pantalla con pasos propios registra acá cómo volver a su paso anterior.
 *
 * Sin esto, el botón atrás en un paso interno salta directo a la pila de
 * navegación, y si esa pantalla es una sección —el asistente lo es— no queda
 * a dónde volver y la app se cierra con lo escrito adentro.
 */
export function registrarAtras(manejador: () => boolean): () => void {
  dePantalla.push(manejador);
  return () => {
    const i = dePantalla.indexOf(manejador);
    if (i >= 0) dePantalla.splice(i, 1);
  };
}

/** Del último registrado al primero: la pantalla de más adentro decide primero. */
export function volvioUnaPantalla(): boolean {
  for (let i = dePantalla.length - 1; i >= 0; i -= 1) {
    if (dePantalla[i]()) return true;
  }
  return false;
}

/**
 * `volver` devuelve true si la app se hizo cargo del botón atrás. Si devuelve
 * false —ya no queda a dónde volver— recién ahí se cierra la app.
 *
 * Sin esto, el botón atrás cierra la app desde cualquier pantalla, que es
 * exactamente lo que la regla de "atrás guarda, no descarta" evita.
 */
export function escucharBotonAtras(volver: () => boolean): () => void {
  const pendiente = App.addListener('backButton', () => {
    if (volvioUnaPantalla()) return;
    if (!volver()) App.exitApp();
  });

  return () => {
    void pendiente.then((suscripcion) => suscripcion.remove());
  };
}
