import { db, nuevoId } from './db';
import type { FechaLocal } from '../fecha';
import { alumnosInscriptos } from './inscripciones';
import { materia as buscarMateria } from './materias';
import { NUMERICA_1_10 } from './escalas';
import type { Alumno, Escala, Evaluacion, Id } from './tipos';

export interface EvaluacionNueva {
  materiaId: Id;
  nombre: string;
  fecha: FechaLocal;
  tipo: string;
  /** Si no viene, hereda la de la materia. */
  escala?: Escala;
}

/**
 * La evaluación hereda la escala de la materia, y puede cambiarla: un trabajo
 * práctico conceptual y un parcial numérico conviven en la misma materia. La
 * escala se copia, no se referencia: cambiar la de la materia más adelante no
 * puede reinterpretar notas ya cargadas.
 */
export async function crearEvaluacion(nueva: EvaluacionNueva): Promise<Id> {
  const materia = await buscarMateria(nueva.materiaId);
  const evaluacion: Evaluacion = {
    id: nuevoId(),
    materiaId: nueva.materiaId,
    nombre: nueva.nombre.trim(),
    fecha: nueva.fecha,
    tipo: nueva.tipo.trim(),
    escala: nueva.escala ?? materia?.escalaPorDefecto ?? NUMERICA_1_10,
  };
  await db.evaluaciones.add(evaluacion);
  return evaluacion.id;
}

/**
 * De la más nueva a la más vieja: la que se está corrigiendo es la de arriba.
 *
 * Dos del mismo día se desempatan por nombre. Sin desempate el orden lo decide
 * la base, que ordena por un uuid: la lista se ve barajada y cambia de lugar
 * entre visitas.
 */
export async function evaluacionesDeMateria(materiaId: Id): Promise<Evaluacion[]> {
  const evaluaciones = await db.evaluaciones.where('materiaId').equals(materiaId).toArray();
  return evaluaciones.sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || a.nombre.localeCompare(b.nombre, 'es'),
  );
}

export function evaluacion(id: Id): Promise<Evaluacion | undefined> {
  return db.evaluaciones.get(id);
}

/** Borrar una evaluación se lleva sus notas: dejarlas sueltas es peor. */
export async function borrarEvaluacion(id: Id): Promise<void> {
  await db.transaction('rw', db.evaluaciones, db.calificaciones, async () => {
    await db.calificaciones.where('evaluacionId').equals(id).delete();
    await db.evaluaciones.delete(id);
  });
}

export interface NotaDeAlumno {
  alumno: Alumno;
  /** Nulo mientras no se cargó: no es un cero. */
  valor: number | Id | null;
}

export interface Planilla {
  evaluacion: Evaluacion;
  notas: NotaDeAlumno[];
  cargadas: number;
}

/**
 * Los inscriptos de la materia con la nota que tengan. Sale de la inscripción
 * y no de las notas cargadas: un alumno sin nota tiene que aparecer, que es
 * justo el que falta corregir.
 */
export async function planillaDeEvaluacion(evaluacionId: Id): Promise<Planilla | undefined> {
  const suya = await evaluacion(evaluacionId);
  if (!suya) return undefined;

  const [alumnos, calificaciones] = await Promise.all([
    alumnosInscriptos(suya.materiaId),
    db.calificaciones.where('evaluacionId').equals(evaluacionId).toArray(),
  ]);

  const porAlumno = new Map(calificaciones.map((c) => [c.alumnoId, c.valor]));
  const notas = alumnos.map((alumno) => ({
    alumno,
    valor: porAlumno.get(alumno.id) ?? null,
  }));

  return { evaluacion: suya, notas, cargadas: notas.filter((n) => n.valor !== null).length };
}

export interface Escalon {
  id: Id;
  texto: string;
  cuantas: number;
}

/**
 * En una escala conceptual no hay promedio: hay distribución. Promediar
 * etiquetas inventa una distancia entre ellas que nadie definió.
 */
export function distribucion(evaluacion: Evaluacion, notas: NotaDeAlumno[]): Escalon[] {
  if (evaluacion.escala.tipo !== 'conceptual') return [];
  return evaluacion.escala.etiquetas.map((etiqueta) => ({
    id: etiqueta.id,
    texto: etiqueta.texto,
    cuantas: notas.filter((n) => n.valor === etiqueta.id).length,
  }));
}

/** El promedio de la evaluación, sólo si su escala es numérica. */
export function promedioDeEvaluacion(evaluacion: Evaluacion, notas: NotaDeAlumno[]): number | null {
  if (evaluacion.escala.tipo !== 'numerica') return null;
  const numeros = notas.map((n) => n.valor).filter((v): v is number => typeof v === 'number');
  if (numeros.length === 0) return null;
  return numeros.reduce((total, n) => total + n, 0) / numeros.length;
}
