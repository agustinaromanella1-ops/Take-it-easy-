import { db, nuevoId } from './db';
import { cabeEnLaEscala } from './escalas';
import type { Calificacion, Escala, Id } from './tipos';

export interface MarcaCalificacion {
  evaluacionId: Id;
  alumnoId: Id;
  valor: number | Id;
}

export class NotaInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'NotaInvalidaError';
  }
}

/**
 * Upsert por el par [evaluacionId + alumnoId]. Sin esto, un doble toque suma
 * una segunda nota y el promedio miente sin que nadie lo note.
 *
 * La nota se contrasta contra la escala de su evaluación acá, en la capa de
 * datos, y no en el formulario: un 47 en una escala de 1 a 10 no es un cartel
 * que se pueda ignorar, es una escritura que no ocurre.
 */
export async function calificar(marca: MarcaCalificacion): Promise<Id> {
  return db.transaction('rw', db.calificaciones, db.evaluaciones, async () => {
    const evaluacion = await db.evaluaciones.get(marca.evaluacionId);
    if (!evaluacion) {
      throw new NotaInvalidaError('La evaluación no existe.');
    }
    if (!cabeEnLaEscala(evaluacion.escala, marca.valor)) {
      throw new NotaInvalidaError('La nota no entra en la escala de la evaluación.');
    }

    const existente = await db.calificaciones
      .where('[evaluacionId+alumnoId]')
      .equals([marca.evaluacionId, marca.alumnoId])
      .first();

    if (existente) {
      await db.calificaciones.update(existente.id, {
        valor: marca.valor,
        registradoEn: Date.now(),
      });
      return existente.id;
    }

    const calificacion: Calificacion = {
      id: nuevoId(),
      evaluacionId: marca.evaluacionId,
      alumnoId: marca.alumnoId,
      valor: marca.valor,
      registradoEn: Date.now(),
    };
    await db.calificaciones.add(calificacion);
    return calificacion.id;
  });
}

export interface Promedio {
  valor: number | null;
  numericas: number;
  /** Evaluaciones de escala conceptual, que quedan fuera del promedio. */
  conceptuales: number;
}

/**
 * El promedio sale sólo de las evaluaciones numéricas. Convertir etiquetas
 * conceptuales a números inventa una distancia entre ellas que nadie definió.
 */
export async function promedioDeAlumno(alumnoId: Id, materiaId: Id): Promise<Promedio> {
  const evaluaciones = await db.evaluaciones.where('materiaId').equals(materiaId).toArray();
  const escalaPorEvaluacion = new Map<Id, Escala>(evaluaciones.map((e) => [e.id, e.escala]));

  const calificaciones = await db.calificaciones.where('alumnoId').equals(alumnoId).toArray();

  let suma = 0;
  let numericas = 0;
  let conceptuales = 0;

  for (const calificacion of calificaciones) {
    const escala = escalaPorEvaluacion.get(calificacion.evaluacionId);
    if (!escala) continue;
    if (escala.tipo === 'conceptual') {
      conceptuales += 1;
    } else if (typeof calificacion.valor === 'number') {
      suma += calificacion.valor;
      numericas += 1;
    }
  }

  return {
    valor: numericas > 0 ? suma / numericas : null,
    numericas,
    conceptuales,
  };
}

/** Borrar la nota es distinto de ponerle cero: vuelve a "sin corregir". */
export async function borrarCalificacion(evaluacionId: Id, alumnoId: Id): Promise<void> {
  await db.calificaciones
    .where('[evaluacionId+alumnoId]')
    .equals([evaluacionId, alumnoId])
    .delete();
}
