import { esAccionAviso, type AccionAviso } from './recordatorios';

/**
 * La respuesta que llegó desde una notificación del sistema.
 *
 * Llega por dos puertas, según la app estuviera abierta o cerrada: por
 * `postMessage` del service worker, o por la dirección con la que se abrió la
 * ventana (`/?hacer=vino&sesion=...`). Las dos terminan acá para que la app
 * tenga una sola forma de contestar.
 *
 * Nada de lo que viene en la dirección se usa sin mirarlo: `hacer` tiene que
 * ser una de las cuatro respuestas conocidas, y la sesión tiene que existir en
 * los datos. Una dirección se escribe a mano, se comparte y se guarda en el
 * historial; tratarla como una orden sería el único lugar de la app donde algo
 * de afuera toca los datos.
 */
export interface Pedido {
  accion: AccionAviso | null;
  sesion: string | null;
}

/** Hasta cuánto puede medir un id de sesión. Lo demás no se mira siquiera. */
const TOPE_ID = 64;

export function leerPedido(busqueda: string): Pedido {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(busqueda);
  } catch {
    return { accion: null, sesion: null };
  }

  const hacer = params.get('hacer') ?? '';
  const sesion = params.get('sesion') ?? '';

  return {
    accion: esAccionAviso(hacer) ? hacer : null,
    sesion: sesion && sesion.length <= TOPE_ID ? sesion : null,
  };
}

/**
 * Saca los parámetros de la dirección sin recargar ni agregar una entrada al
 * historial. Si no se limpian, recargar la página vuelve a aplicar la
 * respuesta —marcar dos veces "vino" la desmarca— y el botón "atrás" también.
 */
export function limpiarPedido(): void {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('hacer') && !url.searchParams.has('sesion')) return;
    url.searchParams.delete('hacer');
    url.searchParams.delete('sesion');
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* Sin history API la app funciona igual; solo queda la dirección sucia. */
  }
}
