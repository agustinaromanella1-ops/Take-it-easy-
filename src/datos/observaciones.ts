import { db, nuevoId } from './db';
import type { Id, Observacion } from './tipos';
import type { FechaLocal } from '../fecha';

export interface ObservacionNueva {
  ambito: 'alumno' | 'materia';
  alumnoId?: Id;
  materiaId?: Id;
  fecha: FechaLocal;
  texto: string;
}

/**
 * Toda observación es privada, y no hay forma de que deje de serlo: no existe
 * la opción de compartirla, ni al crearla ni después.
 */
export async function crearObservacion(nueva: ObservacionNueva): Promise<Id> {
  const observacion: Observacion = {
    id: nuevoId(),
    ambito: nueva.ambito,
    alumnoId: nueva.alumnoId,
    materiaId: nueva.materiaId,
    fecha: nueva.fecha,
    texto: nueva.texto,
    creadoEn: Date.now(),
  };
  await db.observaciones.add(observacion);
  return observacion.id;
}

/**
 * De la más nueva a la más vieja. Dos del mismo día se desempatan por cuándo
 * se escribieron: sin desempate el orden lo decide la base, que ordena por un
 * uuid, y la lista se ve barajada entre visitas.
 */
export async function observacionesDeAlumno(alumnoId: Id): Promise<Observacion[]> {
  const observaciones = await db.observaciones.where('alumnoId').equals(alumnoId).toArray();
  return observaciones.sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creadoEn - a.creadoEn);
}

export async function borrarObservacion(id: Id): Promise<void> {
  await db.observaciones.delete(id);
}

/**
 * Vuelve a poner una observación borrada, con su id y su fecha. No es
 * una observación nueva: si lo fuera, una privada que se borró por error
 * volvería con la fecha de hoy, y eso es perder el dato en vez de recuperarlo.
 */
export async function restaurarObservacion(observacion: Observacion): Promise<void> {
  await db.observaciones.put(observacion);
}
