/**
 * Lo que llega del proxy: una línea de JSON por evento.
 *
 * La otra mitad —escribir estas líneas— está en `servidor/src/protocolo.ts`.
 * Son dos paquetes separados, así que las quince líneas se repiten en vez de
 * arrastrar una dependencia entre los dos.
 */

export type Evento =
  | { tipo: 'texto'; texto: string }
  | { tipo: 'fin' }
  | { tipo: 'error'; motivo: string; mensaje: string };

export interface Leidos {
  eventos: Evento[];
  /** Lo que quedó a medio llegar, para el próximo trozo. */
  pendiente: string;
}

/**
 * Un trozo de la red puede cortar una línea por la mitad, así que lo último
 * sin `\n` se guarda y se completa con lo que venga.
 */
export function leerEventos(pendiente: string, trozo: string): Leidos {
  const partes = (pendiente + trozo).split('\n');
  const resto = partes.pop() ?? '';
  const eventos: Evento[] = [];

  for (const linea of partes) {
    if (linea.trim() === '') continue;
    try {
      const evento = JSON.parse(linea) as Evento;
      if (evento && typeof evento.tipo === 'string') eventos.push(evento);
    } catch {
      // Una línea rota no puede tirar abajo lo que ya llegó bien.
    }
  }

  return { eventos, pendiente: resto };
}
