/**
 * Registro operativo. **Nunca el cuerpo del pedido ni el de la respuesta.**
 *
 * Esto se decide ahora y se hace estructural —el registro no recibe el texto,
 * así que no puede escribirlo aunque alguien se lo pida— porque un log de
 * cuerpos agregado más tarde "para depurar" es exactamente la forma en que se
 * filtra un texto.
 */

export interface Entrada {
  /** Instante, epoch en milisegundos. */
  momento: number;
  estado: number;
  latenciaMs: number;
  /** Token de instalación, anónimo y generado en el dispositivo. */
  instalacion: string;
  tokensEntrada?: number;
  tokensSalida?: number;
  /** Una palabra, no el texto: "rechazo", "sin-clave", "limite". */
  motivo?: string;
}

/**
 * Las únicas claves que salen. Cualquier otra cosa que llegue en la entrada
 * —por un descuido, por un refactor— se queda afuera en vez de imprimirse.
 */
const PERMITIDAS = [
  'momento',
  'estado',
  'latenciaMs',
  'instalacion',
  'tokensEntrada',
  'tokensSalida',
  'motivo',
] as const satisfies readonly (keyof Entrada)[];

export function aLinea(entrada: Entrada): string {
  const limpia: Record<string, unknown> = {};
  for (const clave of PERMITIDAS) {
    const valor = entrada[clave];
    if (valor !== undefined) limpia[clave] = valor;
  }
  return JSON.stringify(limpia);
}

export function registrar(entrada: Entrada, escribir = console.log): void {
  escribir(aLinea(entrada));
}
