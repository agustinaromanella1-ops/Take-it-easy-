/**
 * Enlaces para escribirle al paciente por WhatsApp.
 *
 * wa.me necesita el número en formato internacional y solo dígitos: sin `+`,
 * espacios, guiones ni paréntesis. Un número copiado de la agenda del teléfono
 * casi nunca viene así.
 */

/**
 * Normaliza un teléfono a solo dígitos, aplicando el código de país cuando el
 * número parece local. `defaultCountry` es el prefijo sin `+` (54 = Argentina).
 *
 * Devuelve `null` si no queda un número plausible: es preferible esconder el
 * botón a abrir WhatsApp con un número roto.
 */
export function normalizePhone(raw: string, defaultCountry = '54'): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;

  const hadPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (digits.length < 6) return null;

  // Con "+" el número ya viene completo; se respeta tal cual.
  if (hadPlus) return digits;

  // 00 al principio es el prefijo internacional en formato viejo.
  if (digits.startsWith('00')) return digits.slice(2);

  if (digits.startsWith(defaultCountry) && digits.length > defaultCountry.length + 6) {
    return digits;
  }

  // Número local: se saca el 0 de larga distancia y el 15 de celular, que no
  // van en el formato internacional argentino.
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (defaultCountry === '54' && digits.length > 10 && digits.slice(-10, -8) === '15') {
    digits = digits.slice(0, -10) + digits.slice(-8);
  }
  return `${defaultCountry}${digits}`;
}

/** Enlace de WhatsApp, o `null` si el teléfono no sirve. */
export function whatsappLink(phone: string, message = '', defaultCountry = '54'): string | null {
  const number = normalizePhone(phone, defaultCountry);
  if (!number) return null;
  const text = message.trim() === '' ? '' : `?text=${encodeURIComponent(message)}`;
  return `https://wa.me/${number}${text}`;
}

/* ------------------------------------------------------------------
   Plantillas de mensaje
   ------------------------------------------------------------------ */

export type PlantillaId = 'recordatorio' | 'confirmar' | 'reprogramar' | 'cobro' | 'saludo';

export interface Plantilla {
  id: PlantillaId;
  etiqueta: string;
  /** Si necesita una sesión concreta para tener sentido. */
  necesitaSesion: boolean;
}

export const PLANTILLAS: Plantilla[] = [
  { id: 'recordatorio', etiqueta: 'Recordar el turno', necesitaSesion: true },
  { id: 'confirmar', etiqueta: 'Pedir confirmación', necesitaSesion: true },
  { id: 'reprogramar', etiqueta: 'Reprogramar', necesitaSesion: true },
  { id: 'cobro', etiqueta: 'Recordar un pago', necesitaSesion: false },
  { id: 'saludo', etiqueta: 'Solo saludar', necesitaSesion: false },
];

/**
 * Minúscula inicial. Los días de la semana van en minúscula en español, pero
 * en pantalla se muestran capitalizados porque encabezan una línea. Dentro de
 * una frase —"te recuerdo nuestra sesión el jueves"— hay que devolverlos.
 */
function enMinuscula(texto: string): string {
  return texto.charAt(0).toLowerCase() + texto.slice(1);
}

/** El nombre con el que uno se dirige a alguien: el de pila. */
export function nombreDePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/**
 * El texto que se abre ya escrito en WhatsApp.
 *
 * Son borradores, no mensajes automáticos: WhatsApp los muestra en el campo de
 * texto y recién se envían si la persona toca enviar. Esa diferencia importa
 * —mandar solo un recordatorio a un paciente sin leerlo sería imprudente— y es
 * también la razón de que el tono quede llano y sin firmar: cada una lo
 * termina como escribe.
 */
export function textoPlantilla(
  id: PlantillaId,
  datos: { nombre: string; cuando?: string; hora?: string; monto?: string },
): string {
  const quien = nombreDePila(datos.nombre);
  const cuando = datos.cuando ? enMinuscula(datos.cuando) : '';
  const hora = datos.hora ?? '';
  const momento = cuando && hora ? `el ${cuando} a las ${hora}` : cuando ? `el ${cuando}` : '';

  switch (id) {
    case 'recordatorio':
      return `Hola ${quien}, ¿cómo estás? Te recuerdo nuestra sesión ${momento}. ¡Nos vemos!`;
    case 'confirmar':
      return `Hola ${quien}, ¿cómo estás? ¿Me confirmás la sesión ${momento}?`;
    case 'reprogramar':
      return `Hola ${quien}, ¿cómo estás? Necesito mover la sesión ${momento}. ¿Qué día te vendría bien?`;
    case 'cobro':
      return datos.monto
        ? `Hola ${quien}, ¿cómo estás? Te paso el recordatorio del saldo pendiente: ${datos.monto}. ¡Gracias!`
        : `Hola ${quien}, ¿cómo estás? Te paso el recordatorio del saldo pendiente. ¡Gracias!`;
    case 'saludo':
      return `Hola ${quien}, ¿cómo estás?`;
  }
}
