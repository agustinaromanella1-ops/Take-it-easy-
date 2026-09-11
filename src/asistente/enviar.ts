import { tokenDeInstalacion } from './instalacion';
import { leerEventos } from './protocolo';

/**
 * El único pedido que la app hace por red. Lo que se manda es el texto que la
 * docente acaba de ver en la pantalla de revisión, ya filtrado: acá no se
 * anonimiza nada, y por eso este archivo no conoce la sesión de alias.
 */

const URL_BASE = import.meta.env.VITE_ASISTENTE_URL?.replace(/\/+$/, '');

/** Sin dirección configurada, el asistente no está conectado y la app lo dice. */
export const hayAsistente = typeof URL_BASE === 'string' && URL_BASE !== '';

const SIN_RED = 'No se pudo hablar con el asistente. Fijate si tenés internet y probá de nuevo.';

export interface Envio {
  /** Nulo si terminó bien. */
  error: string | null;
}

export async function preguntar(
  texto: string,
  alTexto: (acumulado: string) => void,
  señal?: AbortSignal,
): Promise<Envio> {
  if (!URL_BASE) return { error: 'El asistente no está conectado todavía.' };

  let respuesta: Response;
  try {
    respuesta = await fetch(`${URL_BASE}/consulta`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-instalacion': await tokenDeInstalacion(),
      },
      body: JSON.stringify({ texto }),
      signal: señal,
    });
  } catch {
    return { error: SIN_RED };
  }

  if (!respuesta.ok || !respuesta.body) return { error: SIN_RED };

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  let acumulado = '';

  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;

      const leido = leerEventos(pendiente, decodificador.decode(value, { stream: true }));
      pendiente = leido.pendiente;

      for (const evento of leido.eventos) {
        if (evento.tipo === 'texto') {
          acumulado += evento.texto;
          alTexto(acumulado);
        } else if (evento.tipo === 'error') {
          return { error: evento.mensaje };
        } else if (evento.tipo === 'fin') {
          return { error: null };
        }
      }
    }
  } catch {
    return { error: SIN_RED };
  }

  // Se cortó sin decir ni fin ni error: si algo llegó, sirve; si no, falló.
  return { error: acumulado === '' ? SIN_RED : null };
}
