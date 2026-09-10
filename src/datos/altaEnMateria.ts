import { altaMasiva, deshacerAlta, type AlumnoNuevo } from './alumnos';
import { deshacerInscripcion, inscribir, type ResultadoInscripcion } from './inscripciones';
import type { Alumno, Id } from './tipos';
import { hoy, type FechaLocal } from '../fecha';

export interface AltaEnMateria {
  creados: Id[];
  repetidos: Alumno[];
  inscripcion: ResultadoInscripcion;
}

/**
 * Pegar una lista en una materia es una sola acción de la docente aunque sean
 * dos escrituras: dar de alta e inscribir. Van juntas acá para que deshacer
 * revierta las dos, y no media.
 */
export async function agregarAlumnosAMateria(
  materiaId: Id,
  nuevos: AlumnoNuevo[],
  fecha: FechaLocal,
): Promise<AltaEnMateria> {
  const alta = await altaMasiva(nuevos);

  // Los repetidos también se inscriben: ya existían de otra materia, y el
  // alumno es uno solo aunque lo tengas en varias.
  const inscripcion = await inscribir(
    materiaId,
    [...alta.creados, ...alta.repetidos.map((a) => a.id)],
    fecha,
  );

  return { ...alta, inscripcion };
}

export async function deshacerAltaEnMateria(
  materiaId: Id,
  alta: AltaEnMateria,
  fecha: FechaLocal = hoy(),
): Promise<void> {
  await deshacerInscripcion(materiaId, alta.inscripcion, fecha);
  await deshacerAlta(alta.creados);
}
