import type { Cents, Cuenta, DateISO, Moneda, TipoMovimiento } from '../../types';
import { addDays, isValidISODate } from '../dates';
import { parseMoney } from '../money';
import { normalizar } from '../finanzas/duplicados';
import { categoriaPara } from './categorias';

/**
 * Entender una frase como "gasté 8.500 en súper con débito".
 *
 * Es un analizador de reglas, sin IA y sin red: lo mismo entra, lo mismo sale,
 * y se puede probar. Lo que no entiende queda vacío; no adivina. La pantalla
 * siempre muestra lo que entendió antes de guardar.
 */

export interface Analisis {
  tipo: TipoMovimiento | null;
  importe: Cents | null;
  moneda: Moneda;
  cuentaId: string | null;
  cuentaDestinoId: string | null;
  categoria: string;
  comercio: string;
  fecha: DateISO | null;
  cuotas: number;
}

const NUMEROS: Record<string, number> = {
  un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8,
  nueve: 9, diez: 10, once: 11, doce: 12, dieciocho: 18, veinticuatro: 24,
};

/** Palabras que conectan y no dicen nada del movimiento. */
const RELLENO = new Set([
  'gaste', 'gasto', 'pague', 'pago', 'compre', 'compra', 'cobre', 'cobro', 'me', 'en', 'con', 'de', 'del', 'la', 'el', 'los',
  'las', 'lo', 'por', 'un', 'una', 'y', 'a', 'al', 'para', 'que', 'hoy', 'ayer', 'anteayer', 'pase', 'transferi', 'movi',
  'pesos', 'peso', 'mango', 'mangos', 'dolares', 'dolar', 'usd', 'verdes', 'plata', 'devolvieron', 'depositaron',
  'pagaron', 'entro', 'entraron', 'ingreso', 'devolucion', 'reintegro', 'reembolso', 'tarjeta', 'resumen',
  'efectivo', 'cash', 'debito', 'credito', 'cuotas', 'cuota', 'sin', 'interes', 'mil', 'lucas', 'luca', 'k', 'palo', 'palos', 'millon', 'millones',
]);

interface Trozo {
  inicio: number;
  fin: number;
}

/** Busca el importe: "8.500", "8,5k", "2 lucas", "1 palo", "3 mil", "$ 4.500,50". */
function buscarImporte(t: string): { importe: Cents; trozo: Trozo } | null {
  const re =
    /(?:\$|us\$|u\$s)?\s?(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)\s?(k|mil|lucas?|palos?|millon(?:es)?)?(?![\d/])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) {
    const numero = m[1] ?? '';
    const mult = m[2] ?? '';
    const base = parseMoney(numero);
    if (base === null || base <= 0) continue;
    let factor = 1;
    if (mult === 'k' || mult === 'mil' || mult.startsWith('luca')) factor = 1000;
    if (mult.startsWith('palo') || mult.startsWith('millon')) factor = 1_000_000;
    return { importe: Math.round(base * factor), trozo: { inicio: m.index, fin: m.index + m[0].length } };
  }
  return null;
}

function tapar(t: string, trozo: Trozo): string {
  return t.slice(0, trozo.inicio) + ' '.repeat(trozo.fin - trozo.inicio) + t.slice(trozo.fin);
}

function buscarCuotas(t: string): { cuotas: number; trozo: Trozo } | null {
  const m = /(?:en\s+)?(\d{1,2}|[a-z]+)\s+cuotas?(?:\s+sin\s+interes)?/.exec(t);
  if (!m) return null;
  const palabra = m[1] ?? '';
  const n = /^\d+$/.test(palabra) ? Number(palabra) : NUMEROS[palabra];
  if (!n || n < 1 || n > 72) return null;
  return { cuotas: n, trozo: { inicio: m.index, fin: m.index + m[0].length } };
}

