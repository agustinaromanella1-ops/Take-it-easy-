import { db } from './db';
import { NUMERICA_1_10, cabeEnLaEscala, comoSeEscribe } from './escalas';
import { evaluacionesDeMateria } from './evaluaciones';
import { promedioDeAlumno, type Promedio } from './calificaciones';
import { observacionesDeAlumno } from './observaciones';
import type { Escala, Evaluacion, Id, Observacion } from './tipos';

/**
 * Todo lo que hay de un alumno en una materia, junto: cada evaluación con su
 * nota, las conceptuales incluidas, las observaciones, y la nota final.
 *
 * Existe porque cerrar una materia obliga a mirar el año entero de una vez, y
 * hasta ahora eso había que armarlo en la cabeza abriendo evaluación por
 * evaluación.
 */

export interface LineaDeNota {
  evaluacion: Evaluacion;
  /** El número, o el id de la etiqueta en las conceptuales. */
  valor: number | Id | null;
  /** Cómo se lee: «8», «Logrado», o null si no tiene nota. */
  comoSeLee: string | null;
}

export interface Boletin {
  lineas: LineaDeNota[];
  promedio: Promedio;
  observaciones: Observacion[];
  notaFinal: number | null;
  /** En qué escala se escribe la nota final. */
  escalaFinal: Escala;
}

/**
 * Las evaluaciones van de la más vieja a la más nueva, al revés que en el
 * resto de la app. Acá no se está buscando la última para cargarle notas: se
 * está leyendo cómo fue el año para poder cerrarlo.
 */
export async function boletinDeAlumno(alumnoId: Id, materiaId: Id): Promise<Boletin> {
  const [evaluaciones, promedio, observaciones, materia, inscripcion] = await Promise.all([
    evaluacionesDeMateria(materiaId),
    promedioDeAlumno(alumnoId, materiaId),
    observacionesDeAlumno(alumnoId),
    db.materias.get(materiaId),
    laInscripcion(alumnoId, materiaId),
  ]);

  const suyas = await db.calificaciones.where('alumnoId').equals(alumnoId).toArray();
  const porEvaluacion = new Map(suyas.map((c) => [c.evaluacionId, c.valor]));

  const lineas = [...evaluaciones]
    .reverse()
    .map((evaluacion) => {
      const valor = porEvaluacion.get(evaluacion.id) ?? null;
      return { evaluacion, valor, comoSeLee: leer(evaluacion.escala, valor) };
    });

  const deLaMateria = materia?.escalaPorDefecto;
  return {
    lineas,
    promedio,
    observaciones: observaciones.filter((o) => o.materiaId === materiaId),
    notaFinal: inscripcion?.notaFinal ?? null,
    escalaFinal: deLaMateria?.tipo === 'numerica' ? deLaMateria : NUMERICA_1_10,
  };
}

function leer(escala: Escala, valor: number | Id | null): string | null {
  if (valor === null) return null;
  if (escala.tipo === 'conceptual') {
    return escala.etiquetas.find((e) => e.id === valor)?.texto ?? null;
  }
  return typeof valor === 'number' ? comoSeEscribe(escala, valor) : null;
}

function laInscripcion(alumnoId: Id, materiaId: Id) {
  return db.inscripciones.where('[alumnoId+materiaId]').equals([alumnoId, materiaId]).first();
}

export class NotaFinalInvalidaError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'NotaFinalInvalidaError';
  }
}

/**
 * Guarda la nota final. La app no la calcula: es ponderada según el criterio
 * de la docente, y cada escuela pondera distinto. Lo único que se comprueba es
 * que entre en la escala, igual que cualquier otra nota.
 */
export async function ponerNotaFinal(
  alumnoId: Id,
  materiaId: Id,
  valor: number,
  escala: Escala = NUMERICA_1_10,
): Promise<void> {
  if (!cabeEnLaEscala(escala, valor)) {
    throw new NotaFinalInvalidaError('La nota final no entra en la escala de la materia.');
  }
  const inscripcion = await laInscripcion(alumnoId, materiaId);
  if (!inscripcion) {
    throw new NotaFinalInvalidaError('El alumno no está inscripto en esta materia.');
  }
  await db.inscripciones.update(inscripcion.id, { notaFinal: valor });
}

/** Sacarla es distinto de ponerle cero: vuelve a «todavía no cerrada». */
export async function borrarNotaFinal(alumnoId: Id, materiaId: Id): Promise<void> {
  const inscripcion = await laInscripcion(alumnoId, materiaId);
  if (!inscripcion) return;
  await db.inscripciones.update(inscripcion.id, { notaFinal: undefined });
}
