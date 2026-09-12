import type { Cents } from '../types';

/**
 * Todo el dinero de la app vive como entero en centavos. Estas funciones son el
 * único puente entre ese entero y el texto que ve o escribe la usuaria.
 */

/** Convierte lo que escribió la usuaria ("1.500,50", "$1500", "1500.5") a centavos. */
export function parseMoney(input: string): Cents | null {
  const raw = input.trim();
  if (raw === '') return null;

  // Quita todo lo que no sea dígito, coma, punto o signo menos.
  let s = raw.replace(/[^\d,.-]/g, '');
  if (s === '' || s === '-') return null;

  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  // El separador decimal es el ÚLTIMO de los dos que aparezca; el otro es de miles.
  // Así "1.500,50" (es-AR) y "1,500.50" (en-US) dan el mismo resultado.
  let decimalSep = '';
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    // Una sola coma: es decimal solo si deja 1 o 2 dígitos a la derecha.
    // "1,50" es un peso con cincuenta; "1,500" son mil quinientos.
    decimalSep = s.length - lastComma - 1 <= 2 ? ',' : '';
  } else if (lastDot !== -1) {
    decimalSep = s.length - lastDot - 1 <= 2 ? '.' : '';
  }

  let intPart: string;
  let decPart: string;
  if (decimalSep === '') {
    intPart = s.replace(/[,.]/g, '');
    decPart = '';
  } else {
    const idx = s.lastIndexOf(decimalSep);
    intPart = s.slice(0, idx).replace(/[,.]/g, '');
    decPart = s.slice(idx + 1).replace(/[,.]/g, '');
  }

  if (intPart === '' && decPart === '') return null;
  if (!/^\d*$/.test(intPart) || !/^\d*$/.test(decPart)) return null;

  const cents = Number(intPart || '0') * 100 + Number(decPart.padEnd(2, '0').slice(0, 2) || '0');
  if (!Number.isFinite(cents)) return null;
  return negative ? -cents : cents;
}

/**
 * Formatea centavos para mostrar: 150050 -> "$ 1.500,50", 150000 -> "$ 1.500".
 *
 * Los centavos se omiten cuando son cero. En honorarios de consultorio la gran
 * mayoría de los montos son redondos, y arrastrar ",00" en cada cifra agrega
 * ruido y desborda las tarjetas en pantallas chicas.
 */
export function formatMoney(cents: Cents, currency = '$'): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const units = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = rest === 0 ? '' : `,${rest.toString().padStart(2, '0')}`;
  return `${negative ? '-' : ''}${currency} ${grouped}${decimals}`;
}

/** Centavos -> el string que va dentro de un `<input>` de edición ("1500.50"). */
export function centsToInput(cents: Cents): string {
  if (cents === 0) return '';
  const abs = Math.abs(cents);
  return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)}.${(abs % 100).toString().padStart(2, '0')}`;
}
