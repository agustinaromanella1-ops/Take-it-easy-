import type { Escala, Id } from './tipos';

/**
 * Lo que se puede decir de una escala sin tocar la base. Vive aparte porque lo
 * usan la capa de datos —para rechazar una nota que no entra— y las pantallas
 * —para mostrarla—, y tienen que coincidir.
 */

export const NUMERICA_1_10: Escala = { tipo: 'numerica', min: 1, max: 10, decimales: 2 };

/** La más común en secundaria: cuatro escalones, sin nota numérica. */
export const CONCEPTUAL_COMUN: Escala = {
  tipo: 'conceptual',
  etiquetas: [
    { id: 'ns', texto: 'No satisfactorio' },
    { id: 's', texto: 'Satisfactorio' },
    { id: 'b', texto: 'Bueno' },
    { id: 'mb', texto: 'Muy bueno' },
  ],
};

/**
 * Aprobado o desaprobado, sin puntos medios. Es la que se usa para cerrar una
 * instancia: diciembre, febrero, un recuperatorio.
 *
 * Va aparte de la conceptual común y no sumada a sus cuatro escalones, porque
 * son dos sistemas distintos. Mezclarlas daría seis botones por alumno —tres
 * renglones en un teléfono, por veintiocho alumnos— y haría que «Cómo quedó el
 * curso» contara juntos «Bueno» y «Aprobado», que no son comparables.
 */
export const APROBADO_DESAPROBADO: Escala = {
  tipo: 'conceptual',
  etiquetas: [
    { id: 'des', texto: 'Desaprobado' },
    { id: 'apr', texto: 'Aprobado' },
  ],
};

/**
 * Si dos escalas son la misma.
 *
 * Hace falta desde que hay más de una conceptual: comparar por `tipo` marcaría
 * las dos como elegidas a la vez en el formulario.
 */
export function esLaMismaEscala(a: Escala, b: Escala): boolean {
  if (a.tipo === 'numerica') {
    return b.tipo === 'numerica' && a.min === b.min && a.max === b.max;
  }
  if (b.tipo !== 'conceptual') return false;
  return (
    a.etiquetas.length === b.etiquetas.length &&
    a.etiquetas.every((e, i) => e.id === b.etiquetas[i].id)
  );
}

/**
 * Si un valor entra en la escala. En las conceptuales el valor es el **id** de
 * la etiqueta y no su texto: renombrar "MB" a "Muy bueno" no puede dejar
 * huérfanas las notas ya cargadas.
 */
export function cabeEnLaEscala(escala: Escala, valor: number | Id): boolean {
  if (escala.tipo === 'conceptual') {
    return typeof valor === 'string' && escala.etiquetas.some((e) => e.id === valor);
  }
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= escala.min && valor <= escala.max;
}

/** Cómo se escribe una nota en pantalla. */
export function comoSeEscribe(escala: Escala, valor: number | Id): string {
  if (escala.tipo === 'conceptual') {
    return escala.etiquetas.find((e) => e.id === valor)?.texto ?? '—';
  }
  if (typeof valor !== 'number') return '—';
  // Sin decimales de adorno: un 7 se escribe "7", no "7,00".
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(escala.decimales).replace(/0+$/, '');
}

export function comoSeLlamaLaEscala(escala: Escala): string {
  return escala.tipo === 'numerica'
    ? `Numérica, de ${escala.min} a ${escala.max}`
    : escala.etiquetas.map((e) => e.texto).join(' · ');
}

/**
 * Lo que la docente escribe en el teclado, convertido a nota. Acepta la coma
 * decimal, que es la que tiene el teclado en español y la que se usa acá.
 */
export function leerNumero(escrito: string): number | null {
  const limpio = escrito.trim().replace(',', '.');
  if (limpio === '') return null;
  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : null;
}
