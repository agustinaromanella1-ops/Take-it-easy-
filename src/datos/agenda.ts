import { db, nuevoId } from './db';
import type { FechaLocal } from '../fecha';
import { comoSeLlama } from './materias';
import type { EntradaAgenda, Id, Recordatorio } from './tipos';

/**
 * La agenda: lo que hay que hacer o llevar a una clase, y el recordatorio que
 * lo avisa. El recordatorio es una notificación local del teléfono; lo que se
 * escribe acá nunca sale de él, ni siquiera a la pantalla bloqueada (1.5).
 */

export interface EntradaNueva {
  materiaId?: Id;
  fecha: FechaLocal;
  titulo: string;
  detalle?: string;
}

export async function crearEntrada(nueva: EntradaNueva): Promise<Id> {
  const entrada: EntradaAgenda = {
    id: nuevoId(),
    materiaId: nueva.materiaId,
    fecha: nueva.fecha,
    titulo: nueva.titulo.trim(),
    detalle: nueva.detalle?.trim() || undefined,
  };
  await db.entradasAgenda.add(entrada);
  return entrada.id;
}

/**
 * De hoy en adelante, del día más cercano al más lejano: lo que viene es lo
 * que importa. Dos del mismo día se desempatan por título, que si no el orden
 * lo decide la base, que ordena por un uuid.
 */
export async function entradasDesde(fecha: FechaLocal): Promise<EntradaAgenda[]> {
  const entradas = await db.entradasAgenda.where('fecha').aboveOrEqual(fecha).toArray();
  return entradas.sort(
    (a, b) => a.fecha.localeCompare(b.fecha) || a.titulo.localeCompare(b.titulo, 'es'),
  );
}

export async function entradasDelDia(fecha: FechaLocal): Promise<EntradaAgenda[]> {
  const entradas = await db.entradasAgenda.where('fecha').equals(fecha).toArray();
  return entradas.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es'));
}

/** Borrar la entrada cancela sus recordatorios: avisar de algo que ya no está molesta. */
export async function borrarEntrada(id: Id): Promise<number[]> {
  return db.transaction('rw', db.entradasAgenda, db.recordatorios, async () => {
    const suyos = await db.recordatorios.where('entradaAgendaId').equals(id).toArray();
    await db.recordatorios.where('entradaAgendaId').equals(id).delete();
    await db.entradasAgenda.delete(id);
    return suyos.map((r) => r.idNotificacion);
  });
}

/**
 * Android identifica una notificación con un entero de 32 bits, así que el
 * uuid de la entrada no sirve como id. Se sortea uno y se guarda: hace falta
 * para poder cancelarla después.
 */
function nuevoIdDeNotificacion(): number {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

export interface RecordatorioNuevo {
  entradaAgendaId: Id;
  /** "2026-09-15T07:30", hora del teléfono. Sin zona: suena a esa hora, acá. */
  fechaHoraLocal: string;
}

export class RecordatorioInvalidoError extends Error {
  constructor(motivo: string) {
    super(motivo);
    this.name = 'RecordatorioInvalidoError';
  }
}

/**
 * Un aviso para un momento que ya pasó no suena nunca, o suena en el acto: las
 * dos cosas son un aviso roto. Se rechaza acá y no en el formulario.
 */
export async function agendarRecordatorio(
  nuevo: RecordatorioNuevo,
  ahora = new Date(),
): Promise<Recordatorio> {
  if (new Date(nuevo.fechaHoraLocal).getTime() <= ahora.getTime()) {
    throw new RecordatorioInvalidoError('El aviso quedaría en el pasado.');
  }

  const recordatorio: Recordatorio = {
    id: nuevoId(),
    entradaAgendaId: nuevo.entradaAgendaId,
    fechaHoraLocal: nuevo.fechaHoraLocal,
    idNotificacion: nuevoIdDeNotificacion(),
    estado: 'programado',
  };
  await db.recordatorios.add(recordatorio);
  return recordatorio;
}

export async function cancelarRecordatorio(id: Id): Promise<number | undefined> {
  const recordatorio = await db.recordatorios.get(id);
  if (!recordatorio) return undefined;
  await db.recordatorios.update(id, { estado: 'cancelado' });
  return recordatorio.idNotificacion;
}

export function recordatoriosDe(entradaAgendaId: Id): Promise<Recordatorio[]> {
  return db.recordatorios.where('entradaAgendaId').equals(entradaAgendaId).toArray();
}

/**
 * Los que todavía tienen que sonar. Se usan al arrancar la app para volver a
 * programarlos: un reinicio del teléfono, una reinstalación o un borrado de
 * datos del sistema se llevan las notificaciones programadas, y la base es la
 * que sabe cuáles eran.
 */
export async function recordatoriosPendientes(ahora = new Date()): Promise<Recordatorio[]> {
  const todos = await programados();
  return todos.filter((r) => new Date(r.fechaHoraLocal).getTime() > ahora.getTime());
}

/**
 * `estado` no está indexado y no vale una migración del esquema por una tabla
 * de unas pocas filas: se filtra en memoria.
 */
async function programados(): Promise<Recordatorio[]> {
  const todos = await db.recordatorios.toArray();
  return todos.filter((r) => r.estado === 'programado');
}

/** Los que ya pasaron y siguen figurando como programados. */
export async function marcarEntregados(ahora = new Date()): Promise<number> {
  const todos = await programados();
  const vencidos = todos.filter((r) => new Date(r.fechaHoraLocal).getTime() <= ahora.getTime());
  await db.recordatorios.bulkUpdate(
    vencidos.map((r) => ({ key: r.id, changes: { estado: 'entregado' as const } })),
  );
  return vencidos.length;
}

/** Cómo se llama la materia de una entrada, para el título de la notificación. */
export async function materiaDeLaEntrada(entrada: EntradaAgenda): Promise<string | undefined> {
  if (!entrada.materiaId) return undefined;
  const materia = await db.materias.get(entrada.materiaId);
  return materia ? comoSeLlama(materia) : undefined;
}
