import { db } from './db';

/** Minúsculas, sin acentos, sin signos: "Acuña" y "acuna" son la misma palabra. */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

function palabras(texto: string): string[] {
  return normalizar(texto)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Cada palabra de cada nombre y apellido, normalizada. Son todos los alumnos y
 * no sólo los de una materia: un texto puede mencionar a cualquiera.
 */
export async function indiceDeNombres(): Promise<Set<string>> {
  const alumnos = await db.alumnos.toArray();
  const indice = new Set<string>();
  for (const alumno of alumnos) {
    for (const palabra of palabras(`${alumno.nombre} ${alumno.apellido}`)) {
      indice.add(palabra);
    }
  }
  return indice;
}

/**
 * Coincidencia por palabra completa, nunca por subcadena: si no, "Ana" haría
 * saltar a "manana" y el texto quedaría irreconocible.
 */
export function contieneNombreConocido(texto: string, indice: Set<string>): boolean {
  return palabras(texto).some((palabra) => indice.has(palabra));
}
