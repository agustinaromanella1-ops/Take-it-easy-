import { textoDelAviso } from './aviso';
import {
  cancelar,
  hayNotificaciones,
  pedirPermiso,
  programadas,
  programar,
  tenemosPermiso,
} from '../nativo/notificaciones';

/**
 * Un aviso de prueba, para comprobar en el teléfono que las notificaciones
 * suenan. Sin esto, la única forma de probarlo era anotar algo en la agenda,
 * poner el aviso para dentro de un minuto y esperar, sin saber en qué paso
 * falla si no llega.
 */

/** Un id fijo y propio: se reemplaza a sí mismo y nunca pisa un recordatorio real. */
const ID_DE_PRUEBA = 2_000_000_001;

/** Un minuto alcanza para cerrar la app, y no es tanto como para dudar. */
const ESPERA_MINUTOS = 1;

export type Resultado =
  | { estado: 'programado'; hora: string }
  | { estado: 'sin-permiso' }
  | { estado: 'sin-notificaciones' };

export async function probarElAviso(ahora = new Date()): Promise<Resultado> {
  if (!hayNotificaciones()) return { estado: 'sin-notificaciones' };

  const hay = (await tenemosPermiso()) || (await pedirPermiso());
  if (!hay) return { estado: 'sin-permiso' };

  const cuando = new Date(ahora.getTime() + ESPERA_MINUTOS * 60 * 1000);
  await programar(ID_DE_PRUEBA, { caso: 'sin-materia' }, cuando);

  return { estado: 'programado', hora: aLaHora(cuando) };
}

/** Si ya no lo espera más. */
export async function cancelarLaPrueba(): Promise<void> {
  await cancelar(ID_DE_PRUEBA);
}

/** Si el sistema de verdad lo tiene anotado, que es lo que hay que comprobar. */
export async function elSistemaLoTiene(): Promise<boolean> {
  return (await programadas()).includes(ID_DE_PRUEBA);
}

/** El texto exacto que se va a ver, para poder compararlo con lo que llegue. */
export function textoDeLaPrueba() {
  return textoDelAviso({ caso: 'sin-materia' });
}

export function aLaHora(momento: Date): string {
  return `${String(momento.getHours()).padStart(2, '0')}:${String(momento.getMinutes()).padStart(2, '0')}`;
}
