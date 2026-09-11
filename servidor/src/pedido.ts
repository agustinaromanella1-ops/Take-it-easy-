/**
 * Lo que hace falta para decidir si un pedido se atiende, aparte del servidor
 * para poder probarlo sin levantar nada.
 */

/** Una consulta más larga que esto no es una consulta: es un archivo pegado. */
export const LARGO_MAXIMO = 8000;

export type Pedido = { ok: true; texto: string; instalacion: string } | { ok: false };

export function leerPedido(cuerpo: string, instalacion: string | undefined): Pedido {
  if (!instalacion || instalacion.length < 8 || instalacion.length > 128) return { ok: false };

  let crudo: unknown;
  try {
    crudo = JSON.parse(cuerpo);
  } catch {
    return { ok: false };
  }

  const texto = (crudo as { texto?: unknown } | null)?.texto;
  if (typeof texto !== 'string') return { ok: false };

  const limpio = texto.trim();
  if (limpio === '' || limpio.length > LARGO_MAXIMO) return { ok: false };

  return { ok: true, texto: limpio, instalacion };
}
