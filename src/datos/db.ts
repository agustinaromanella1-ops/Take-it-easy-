import Dexie, { type EntityTable } from 'dexie';
import type {
  Alumno,
  BloqueHorario,
  Calificacion,
  ClaseSesion,
  Escuela,
  EntradaAgenda,
  Evaluacion,
  Inscripcion,
  Materia,
  Observacion,
  Plantilla,
  Recordatorio,
  RegistroAsistencia,
} from './tipos';

/**
 * Una clase dictada fuera del horario habitual no tiene bloque, pero el índice
 * único [materiaId+fecha+bloqueHorarioId] no indexa filas con un campo vacío:
 * sin este centinela, la unicidad dejaría de aplicar justo ahí.
 */
export const SIN_BLOQUE = 'sin-bloque';

export class BaseTakeItEasy extends Dexie {
  escuelas!: EntityTable<Escuela, 'id'>;
  materias!: EntityTable<Materia, 'id'>;
  bloquesHorario!: EntityTable<BloqueHorario, 'id'>;
  alumnos!: EntityTable<Alumno, 'id'>;
  inscripciones!: EntityTable<Inscripcion, 'id'>;
  clasesSesion!: EntityTable<ClaseSesion, 'id'>;
  registrosAsistencia!: EntityTable<RegistroAsistencia, 'id'>;
  evaluaciones!: EntityTable<Evaluacion, 'id'>;
  calificaciones!: EntityTable<Calificacion, 'id'>;
  observaciones!: EntityTable<Observacion, 'id'>;
  plantillas!: EntityTable<Plantilla, 'id'>;
  entradasAgenda!: EntityTable<EntradaAgenda, 'id'>;
  recordatorios!: EntityTable<Recordatorio, 'id'>;

  constructor(nombre = 'take-it-easy') {
    super(nombre);

    this.version(1).stores({
      escuelas: 'id',
      materias: 'id, escuelaId',
      bloquesHorario: 'id, materiaId, diaSemana',
      alumnos: 'id, apellido',
      inscripciones: 'id, alumnoId, materiaId, &[alumnoId+materiaId]',
      clasesSesion: 'id, materiaId, fecha, &[materiaId+fecha+bloqueHorarioId]',
      registrosAsistencia: 'id, claseSesionId, alumnoId, &[claseSesionId+alumnoId]',
      evaluaciones: 'id, materiaId, fecha',
      calificaciones: 'id, evaluacionId, alumnoId, &[evaluacionId+alumnoId]',
      observaciones: 'id, alumnoId, materiaId, fecha, capa',
      plantillas: 'id, ambito',
      entradasAgenda: 'id, materiaId, fecha',
      recordatorios: 'id, entradaAgendaId, fechaHoraLocal',
    });
  }
}

export const db = new BaseTakeItEasy();

export function nuevoId(): string {
  return crypto.randomUUID();
}
