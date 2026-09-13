import { leerPreferencia, guardarPreferencia } from './preferencias';

/**
 * Cómo se llama lo que se está evaluando.
 *
 * Es texto libre en la base, así que agregar uno no toca el esquema ni las
 * evaluaciones ya cargadas. Los de acá son los que aparecen sin hacer nada;
 * cualquier otro lo escribe la docente y queda guardado para la próxima.
 */

/**
 * El orden no es alfabético: primero lo que se toma durante el año y después
 * lo que cierra un período. Son dos cosas distintas y se buscan en momentos
 * distintos.
 */
export const TIPOS_DE_FABRICA = [
  'Parcial',
  'Trabajo práctico',
  'Oral',
  'Carpeta',
  'Primer cuatrimestre',
  'Segundo cuatrimestre',
  'Calificación final',
  'Instancia diciembre',
  'Instancia febrero',
];

const CLAVE = 'tipos-propios';

export async function tiposPropios(): Promise<string[]> {
  return (await leerPreferencia<string[]>(CLAVE)) ?? [];
}

/**
 * Guarda uno escrito a mano para que la próxima vez esté a un toque.
 *
 * Sin esto, «a gusto» dura una sola evaluación: al siguiente parcial hay que
 * volver a escribir «Coloquio». Se ignoran los que ya existen, con mayúsculas
 * y acentos comparados como los compara el castellano.
 */
export async function recordarTipo(tipo: string): Promise<string[]> {
  const limpio = tipo.trim();
  if (limpio === '') return tiposPropios();

  const propios = await tiposPropios();
  const yaEsta = [...TIPOS_DE_FABRICA, ...propios].some((t) => seLlamanIgual(t, limpio));
  if (yaEsta) return propios;

  const nuevos = [...propios, limpio];
  await guardarPreferencia(CLAVE, nuevos);
  return nuevos;
}

export async function olvidarTipo(tipo: string): Promise<string[]> {
  const propios = await tiposPropios();
  const nuevos = propios.filter((t) => !seLlamanIgual(t, tipo));
  await guardarPreferencia(CLAVE, nuevos);
  return nuevos;
}

/** «coloquio» y «Coloquio» son el mismo tipo; «Coloquio» y «Colóquio», no. */
export function seLlamanIgual(a: string, b: string): boolean {
  return a.localeCompare(b, 'es', { sensitivity: 'accent' }) === 0;
}

/** Los que se muestran: los de fábrica primero y los propios atrás. */
export function todosLosTipos(propios: string[]): string[] {
  return [...TIPOS_DE_FABRICA, ...propios];
}
