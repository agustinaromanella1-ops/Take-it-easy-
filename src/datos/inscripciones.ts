import { db, nuevoId } from './db';
import type { Alumno, Id, Inscripcion } from './tipos';
import type { FechaLocal } from '../fecha';

/**
 * Inscribir es idempotente: el alumno existe una sola vez y la inscripción
 * también. Volver a inscribir a alguien que ya está reactiva su baja en vez
 * de crear una segunda fila.
 */
export async function inscribir(
  materiaId: Id,
  alumnoIds: Id[],
  desde: FechaLocal,
): Promise<void> {
  await db.transaction('rw', db.inscripciones, async () => {
    for (const alumnoId of alumnoIds) {
      const existente = await db.inscripciones
        .where('[alumnoId+materiaId]')
        .equals([alumnoId, materiaId])
        .first();

      if (existente) {
        if (existente.estado === 'baja') {
          await db.inscripciones.update(existente.id, { estado: 'activa', hasta: undefined });
        }
        continue;
      }

      const inscripcion: Inscripcion = {
        id: nuevoId(),
        alumnoId,
        materiaId,
        estado: 'activa',
        desde,
      };
      await db.inscripciones.add(inscripcion);
    }
  });
}

/** La baja no borra: la asistencia y las notas ya cargadas siguen ahí. */
export async function darDeBaja(materiaId: Id, alumnoId: Id, hasta: FechaLocal): Promise<void> {
  const existente = await db.inscripciones
    .where('[alumnoId+materiaId]')
    .equals([alumnoId, materiaId])
    .first();
  if (existente) {
    await db.inscripciones.update(existente.id, { estado: 'baja', hasta });
  }
}

export async function alumnosInscriptos(materiaId: Id): Promise<Alumno[]> {
  const inscripciones = await db.inscripciones.where('materiaId').equals(materiaId).toArray();
  const activos = inscripciones.filter((i) => i.estado === 'activa').map((i) => i.alumnoId);
  const alumnos = (await db.alumnos.bulkGet(activos)).filter((a): a is Alumno => a !== undefined);

  return alumnos.sort(
    (a, b) =>
      a.apellido.localeCompare(b.apellido, 'es-AR') ||
      a.nombre.localeCompare(b.nombre, 'es-AR'),
  );
}

export async function idsInscriptos(materiaId: Id): Promise<Set<Id>> {
  const inscripciones = await db.inscripciones.where('materiaId').equals(materiaId).toArray();
  return new Set(inscripciones.filter((i) => i.estado === 'activa').map((i) => i.alumnoId));
}
