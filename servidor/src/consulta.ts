import type Anthropic from '@anthropic-ai/sdk';

import { SISTEMA } from './sistema.js';

/**
 * La llamada al modelo. Streaming, para que el texto aparezca de a poco en el
 * teléfono en vez de dejar la pantalla quieta.
 */

const MODELO = 'claude-opus-5';

/**
 * Redactar una observación o un mensaje es trabajo corto. El tope existe para
 * que una consulta rara no se lleve puesta la cuenta, no para recortar
 * respuestas: 4096 tokens son varias pantallas de texto.
 */
const MAXIMO_DE_SALIDA = 4096;

export interface Resultado {
  /** Verdadero si el clasificador rechazó el pedido y no hay texto útil. */
  rechazado: boolean;
  tokensEntrada: number;
  tokensSalida: number;
}

export async function responder(
  cliente: Anthropic,
  texto: string,
  alTexto: (trozo: string) => void,
): Promise<Resultado> {
  const stream = cliente.beta.messages.stream({
    model: MODELO,
    max_tokens: MAXIMO_DE_SALIDA,
    system: SISTEMA,
    // Pensar cuánto haga falta, con esfuerzo bajo: redactar es trabajo corto y
    // el esfuerzo alto cuesta más sin mejorar el resultado. Se sube si se mide
    // que hace falta, y por caso de uso.
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    // Si el clasificador rechaza el pedido, el servidor lo reintenta solo en
    // otro modelo antes de contestar: un rechazo no deja la pantalla vacía.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    messages: [{ role: 'user', content: texto }],
  });

  stream.on('text', alTexto);
  const final = await stream.finalMessage();

  // El motivo de corte se lee antes que el contenido: con un rechazo llega una
  // respuesta bien formada y sin texto útil.
  return {
    rechazado: final.stop_reason === 'refusal',
    tokensEntrada: final.usage.input_tokens,
    tokensSalida: final.usage.output_tokens,
  };
}
