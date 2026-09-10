import { useCallback, useEffect, useState } from 'react';

import { borrarBorrador, guardarBorrador, leerBorrador } from '../datos/borradores';

const ESPERA_MS = 400;

/**
 * Guarda lo escrito a medias y lo devuelve al volver a la pantalla. El botón
 * atrás guarda, no descarta, y eso tiene que valer también cuando Android mata
 * la app en segundo plano: por eso el borrador va a IndexedDB y no a memoria.
 *
 * Un borrador vacío se borra en vez de escribirse, así visitar un formulario
 * limpio no deja una fila muerta por cada pantalla.
 */
export function useBorrador<T>(clave: string, inicial: T) {
  const [valor, setValor] = useState<T>(inicial);
  const [inicialSerializado] = useState(() => JSON.stringify(inicial));
  const [cargada, setCargada] = useState<string | null>(null);

  // Mientras no terminó de leer esta clave, escribir pisaría el borrador
  // guardado con el valor inicial.
  const listo = cargada === clave;

  useEffect(() => {
    let vigente = true;
    leerBorrador<T>(clave).then((guardado) => {
      if (!vigente) return;
      setValor(guardado ?? (JSON.parse(inicialSerializado) as T));
      setCargada(clave);
    });
    return () => {
      vigente = false;
    };
  }, [clave, inicialSerializado]);

  const vacio = JSON.stringify(valor) === inicialSerializado;

  useEffect(() => {
    if (!listo) return;
    const temporizador = setTimeout(() => {
      void (vacio ? borrarBorrador(clave) : guardarBorrador(clave, valor));
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [clave, valor, vacio, listo]);

  const limpiar = useCallback(() => {
    setValor(JSON.parse(inicialSerializado) as T);
    void borrarBorrador(clave);
  }, [clave, inicialSerializado]);

  return { valor, setValor, limpiar, listo };
}
