import { db, nuevoId } from './db';
import { alumnosInscriptos } from './inscripciones';
import type { BloqueHorario, Id, Materia } from './tipos';
import {
  diaSemanaDe,
  enMinutos,
  horaActualEnMinutos,
  type DiaSemana,
  type FechaLocal,
} from '../fecha';

export interface BloqueNuevo {
  materiaId: Id;
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
}

export async function agregarBloque(nuevo: BloqueNuevo): Promise<Id> {
  const bloque: BloqueHorario = { id: nuevoId(), ...nuevo };
  await db.bloquesHorario.add(bloque);
  return bloque.id;
}

export async function quitarBloque(id: Id): Promise<void> {
  // Las clases ya dictadas en ese bloque no se tocan: sacar el horario de la
  // semana que viene no borra la asistencia de la semana pasada.
  await db.bloquesHorario.delete(id);
}

function porHora(a: BloqueHorario, b: BloqueHorario): number {
  return enMinutos(a.horaInicio) - enMinutos(b.horaInicio);
}

export async function bloquesDeMateria(materiaId: Id): Promise<BloqueHorario[]> {
  const bloques = await db.bloquesHorario.where('materiaId').equals(materiaId).toArray();
  return bloques.sort((a, b) => a.diaSemana - b.diaSemana || porHora(a, b));
}

export interface ClaseDeHoy {
  materia: Materia;
  bloque: BloqueHorario;
  /** Sólo existe si ya se entró a tomar asistencia alguna vez ese día. */
  claseSesionId?: Id;
  registrados: number;
  inscriptos: number;
}

/**
 * Las clases de una fecha, en orden de horario. No crea nada: mirar la
 * pantalla no puede dejar clases dictadas en la base para días en los que
 * nunca se dio clase.
 */
export async function clasesDelDia(fecha: FechaLocal): Promise<ClaseDeHoy[]> {
  const dia = diaSemanaDe(fecha);
  const bloques = (await db.bloquesHorario.where('diaSemana').equals(dia).toArray()).sort(porHora);

  const clases: ClaseDeHoy[] = [];
  for (const bloque of bloques) {
    const materia = await db.materias.get(bloque.materiaId);
    // Una materia archivada no tiene clases: el curso terminó.
    if (!materia || materia.archivada) continue;

    const sesion = await db.clasesSesion
      .where('[materiaId+fecha+bloqueHorarioId]')
      .equals([bloque.materiaId, fecha, bloque.id])
      .first();

    const inscriptos = (await alumnosInscriptos(bloque.materiaId)).length;
    const registrados = sesion
      ? await db.registrosAsistencia.where('claseSesionId').equals(sesion.id).count()
      : 0;

    clases.push({ materia, bloque, claseSesionId: sesion?.id, registrados, inscriptos });
  }
  return clases;
}

/**
 * La clase que sigue: la que está ocurriendo, y si no, la próxima del día.
 * Cuando la jornada terminó no devuelve ninguna, porque ya no hay nada que
 * hacer y ofrecerlo sería inventar una acción.
 */
export function laQueSigue(clases: ClaseDeHoy[], ahora = horaActualEnMinutos()): ClaseDeHoy | undefined {
  return clases.find((c) => ahora < enMinutos(c.bloque.horaFin));
}

/**
 * Qué bloque corresponde si se entra a tomar asistencia sin decir cuál. Sin
 * esto, entrar desde la materia y entrar desde Hoy crearían dos clases
 * distintas para el mismo día y la asistencia quedaría partida.
 */
export async function bloqueSugerido(
  materiaId: Id,
  fecha: FechaLocal,
  ahora = horaActualEnMinutos(),
): Promise<Id | undefined> {
  const dia = diaSemanaDe(fecha);
  const deHoy = (await bloquesDeMateria(materiaId)).filter((b) => b.diaSemana === dia);
  if (deHoy.length === 0) return undefined;

  const enCurso = deHoy.find((b) => ahora < enMinutos(b.horaFin));
  return (enCurso ?? deHoy[deHoy.length - 1]).id;
}