function buscarFecha(t: string, hoy: DateISO): { fecha: DateISO; trozo: Trozo } | null {
  let m = /\banteayer\b/.exec(t);
  if (m) return { fecha: addDays(hoy, -2), trozo: { inicio: m.index, fin: m.index + m[0].length } };
  m = /\bayer\b/.exec(t);
  if (m) return { fecha: addDays(hoy, -1), trozo: { inicio: m.index, fin: m.index + m[0].length } };
  m = /\bhoy\b/.exec(t);
  if (m) return { fecha: hoy, trozo: { inicio: m.index, fin: m.index + m[0].length } };
  m = /\b(?:el\s+)?(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(t);
  if (m) {
    const anio = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hoy.slice(0, 4);
    const iso = `${anio}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
    if (isValidISODate(iso)) {
      // Sin año, una fecha "futura" es del año pasado: nadie anota gastos de diciembre en marzo.
      const fecha = !m[3] && iso > hoy ? `${Number(anio) - 1}${iso.slice(4)}` : iso;
      return { fecha, trozo: { inicio: m.index, fin: m.index + m[0].length } };
    }
  }
  return null;
}

interface Mencion {
  cuenta: Cuenta;
  trozo: Trozo;
}

function escapar(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Cuentas nombradas en la frase, por nombre, alias o medio de pago. */
function buscarCuentas(t: string, cuentas: readonly Cuenta[]): Mencion[] {
  const activas = cuentas.filter((c) => !c.archivada);
  const menciones: Mencion[] = [];
  const ocupado = (i: number, f: number) => menciones.some((m) => i < m.trozo.fin && m.trozo.inicio < f);

  // Primero por nombre y alias, de lo más largo a lo más corto: "mercado pago"
  // antes que "pago".
  const nombres = activas
    .flatMap((c) => [c.nombre, ...c.alias].map((n) => ({ c, n: normalizar(n) })))
    .filter((x) => x.n.length >= 2)
    .sort((a, b) => b.n.length - a.n.length);
  for (const { c, n } of nombres) {
    const re = new RegExp(`\\b${escapar(n)}\\b`, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(t))) {
      if (!ocupado(m.index, m.index + n.length)) menciones.push({ cuenta: c, trozo: { inicio: m.index, fin: m.index + n.length } });
    }
  }

  // Después por medio de pago, si hay una sola cuenta de ese tipo (o la primera).
  const medios: [RegExp, Cuenta['tipo']][] = [
    [/\b(efectivo|cash|billete)\b/, 'efectivo'],
    [/\b(debito)\b/, 'banco'],
    [/\b(credito|tarjeta)\b/, 'tarjeta-credito'],
    [/\b(mp|mercadopago|mercado pago|billetera)\b/, 'billetera'],
  ];
  for (const [re, tipo] of medios) {
    const m = re.exec(t);
    if (!m || ocupado(m.index, m.index + m[0].length)) continue;
    const c = activas.find((x) => x.tipo === tipo);
    if (c) menciones.push({ cuenta: c, trozo: { inicio: m.index, fin: m.index + m[0].length } });
  }
  return menciones.sort((a, b) => a.trozo.inicio - b.trozo.inicio);
}

function detectarTipo(t: string, menciones: Mencion[]): TipoMovimiento | null {
  if (/\b(me devolvieron|devolucion|reintegro|reembolso|me reintegraron)\b/.test(t)) return 'devolucion';
  if (/\b(cobre|cobro|me pagaron|me depositaron|entro|entraron|ingreso|sueldo|aguinaldo|honorarios)\b/.test(t)) return 'ingreso';
  if (/\b(pague|pago)\s+(el\s+)?resumen\b|\bpago\s+de\s+(la\s+)?tarjeta\b|\bpague\s+la\s+tarjeta\b/.test(t)) return 'pago-tarjeta';
  // "pagué la visa" (sin "con"): si lo que sigue a pagar es una tarjeta, es su pago.
  const pagoA = /\bpague\s+(?:la|el)\s+(\S+(?:\s\S+)?)/.exec(t);
  if (pagoA && menciones.some((m) => m.cuenta.tipo === 'tarjeta-credito' && m.trozo.inicio >= pagoA.index && m.trozo.inicio <= pagoA.index + pagoA[0].length)) {
    return 'pago-tarjeta';
  }
  if (/\b(pase|transferi|movi)\b/.test(t) && menciones.length >= 2) return 'transferencia';
  return null;
}

/**
 * Minúsculas y sin tildes, pero conservando lo que hace falta para leer
 * importes y fechas: puntos, comas, barras y signos de pesos.
 */
function prepararFrase(frase: string): string {
  return frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9.,/$ ]/g, ' ')
    // Un punto o coma que no está entre dígitos es puntuación, no un número.
    .replace(/(?<!\d)[.,]|[.,](?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function analizar(frase: string, cuentas: readonly Cuenta[], hoy: DateISO): Analisis {
  let t = ` ${prepararFrase(frase)} `;
  const usd = /\b(usd|dolares|dolar|verdes)\b/.test(t) || /us\$|u\$s/.test(t);

  const res: Analisis = {
    tipo: null,
    importe: null,
    moneda: usd ? 'USD' : 'ARS',
    cuentaId: null,
    cuentaDestinoId: null,
    categoria: '',
    comercio: '',
    fecha: null,
    cuotas: 1,
  };

  const f = buscarFecha(t, hoy);
  if (f) {
    res.fecha = f.fecha;
    t = tapar(t, f.trozo);
  }
  const c = buscarCuotas(t);
  if (c) {
    res.cuotas = c.cuotas;
    t = tapar(t, c.trozo);
  }
  const imp = buscarImporte(t);
  if (imp) {
    res.importe = imp.importe;
    t = tapar(t, imp.trozo);
  }

  const menciones = buscarCuentas(t, cuentas).filter((m) => m.cuenta.moneda === res.moneda || !usd);
  res.tipo = detectarTipo(t, menciones) ?? (res.importe !== null ? 'gasto' : null);

  if (res.tipo === 'transferencia') {
    const [a, b] = menciones;
    res.cuentaId = a?.cuenta.id ?? null;
    res.cuentaDestinoId = b?.cuenta.id ?? null;
  } else if (res.tipo === 'pago-tarjeta') {
    const tarjeta = menciones.find((m) => m.cuenta.tipo === 'tarjeta-credito');
    const origen = menciones.find((m) => m.cuenta.tipo !== 'tarjeta-credito');
    res.cuentaDestinoId = tarjeta?.cuenta.id ?? cuentas.find((x) => x.tipo === 'tarjeta-credito' && !x.archivada)?.id ?? null;
    res.cuentaId = origen?.cuenta.id ?? null;
  } else {
    res.cuentaId = menciones[0]?.cuenta.id ?? null;
  }
  for (const m of menciones) t = tapar(t, m.trozo);

  if (res.cuotas > 1) {
    // Las cuotas son cosa de tarjeta de crédito; si la cuenta no lo es, no se inventa.
    const cuenta = cuentas.find((x) => x.id === res.cuentaId);
    if (cuenta && cuenta.tipo !== 'tarjeta-credito') res.cuotas = 1;
  }

  const resto = t
    .split(/\s+/)
    .filter((p) => p !== '' && !RELLENO.has(p) && !/^[\d.,$]+$/.test(p));
  res.comercio = resto.slice(0, 3).join(' ');
  if (res.comercio) res.comercio = res.comercio.charAt(0).toUpperCase() + res.comercio.slice(1);
  if (res.tipo === 'gasto' || res.tipo === 'devolucion') res.categoria = categoriaPara(res.comercio);
  if (res.tipo === 'ingreso') res.categoria = 'Ingresos';
  return res;
}
