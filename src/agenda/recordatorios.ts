import {
  agendarRecordatorio,
  cancelarRecordatorio,
  marcarEntregados,
  materiaDeLaEntrada,
  recordatoriosPendientes,
} from '../datos/agenda';
import { db } from '../datos/db';
import { cancelar, programar } from '../nativo/notificaciones';
import type { EntradaAgenda, Id } from '../datos/tipos';
import type { Aviso } from './aviso';

/**
 * Lo que une la base con las notificaciones del sistema. Vive aparte de las
 * dos: la base no sabe de notificaciones y el módulo nativo no sabe de la base.
 */

async function avisoDe(entrada: EntradaAgenda): Promise<Aviso> {
  const materia = await materiaDeLaEntrada(entrada);
  // El título de la entrada no entra acá. No es que no se use: no llega.
  return materia ? { caso: 'nota-de-clase', materia } : { caso: 'sin-materia' };
}

export async function ponerRecordatorio(
  entrada: EntradaAgenda,
  fechaHoraLocal: string,
): Promise<void> {
  const recordatorio = await agendarRecordatorio({
    entradaAgendaId: entrada.id,
    fechaHoraLocal,
  });
  await programar(recordatorio.idNotificacion, await avisoDe(entrada), new Date(fechaHoraLocal));
}

export async function sacarRecordatorio(id: Id): Promise<void> {
  const idNotificacion = await cancelarRecordatorio(id);
  if (idNotificacion !== undefined) await cancelar(idNotificacion);
}

export async function apagarNotificaciones(ids: number[]): Promise<void> {
  for (const id of ids) await cancelar(id);
}

/**
 * Al arrancar: los que ya pasaron se marcan entregados y los que vienen se
 * vuelven a programar.
 *
 * Reprogramar de más no molesta —el sistema reemplaza la notificación con el
 * mismo id—, y cubre el caso de que las programadas se hayan perdido: un
 * reinicio, una reinstalación, un borrado de datos desde los ajustes del
 * teléfono. La base es la que sabe cuáles eran.
 */
export async function reprogramarPendientes(ahora = new Date()): Promise<number> {
  await marcarEntregados(ahora);

  const pendientes = await recordatoriosPendientes(ahora);
  for (const recordatorio of pendientes) {
    const entrada = await db.entradasAgenda.get(recordatorio.entradaAgendaId);
    if (!entrada) continue;
    await programar(
      recordatorio.idNotificacion,
      await avisoDe(entrada),
      new Date(recordatorio.fechaHoraLocal),
    );
  }
  return pendientes.length;
}
