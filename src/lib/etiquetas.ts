import type { Session } from '../types';

/**
 * Cómo se llama cada estado de una sesión, en un solo lugar.
 *
 * Estaba escrito tres veces y en la ficha del paciente ni siquiera eso: salía
 * el valor interno en minúscula, "realizada", directo del dato. Que la misma
 * cosa se llame distinto en cada pantalla obliga a traducir mentalmente de una
 * a la otra.
 *
 * El cierre del día usa a propósito otras palabras —"Vino", "Faltó"—: ahí no
 * se está etiquetando una sesión, se está contestando "¿qué pasó?", y en esa
 * pregunta el verbo es más rápido de leer que el adjetivo.
 */
export const ESTADO: Record<Session['status'], string> = {
  programada: 'Programada',
  realizada: 'Realizada',
  ausente: 'Ausente',
  cancelada: 'Cancelada',
};
