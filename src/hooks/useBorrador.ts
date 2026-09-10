import { useCallback, useEffect, useRef, useState } from 'react';

import { borrarBorrador, guardarBorrador, leerBorrador } from '../datos/borradores';

const ESPERA_MS = 400;

/**
 * Guarda lo escrito a medias y lo devuelve al volver a la pantalla. El botón
 * atrás guarda, no descarta, y eso tiene que valer también cuando Android mata
 * la app en segundo plano: por eso el borrador va a IndexedDB y no a memoria.
 *
 * Un borrador vacío se borra en vez de escribirse, así visitar un formulario
 * limpio no deja una fila muerta por pantalla.
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
      // Leer IndexedDB tarda, y en el teclado del teléfono entran varias letras
      // en ese rato: si ya escribió algo, lo escrito gana sobre lo guardado.
      setValor((actual) =>
        JSON.stringify(actual) === inicialSerializado
          ? (guardado ?? (JSON.parse(inicialSerializado) as T))
          : actual,
      );
      setCargada(clave);
    });
    return () => {
      vigente = false;
    };
  }, [clave, inicialSerializado]);

  const vacio = JSON.stringify(valor) === inicialSerializado;

  const pendiente = useRef({ clave, valor, vacio, listo });
  useEffect(() => {
    pendiente.current = { clave, valor, vacio, listo };
  });

  useEffect(() => {
    if (!listo) return;
    const temporizador = setTimeout(() => {
      void (vacio ? borrarBorrador(clave) : guardarBorrador(clave, valor));
    }, ESPERA_MS);
    return () => clearTimeout(temporizador);
  }, [clave, valor, vacio, listo]);

  // Salir de la pantalla cancela el temporizador pendiente. Sin este volcado,
  // lo último que se escribió antes de tocar atrás sería justo lo que se pierde.
  useEffect(
    () => () => {
      const ultimo = pendiente.current;
      if (!ultimo.listo) return;
      void (ultimo.vacio
        ? borrarBorrador(ultimo.clave)
        : guardarBorrador(ultimo.clave, ultimo.valor));
    },
    [],
  );

  const limpiar = useCallback(() => {
    setValor(JSON.parse(inicialSerializado) as T);
    void borrarBorrador(clave);
  }, [clave, inicialSerializado]);

  return { valor, setValor, limpiar, listo };
}
