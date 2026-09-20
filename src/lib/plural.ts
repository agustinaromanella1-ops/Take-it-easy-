/**
 * Plurales en castellano, sin paréntesis.
 *
 * "2 sesión(es) realizada(s)" obliga a armar la frase en la cabeza antes de
 * entenderla, y aparecía en nueve lugares al lado de vecinos que ya lo hacían
 * bien. Cuesta dos líneas escribirlo entero.
 */
export function plural(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
