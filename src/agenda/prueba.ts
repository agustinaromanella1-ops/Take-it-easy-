import { textoDelAviso } from './aviso';
import { guardarPreferencia, leerPreferencia } from '../datos/preferencias';
import {
  cancelar,
  hayNotificaciones,
  mostrarAhora,
  paraCuandoLoTiene,
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

/** Otro id propio, para que la prueba inmediata no pise a la programada. */
const ID_INMEDIATO = 2_000_000_002;

/** Un minuto alcanza para cerrar la app, y no es tanto como para dudar. */
const ESPERA_MINUTOS = 1;

export type Resultado =
  | { estado: 'programado'; hora: string }
  | { estado: 'mostrado' }
  | { estado: 'sin-permiso' }
  | { estado: 'sin-notificaciones' };

export async function probarElAviso(ahora = new Date()): Promise<Resultado> {
  if (!hayNotificaciones()) return { estado: 'sin-notificaciones' };

  const hay = (await tenemosPermiso()) || (await pedirPermiso());
  if (!hay) return { estado: 'sin-permiso' };

  const cuando = new Date(ahora.getTime() + ESPERA_MINUTOS * 60 * 1000);
  await programar(ID_DE_PRUEBA, { caso: 'sin-materia' }, cuando);
  await guardarPreferencia(CUANDO_LA_PRUEBA, cuando.getTime());

  return { estado: 'programado', hora: aLaHora(cuando) };
}

/**
 * El mismo aviso pero ahora mismo. Es la prueba que parte el problema en dos:
 *
 * - Si éste llega y el de un minuto no, el teléfono muestra las notificaciones
 *   de la app y lo que falla es la alarma que la despierta después. En un
 *   Xiaomi eso suele ser el ahorro de batería o el inicio automático.
 * - Si éste tampoco llega, no es cuestión de alarmas: el teléfono no está
 *   mostrando las notificaciones de la app.
 *
 * Sin esta distinción, «no me llega el aviso» son dos problemas distintos con
 * el mismo síntoma, y se termina tocando ajustes al azar.
 */
export async function probarAhora(): Promise<Resultado> {
  if (!hayNotificaciones()) return { estado: 'sin-notificaciones' };

  const hay = (await tenemosPermiso()) || (await pedirPermiso());
  if (!hay) return { estado: 'sin-permiso' };

  await mostrarAhora(ID_INMEDIATO, { caso: 'sin-materia' });
  return { estado: 'mostrado' };
}

/** Si ya no lo espera más. */
export async function cancelarLaPrueba(): Promise<void> {
  await cancelar(ID_DE_PRUEBA);
  await guardarPreferencia(CUANDO_LA_PRUEBA, undefined);
}

/** Si el sistema de verdad lo tiene anotado, que es lo que hay que comprobar. */
export async function elSistemaLoTiene(): Promise<boolean> {
  return (await programadas()).includes(ID_DE_PRUEBA);
}

/**
 * Cuándo se programó la última prueba. Se guarda porque la pregunta que
 * interesa hay que hacerla *después* de cerrar la app, y para entonces el
 * estado de la pantalla ya no existe.
 */
const CUANDO_LA_PRUEBA = 'prueba-de-aviso';

/**
 * Qué pasó con el aviso de prueba, mirado después. Es la pregunta que separa
 * las dos causas que quedan cuando el aviso inmediato sí llega:
 *
 * - `no-sono`: Android lo sigue teniendo anotado y la hora ya pasó. La alarma
 *   no se disparó. Eso no lo decide la app: lo decide el ahorro de batería del
 *   teléfono, que la mató antes.
 * - `se-disparo`: Android ya no lo tiene, así que lo disparó. Si no se vio, el
 *   aviso se mostró y se fue.
 * - `esperando`: todavía no es la hora.
 * - `sin-prueba`: no hay ninguna programada.
 */
export type QuePaso = 'esperando' | 'no-sono' | 'se-disparo' | 'sin-prueba';

export async function quePasoConLaPrueba(ahora = new Date()): Promise<QuePaso> {
  if (!hayNotificaciones()) return 'sin-prueba';

  // Sin esto, "Android no lo tiene anotado" y "nunca se programó una prueba"
  // se ven iguales, y la pantalla diría que se disparó un aviso que no existió.
  const programadaPara = await leerPreferencia<number>(CUANDO_LA_PRUEBA);
  if (programadaPara === undefined) return 'sin-prueba';

  const cuando = await paraCuandoLoTiene(ID_DE_PRUEBA);
  if (!cuando) return programadaPara > ahora.getTime() ? 'sin-prueba' : 'se-disparo';
  return cuando.getTime() > ahora.getTime() ? 'esperando' : 'no-sono';
}

/** El texto exacto que se va a ver, para poder compararlo con lo que llegue. */
export function textoDeLaPrueba() {
  return textoDelAviso({ caso: 'sin-materia' });
}

export function aLaHora(momento: Date): string {
  return `${String(momento.getHours()).padStart(2, '0')}:${String(momento.getMinutes()).padStart(2, '0')}`;
}
