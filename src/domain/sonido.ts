/**
 * Cómo suena el aviso.
 *
 * En Android el sonido es una propiedad del **canal**, no de la notificación,
 * y Android congela la configuración de un canal apenas se crea: volver a
 * declararlo con otro sonido no cambia nada. Por eso cada opción tiene su
 * propio canal, y cambiar de opción significa agendar en otro canal —no
 * editar el que ya existe—.
 */

export type Sonido = 'predeterminado' | 'vibracion' | 'silencioso';

export const SONIDOS: Sonido[] = ['predeterminado', 'vibracion', 'silencioso'];

export const SONIDO_LABELS: Record<Sonido, string> = {
  predeterminado: 'Con sonido',
  vibracion: 'Solo vibrar',
  silencioso: 'En silencio',
};

export const SONIDO_DETALLES: Record<Sonido, string> = {
  predeterminado: 'Suena y vibra, como una notificación normal.',
  vibracion: 'Vibra sin sonar. Útil si programás muchos seguidos.',
  silencioso: 'Aparece en la pantalla sin sonar ni vibrar.',
};

/**
 * Un canal por opción. Los ids no se reutilizan entre opciones justamente
 * porque Android no deja cambiarle el sonido a un canal existente.
 */
export const CANALES: Record<Sonido, string> = {
  predeterminado: 'avisos-con-sonido',
  vibracion: 'avisos-vibracion',
  silencioso: 'avisos-silencio',
};

/**
 * El canal de la primera versión, que se creó sin sonido declarado. Se borra
 * al actualizar para que no quede un duplicado muerto en los ajustes del
 * sistema, donde la usuaria vería dos entradas y no sabría cuál toca.
 */
export const CANAL_VIEJO = 'scheduled-messages';

export function esSonido(valor: unknown): valor is Sonido {
  return typeof valor === 'string' && (SONIDOS as string[]).includes(valor);
}
