import { toWhatsAppDigits } from './phone';

/**
 * WhatsApp no deja que una app de terceros mande mensajes sola desde una cuenta
 * personal, así que el envío es siempre "listo para enviar": abrimos el chat con
 * el texto ya cargado y la usuaria toca enviar. Estas son las dos formas de
 * abrirlo; probamos primero el esquema nativo y caemos al link web.
 */
export function whatsappSchemeUrl(e164: string, body: string): string {
  const phone = toWhatsAppDigits(e164);
  return `whatsapp://send?phone=${phone}&text=${encodeURIComponent(body)}`;
}

export function whatsappWebUrl(e164: string, body: string): string {
  const phone = toWhatsAppDigits(e164);
  return `https://wa.me/${phone}?text=${encodeURIComponent(body)}`;
}
