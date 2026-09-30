import type { Cents, Moneda } from '../types';

/**
 * Toda la plata vive como entero en centavos. Estas funciones son el único
 * puente entre ese entero y el texto que se ve o se escribe. Vienen de Pipí
 * Cucú, donde ya están probadas con montos argentinos.
 */

/** Convierte lo escrito ("1.500,50", "$1500", "1500.5") a centavos. */
export function parseMoney(input: string): Cents | null {
  const raw = input.trim();
  if (raw === '') return null;

  let s = raw.replace(/[^\d,.-]/g, '');
  if (s === '' || s === '-') return null;

  const negative = s.startsWith('-');
  if (negative) s = s.slice(1);

  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');

  // El separador decimal es el ÚLTIMO de los dos que aparezca; el otro es de
  // miles. Así "1.500,50" (es-AR) y "1,500.50" (en-US) dan lo mismo.
  let decimalSep = '';
  if (lastComma !== -1 && lastDot !== -1) {
    decimalSep = lastComma > lastDot ? ',' : '.';
  } else if (lastComma !== -1) {
    // Una sola coma: es decimal solo si deja 1 o 2 dígitos a la derecha.
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
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export const SIMBOLO: Record<Moneda, string> = { ARS: '$', USD: 'US$' };

/**
 * 150050 → "$ 1.500,50"; 150000 → "$ 1.500"; en dólares, "US$ 1.500".
 *
 * Los centavos se omiten cuando son cero: la mayoría de los montos son
 * redondos y arrastrar ",00" agrega ruido en pantallas chicas.
 */
export function formatMoney(cents: Cents, moneda: Moneda = 'ARS'): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const units = Math.floor(abs / 100);
  const rest = abs % 100;
  const grouped = units.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = rest === 0 ? '' : `,${rest.toString().padStart(2, '0')}`;
  return `${negative ? '−' : ''}${SIMBOLO[moneda]} ${grouped}${decimals}`;
}

/** Centavos → lo que va dentro de un `<input>` de edición ("1500,50"). */
export function centsToInput(cents: Cents | null): string {
  if (cents === null || cents === 0) return '';
  const abs = Math.abs(cents);
  const units = Math.floor(abs / 100);
  const rest = abs % 100;
  return `${cents < 0 ? '-' : ''}${units}${rest ? `,${rest.toString().padStart(2, '0')}` : ''}`;
}

/** Suma segura de centavos. */
export function sumar(importes: readonly Cents[]): Cents {
  let total = 0;
  for (const i of importes) total += i;
  return total;
}
