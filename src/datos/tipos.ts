import type { FechaLocal } from '../fecha';

export type Id = string;

/** Instante, no día de calendario: epoch en milisegundos. */
export type Instante = number;

export type Escala =
  | { tipo: 'numerica'; min: number; max: number; decimales: number }
  | { tipo: 'conceptual'; etiquetas: EtiquetaConceptual[] };

export type EtiquetaConceptual = { id: Id; texto: string };

export type ColorPastel = 'lila' | 'rosa' | 'durazno' | 'celeste' | 'noche';

export type EstadoAsistencia = 'presente' | 'ausente' | 'tarde';


export interface Escuela {
  id: Id;
  nombre: string;
}

export interface Materia {
  id: Id;
  escuelaId: Id;
  nombre: string;
  anio: string;
  division: string;
  colorPastel: ColorPastel;
  escalaPorDefecto: Escala;
  /**
   * Archivada deja de aparecer, pero no borra nada: la asistencia y las notas
   * de un curso que terminó siguen ahí, y se puede recuperar cuando sea.
   */
  archivada?: boolean;
}

export interface BloqueHorario {
  id: Id;
  materiaId: Id;
  diaSemana: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  horaInicio: string;
  horaFin: string;
}

export interface Alumno {
  id: Id;
  nombre: string;
  apellido: string;
  creadoEn: Instante;
}

export interface Inscripcion {
  id: Id;
  alumnoId: Id;
  materiaId: Id;
  estado: 'activa' | 'baja';
  desde: FechaLocal;
  hasta?: FechaLocal;
}

export interface ClaseSesion {
  id: Id;
  materiaId: Id;
  fecha: FechaLocal;
  bloqueHorarioId: Id;
  tema?: string;
}

export interface RegistroAsistencia {
  id: Id;
  claseSesionId: Id;
  alumnoId: Id;
  estado: EstadoAsistencia;
  justificada: boolean;
  registradoEn: Instante;
}

export interface Evaluacion {
  id: Id;
  materiaId: Id;
  nombre: string;
  fecha: FechaLocal;
  tipo: string;
  escala: Escala;
}

export interface Calificacion {
  id: Id;
  evaluacionId: Id;
  alumnoId: Id;
  /** Número en escalas numéricas; id de la etiqueta en las conceptuales. */
  valor: number | Id;
  registradoEn: Instante;
}

export interface Observacion {
  id: Id;
  ambito: 'alumno' | 'materia';
  alumnoId?: Id;
  materiaId?: Id;
  fecha: FechaLocal;
  texto: string;
  creadoEn: Instante;
}

export interface Plantilla {
  id: Id;
  texto: string;
  ambito: 'individual' | 'grupal';
}

export interface EntradaAgenda {
  id: Id;
  materiaId?: Id;
  fecha: FechaLocal;
  titulo: string;
  detalle?: string;
}

export interface Recordatorio {
  id: Id;
  entradaAgendaId: Id;
  /** Fecha y hora locales, sin zona: suena a la hora del teléfono. */
  fechaHoraLocal: string;
  idNotificacion: number;
  estado: 'programado' | 'entregado' | 'cancelado';
}

/** Lo que la docente dejó escrito a medias en una pantalla. */
export interface Borrador {
  clave: string;
  contenido: unknown;
  guardadoEn: Instante;
}

/** Preferencias de la app: qué instructivo ya se vio, y lo que venga. */
export interface Preferencia {
  clave: string;
  valor: unknown;
}
