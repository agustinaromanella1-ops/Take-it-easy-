import { useEffect, useRef } from 'react';

import { registrarAtras } from '../nativo/botonAtras';

/**
 * Qué hace el botón atrás mientras esta pantalla está montada. Devolver false
 * lo deja pasar a la pila de navegación.
 *
 * El manejador se guarda en una referencia porque el registro ocurre una sola
 * vez: leerlo por closure dejaría al botón atrás mirando el estado del montaje
 * y no el de ahora.
 */
export function useAtras(manejador: () => boolean) {
  const actual = useRef(manejador);
  useEffect(() => {
    actual.current = manejador;
  });
  useEffect(() => registrarAtras(() => actual.current()), []);
}
