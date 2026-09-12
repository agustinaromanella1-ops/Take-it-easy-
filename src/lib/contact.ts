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
