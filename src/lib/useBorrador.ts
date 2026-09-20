import { useEffect, useState } from 'react';
import { guardarBorrador, leerBorrador, limpiarBorrador, tieneContenido } from './borrador';

/**
 * El borrador de un formulario, con su cartel.
 *
 * Tres formularios necesitan lo mismo —el alta de paciente, el turno y el
 * cobro— y la máquina de estados es idéntica en los tres. Repetirla era
 * garantizar que se desincronizaran: el que se arreglara primero quedaría
 * distinto de los otros dos.
 *
 * El estado es el del cartel:
 * - `'no'`       no hay nada que ofrecer;
 * - `'ofrecido'` hay algo guardado y se está preguntando si retomarlo;
 * - `'recuperado'` se retomó y lo que se ve en pantalla viene del borrador.
 *
 * Mientras está en `'ofrecido'` NO se guarda nada: si se escribe una letra
 * antes de decidir, pisaría lo que el cartel está prometiendo devolver.
 */
export type EstadoBorrador = 'no' | 'ofrecido' | 'recuperado';

/**
 * `hayAlgo` decide si el formulario tiene algo que valga la pena guardar. Por
 * omisión compara los campos de texto contra el formulario en blanco, que es
 * lo que sirve para un formulario común. El cierre del día no tiene campos de
 * texto —son decisiones por sesión— y pasa el suyo.
 *
 * Ojo con `vacio`: tiene que ser estable entre dibujos. Si se arma uno nuevo
 * en cada render, el efecto lo ve cambiar y escribe en localStorage sin que
 * nadie toque una tecla. Ya pasó una vez.
 */
export function useBorrador<T extends object>(
  clave: string,
  vacio: T,
  form: T,
  activo: boolean,
  hayAlgo: (form: T, vacio: T) => boolean = tieneContenido,
) {
  const [estado, setEstado] = useState<EstadoBorrador>('no');

  useEffect(() => {
    if (!activo || estado === 'ofrecido') return;
    if (!hayAlgo(form, vacio)) return;
    guardarBorrador(clave, form);
    // `hayAlgo` puede venir escrita en el JSX y cambiar de identidad en cada
    // dibujo; lo que importa es el contenido del formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, vacio, form, activo, estado]);

  return {
    estado,

    /**
     * Al abrir el formulario: mira si quedó algo de la vez pasada y, si lo hay,
     * lo ofrece. No lo aplica solo —el formulario aparecería lleno sin que
     * nadie lo pidiera—, solo pregunta.
     */
    ofrecerSiHay() {
      const guardado = leerBorrador<T>(clave);
      setEstado(guardado && hayAlgo({ ...vacio, ...guardado }, vacio) ? 'ofrecido' : 'no');
    },

    /** Marca que no hay nada que ofrecer, sin tocar lo guardado. */
    callar() {
      setEstado('no');
    },

    /**
     * Devuelve lo guardado para que el formulario lo aplique, o `null`. Se
     * mezcla con el formulario en blanco: si el borrador viene de una versión
     * vieja y le falta un campo, el campo aparece vacío y no roto.
     */
    retomar(): T | null {
      const guardado = leerBorrador<T>(clave);
      if (!guardado) return null;
      setEstado('recuperado');
      return { ...vacio, ...guardado };
    },

    /** "Empezar de cero": tira el borrador. */
    descartar() {
      limpiarBorrador(clave);
      setEstado('no');
    },

    /** El formulario se guardó de verdad: el borrador ya no hace falta. */
    listo() {
      limpiarBorrador(clave);
      setEstado('no');
    },
  };
}
