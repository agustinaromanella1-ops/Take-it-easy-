/**
 * Partículas de apellido. No identifican a nadie: "de la Fuente" comparte "de"
 * y "la" con media lengua, así que ni se capitalizan ni entran al índice de
 * nombres conocidos.
 */
export const PARTICULAS = new Set([
  'de', 'del', 'la', 'las', 'lo', 'los', 'y', 'da', 'das', 'di', 'do', 'dos',
  'van', 'von', 'el', 'san', 'santa',
]);

/** Una palabra alcanza para reconocer a un alumno recién con tres letras. */
export const LARGO_MINIMO_DE_NOMBRE = 3;

export function esIdentificatoria(palabra: string): boolean {
  return palabra.length >= LARGO_MINIMO_DE_NOMBRE && !PARTICULAS.has(palabra);
}
