import { db, nuevoId } from './db';
import type { ColorPastel, Escala, Id, Materia } from './tipos';

export const ESCALA_NUMERICA_1_10: Escala = {
  tipo: 'numerica',
  min: 1,
  max: 10,
  decimales: 2,
};

export interface MateriaNueva {
  nombre: string;
  anio: string;
  division: string;
  escuela: string;
  colorPastel: ColorPastel;
  escalaPorDefecto?: Escala;
}

export async function crearMateria(nueva: MateriaNueva): Promise<Id> {
  return db.transaction('rw', db.escuelas, db.materias, async () => {
    const nombreEscuela = nueva.escuela.trim();
    const existente = await db.escuelas
      .filter((e) => e.nombre.toLowerCase() === nombreEscuela.toLowerCase())
      .first();

    let escuelaId = existente?.id;
    if (!escuelaId) {
      escuelaId = nuevoId();
      await db.escuelas.add({ id: escuelaId, nombre: nombreEscuela });
    }

    const materia: Materia = {
      id: nuevoId(),
      escuelaId,
      nombre: nueva.nombre.trim(),
      anio: nueva.anio.trim(),
      division: nueva.division.trim(),
      colorPastel: nueva.colorPastel,
      escalaPorDefecto: nueva.escalaPorDefecto ?? ESCALA_NUMERICA_1_10,
    };
    await db.materias.add(materia);
    return materia.id;
  });
}

/**
 * El orden natural de la base es por id, que es un uuid: la lista quedaría
 * barajada y cambiando de lugar. Se ordena por cómo se lee en pantalla.
 */
function ordenadas(materias: Materia[]): Materia[] {
  return materias.sort(
    (a, b) =>
      a.nombre.localeCompare(b.nombre, 'es-AR') ||
      a.anio.localeCompare(b.anio, 'es-AR', { numeric: true }) ||
      a.division.localeCompare(b.division, 'es-AR'),
  );
}

/** Las que están en curso. Las archivadas se piden aparte, a propósito. */
export async function materiasActivas(): Promise<Materia[]> {
  return ordenadas(await db.materias.filter((m) => !m.archivada).toArray());
}

export async function materiasArchivadas(): Promise<Materia[]> {
  return ordenadas(await db.materias.filter((m) => m.archivada === true).toArray());
}

/**
 * Archivar no borra: ni la materia, ni los alumnos inscriptos, ni la
 * asistencia ya tomada. Es reversible siempre, así que no hace falta
 * preguntar antes.
 */
export async function archivarMateria(id: Id): Promise<void> {
  await db.materias.update(id, { archivada: true });
}

export async function recuperarMateria(id: Id): Promise<void> {
  await db.materias.update(id, { archivada: false });
}

/**
 * Deshacer el alta de una materia recién creada. Sólo borra si está vacía: si
 * ya tiene alumnos, clases o notas, deshacer se llevaría puesto trabajo real y
 * para eso está archivar.
 */
export async function deshacerCreacion(id: Id): Promise<boolean> {
  return db.transaction(
    'rw',
    db.materias, db.inscripciones, db.clasesSesion, db.evaluaciones, db.bloquesHorario,
    async () => {
      const tieneAlgo =
        (await db.inscripciones.where('materiaId').equals(id).count()) > 0 ||
        (await db.clasesSesion.where('materiaId').equals(id).count()) > 0 ||
        (await db.evaluaciones.where('materiaId').equals(id).count()) > 0;
      if (tieneAlgo) return false;

      await db.bloquesHorario.where('materiaId').equals(id).delete();
      await db.materias.delete(id);
      return true;
    },
  );
}

export function materia(id: Id): Promise<Materia | undefined> {
  return db.materias.get(id);
}

export async function nombreDeEscuela(escuelaId: Id): Promise<string> {
  return (await db.escuelas.get(escuelaId))?.nombre ?? '';
}

/** "Historia · 4.º B", como se lee en la pantalla. */
export function comoSeLlama(m: Materia): string {
  return `${m.nombre} · ${m.anio}.º ${m.division}`;
}
