import { db, nuevoId } from './db';
import type { Capa, Id, Observacion } from './tipos';
import type { FechaLocal } from '../fecha';

export interface ObservacionNueva {
  ambito: 'alumno' | 'materia';
  alumnoId?: Id;
  materiaId?: Id;
  fecha: FechaLocal;
  texto: string;
}

/**
 * No recibe capa, y no hay forma de pedir otra: toda observación nueva nace
 * privada. Cambiarla de capa es una acción explícita y posterior de la docente.
 */
export async function crearObservacion(nueva: ObservacionNueva): Promise<Id> {
  const observacion: Observacion = {
    id: nuevoId(),
    ambito: nueva.ambito,
    alumnoId: nueva.alumnoId,
    materiaId: nueva.materiaId,
    fecha: nueva.fecha,
    texto: nueva.texto,
    capa: 'privada',
    creadoEn: Date.now(),
  };
  await db.observaciones.add(observacion);
  return observacion.id;
}

export async function cambiarCapa(id: Id, capa: Capa): Promise<void> {
  await db.observaciones.update(id, { capa });
}

export function observacionesDeAlumno(alumnoId: Id): Promise<Observacion[]> {
  return db.observaciones.where('alumnoId').equals(alumnoId).reverse().sortBy('fecha');
}
