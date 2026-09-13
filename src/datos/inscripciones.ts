import { db, nuevoId } from './db';
import type { Alumno, Id, Inscripcion } from './tipos';
import type { FechaLocal } from '../fecha';

export interface ResultadoInscripcion {
  /** No estaban inscriptos: la inscripción la creó esta acción. */
  nuevas: Id[];
  /** Estaban dados de baja y esta acción los volvió a activar. */
  reactivadas: Id[];
}

/**
 * Inscribir es idempotente: el alumno existe una sola vez y la inscripción
 * también. Volver a inscribir a alguien que ya está reactiva su baja en vez
 * de crear una segunda fila.
 *
 * Informa qué cambió, y no sólo qué se pidió, para que deshacer pueda
 * revertir exactamente eso: a quien ya estaba inscripto de antes no lo tocó
 * esta acción, y deshacerla no puede sacarlo del curso.
 */
export async function inscribir(
  materiaId: Id,
  alumnoIds: Id[],
  desde: FechaLocal,
): Promise<ResultadoInscripcion> {
  return db.transaction('rw', db.inscripciones, async () => {
    const nuevas: Id[] = [];
    const reactivadas: Id[] = [];

    for (const alumnoId of alumnoIds) {
      const existente = await db.inscripciones
        .where('[alumnoId+materiaId]')
        .equals([alumnoId, materiaId])
        .first();

      if (existente) {
        if (existente.estado === 'baja') {
          await db.inscripciones.update(existente.id, { estado: 'activa', hasta: undefined });
          reactivadas.push(alumnoId);
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
      nuevas.push(alumnoId);
    }

    return { nuevas, reactivadas };
  });
}

/** Revierte exactamente lo que hizo una inscripción, y nada más. */
export async function deshacerInscripcion(
  materiaId: Id,
  cambios: ResultadoInscripcion,
  hasta: FechaLocal,
): Promise<void> {
  await db.transaction('rw', db.inscripciones, async () => {
    for (const alumnoId of cambios.nuevas) {
      await db.inscripciones.where('[alumnoId+materiaId]').equals([alumnoId, materiaId]).delete();
    }
    for (const alumnoId of cambios.reactivadas) {
      const existente = await db.inscripciones
        .where('[alumnoId+materiaId]')
        .equals([alumnoId, materiaId])
        .first();
      if (existente) {
        await db.inscripciones.update(existente.id, { estado: 'baja', hasta });
      }
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
