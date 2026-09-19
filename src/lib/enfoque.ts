/**
 * Modo enfoque: el inicio con lo que sigue y una cosa por hacer, y nada más.
 *
 * El inicio completo está bien para mirar cómo viene el mes. Pero cuando hay
 * quince minutos entre paciente y paciente, los números del mes, la meta y la
 * lista de quién debe no ayudan: compiten. Este modo los saca de la vista sin
 * borrar nada —se vuelven con un toque— para que quede solo aquello sobre lo
 * que se puede hacer algo ahora.
 *
 * Vive en el dispositivo y no en los datos, como el tema: es cómo se mira la
 * app, no información de trabajo, y no tiene por qué viajar en la copia de
 * seguridad.
 */

const CLAVE = 'pipicucu:enfoque';

export function leerEnfoque(): boolean {
  try {
    return localStorage.getItem(CLAVE) === 'si';
  } catch {
    return false;
  }
}

export function guardarEnfoque(activo: boolean): void {
  try {
    if (activo) localStorage.setItem(CLAVE, 'si');
    else localStorage.removeItem(CLAVE);
  } catch {
    /* Sin almacenamiento, vuelve al inicio completo al recargar. */
  }
}
