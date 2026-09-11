/**
 * Lo que viaja de vuelta al teléfono: una línea de JSON por evento.
 *
 * Se eligió así y no texto pelado porque un rechazo o una falla tienen que
 * poder llegar en el medio del texto, y no hay forma de distinguirlos si lo
 * único que viaja son caracteres sueltos.
 *
 * La otra mitad —leer estas líneas— está en `src/asistente/protocolo.ts` de
 * la app. Son dos paquetes separados, así que las quince líneas se repiten en
 * vez de arrastrar una dependencia entre los dos.
 */

export type Evento =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fin' }
  | { tipo: 'error'; motivo: Motivo; mensaje: string };

export type Motivo = 'rechazo' | 'limite' | 'sin-clave' | 'pedido' | 'falla';

export function aLinea(evento: Evento): string {
  return `${JSON.stringify(evento)}\n`;
}

/** Lo que se le muestra a la docente. El detalle técnico queda en el registro. */
export const MENSAJES: Record<Motivo, string> = {
  rechazo: 'El asistente no pudo responder a esta consulta. Probá escribirla de otra manera.',
  limite: 'Hiciste muchas consultas seguidas. Probá de nuevo en un rato.',
  'sin-clave': 'El asistente no está configurado.',
  pedido: 'La consulta no llegó bien. Probá de nuevo.',
  falla: 'No se pudo hablar con el asistente. Fijate si tenés internet y probá de nuevo.',
};
