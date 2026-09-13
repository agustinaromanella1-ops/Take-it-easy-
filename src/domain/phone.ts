import parsePhoneNumberFromString, {
  AsYouType,
  getCountryCallingCode,
  type CountryCode,
} from 'libphonenumber-js';

export const DEFAULT_COUNTRY: CountryCode = 'AR';

/** Países que ofrecemos en el selector, con Argentina primero. */
export const COMMON_COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: 'AR', label: 'Argentina' },
  { code: 'UY', label: 'Uruguay' },
  { code: 'CL', label: 'Chile' },
  { code: 'BR', label: 'Brasil' },
  { code: 'PY', label: 'Paraguay' },
  { code: 'BO', label: 'Bolivia' },
  { code: 'PE', label: 'Perú' },
  { code: 'CO', label: 'Colombia' },
  { code: 'MX', label: 'México' },
  { code: 'ES', label: 'España' },
  { code: 'US', label: 'Estados Unidos' },
];

export const callingCode = (country: CountryCode): string =>
  `+${getCountryCallingCode(country)}`;

export interface ParsedPhone {
  ok: boolean;
  /** E.164 canónico, ej "+5491112345678". Null si no se pudo parsear. */
  e164: string | null;
  /** Cómo mostrarlo en pantalla. */
  display: string;
  /** True si tuvimos que asumir que era un celular argentino y agregar el 9. */
  assumedArgentineMobile: boolean;
}

/**
 * Argentina es el caso borde clásico: WhatsApp identifica a los celulares como
 * +54 9 <área> <número>, pero la gente escribe el número sin el 9 (y a veces con
 * un 15 en el medio). libphonenumber resuelve el 15, pero un número escrito
 * "1123456789" parsea como fijo. Como WhatsApp solo existe en celulares,
 * cuando vemos un +54 sin el 9 lo agregamos y avisamos en la UI.
 */
export function normalizeArgentine(e164: string): {
  e164: string;
  assumed: boolean;
} {
  if (!e164.startsWith('+54')) return { e164, assumed: false };
  const rest = e164.slice(3);
  if (rest.startsWith('9')) return { e164, assumed: false };
  // Un fijo argentino tiene 10 dígitos después del +54; un celular, 11 (con el 9).
  if (rest.length === 10) return { e164: `+549${rest}`, assumed: true };
  return { e164, assumed: false };
}

export function parsePhone(
  raw: string,
  country: CountryCode = DEFAULT_COUNTRY,
): ParsedPhone {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, e164: null, display: '', assumedArgentineMobile: false };
  }

  const parsed = parsePhoneNumberFromString(trimmed, country);
  if (!parsed || !parsed.isValid()) {
    return {
      ok: false,
      e164: null,
      display: trimmed,
      assumedArgentineMobile: false,
    };
  }

  const { e164, assumed } = normalizeArgentine(parsed.number);
  return {
    ok: true,
    e164,
    display: parsed.formatInternational(),
    assumedArgentineMobile: assumed,
  };
}

/** Formatea mientras se escribe, para que el input no se sienta un formulario. */
export function formatAsYouType(
  raw: string,
  country: CountryCode = DEFAULT_COUNTRY,
): string {
  return new AsYouType(country).input(raw);
}

/** Los links de WhatsApp llevan los dígitos pelados, sin el "+". */
export function toWhatsAppDigits(e164: string): string {
  return e164.replace(/[^\d]/g, '');
}

/** Etiqueta corta para la lista: el nombre si lo hay, si no el número. */
export function displayName(
  contactName: string | null,
  e164: string,
): string {
  if (contactName && contactName.trim()) return contactName.trim();
  const parsed = parsePhoneNumberFromString(e164);
  return parsed ? parsed.formatInternational() : e164;
}
