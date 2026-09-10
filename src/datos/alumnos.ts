import { db, nuevoId } from './db';
import { normalizar } from './nombres';
import type { Alumno, Id } from './tipos';

export interface AlumnoNuevo {
  nombre: string;
  apellido: string;
}

export interface ResultadoAlta {
  creados: Id[];
  /** Los que ya estaban en la base: un alumno existe una sola vez. */
  repetidos: AlumnoNuevo[];
}

function clave(alumno: AlumnoNuevo): string {
  return `${normalizar(alumno.apellido.trim())}|${normalizar(alumno.nombre.trim())}`;
}

/**
 * Un alumno existe una sola vez en la base y se inscribe en varias materias.
 * Pegar dos veces la misma lista no lo duplica.
 */
export async function altaMasiva(nuevos: AlumnoNuevo[]): Promise<ResultadoAlta> {
  return db.transaction('rw', db.alumnos, async () => {
    const existentes = new Set((await db.alumnos.toArray()).map(clave));

    const creados: Id[] = [];
    const repetidos: AlumnoNuevo[] = [];
    const aInsertar: Alumno[] = [];

    for (const nuevo of nuevos) {
      const k = clave(nuevo);
      if (existentes.has(k)) {
        repetidos.push(nuevo);
        continue;
      }
      existentes.add(k);

      const alumno: Alumno = {
        id: nuevoId(),
        nombre: nuevo.nombre.trim(),
        apellido: nuevo.apellido.trim(),
        creadoEn: Date.now(),
      };
      aInsertar.push(alumno);
      creados.push(alumno.id);
    }

    await db.alumnos.bulkAdd(aInsertar);
    return { creados, repetidos };
  });
}

/** Deshacer en lugar de confirmar: el alta se revierte, no se pregunta antes. */
export async function deshacerAlta(ids: Id[]): Promise<void> {
  await db.alumnos.bulkDelete(ids);
}

export function todosLosAlumnos(): Promise<Alumno[]> {
  return db.alumnos.orderBy('apellido').toArray();
}
