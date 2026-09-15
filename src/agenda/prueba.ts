import { textoDelAviso } from './aviso';
import { guardarPreferencia, leerPreferencia } from '../datos/preferencias';
import {
  cancelar,
  hayNotificaciones,
  estaEnLaBarra,
  mostrarAhora,
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
 * Qué pasó con el aviso de prueba, mirado después de cerrar la app.
 *
 * Lo único que se puede afirmar es lo positivo: si el aviso está en la barra de
 * notificaciones, llegó. Lo otro no se puede afirmar, y conviene no inventarlo:
 * el plugin no borra el aviso de su registro cuando se dispara, y su idea de
 * «ya se disparó» es sólo comparar la hora con el reloj. Preguntarle eso
 * devuelve lo mismo haya sonado o no, así que una pantalla que lo usara para
 * decir «la alarma no se disparó» mentiría la mitad de las veces.
 *
 * Por eso `no-aparece` dice lo que se ve y no la causa: pasó la hora y el aviso
 * no está en la barra. Si no lo borró ella, no llegó.
 */
export type QuePaso = 'esperando' | 'llego' | 'no-aparece' | 'sin-prueba';

export async function quePasoConLaPrueba(ahora = new Date()): Promise<QuePaso> {
  if (!hayNotificaciones()) return 'sin-prueba';

  const programadaPara = await leerPreferencia<number>(CUANDO_LA_PRUEBA);
  if (programadaPara === undefined) return 'sin-prueba';

  if (await estaEnLaBarra(ID_DE_PRUEBA)) return 'llego';
  return programadaPara > ahora.getTime() ? 'esperando' : 'no-aparece';
}

/** El texto exacto que se va a ver, para poder compararlo con lo que llegue. */
export function textoDeLaPrueba() {
  return textoDelAviso({ caso: 'sin-materia' });
}

export function aLaHora(momento: Date): string {
  return `${String(momento.getHours()).padStart(2, '0')}:${String(momento.getMinutes()).padStart(2, '0')}`;
}
