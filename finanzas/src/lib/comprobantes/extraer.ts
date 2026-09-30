import type { Cents, DateISO, Moneda } from '../../types';
import { isValidISODate, MONTH_NAMES } from '../dates';
import { parseMoney } from '../money';
import { normalizar } from '../finanzas/duplicados';
import { categoriaPara } from '../texto/categorias';

/**
 * De texto leído de un comprobante a una propuesta de movimiento.
 *
 * Son reglas sobre el texto, sin IA. El texto de un documento es DATO: nada de
 * lo que diga se ejecuta ni cambia cómo se comporta la app; solo se buscan
 * importes, fechas y nombres.
 *
 * Lo que no se encuentra queda vacío y se pregunta. No hay porcentajes de
 * confianza: no hay forma honesta de calibrarlos. En su lugar, cada campo
 * dudoso se marca como tal y se dice por qué.
 */

export type TipoDocumento = 'ticket' | 'factura' | 'comprobante-pago' | 'transferencia' | 'pago-tarjeta' | 'desconocido';
export type MedioPago = 'efectivo' | 'debito' | 'credito' | 'billetera' | 'transferencia';
export type Campo = 'total' | 'fecha' | 'comercio' | 'tipo' | 'vencimiento' | 'moneda';

/** Qué se va a crear con la propuesta. */
export type Destino = 'gasto' | 'compromiso' | 'transferencia' | 'pago-tarjeta';

export interface Propuesta {
  legible: boolean;
  tipoDocumento: TipoDocumento;
  destino: Destino;
  total: Cents | null;
  moneda: Moneda;
  fecha: DateISO | null;
  vencimiento: DateISO | null;
  comercio: string;
  medioPago: MedioPago | null;
  categoria: string;
  cuota: { numero: number; de: number } | null;
  dudosos: Campo[];
  avisos: string[];
}

const RE_IMPORTE = /(?:us\$|u\$s|usd|\$)?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{2}(?!\d)|\d{2,9}(?![\d/:.,-]))/g;

/**
 * Los importes de una línea, en centavos, en el orden en que aparecen.
 *
 * `estricto` pide que el número tenga signo de pesos o separadores ("8.500",
 * "12,50"): un número pelado puede ser un año, una cantidad o un código. Se
 * usa fuera de las líneas de total.
 */
export function importesDe(linea: string, estricto = false): Cents[] {
  // Fechas, horas y números largos (CUIT, CBU, teléfonos) no son importes.
  const limpia = linea
    .replace(/\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2} de [a-záéíóú]+ de \d{4}\b/gi, ' ')
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, ' ')
    .replace(/\b\d{10,}\b/g, ' ')
    .replace(/\b\d{2}-\d{8}-\d\b/g, ' ');
  const res: Cents[] = [];
  let m: RegExpExecArray | null;
  RE_IMPORTE.lastIndex = 0;
  while ((m = RE_IMPORTE.exec(limpia))) {
    const crudo = m[0];
    if (estricto && !/\$|[.,]/.test(crudo)) continue;
    const c = parseMoney(m[1] ?? '');
    if (c !== null && c > 0) res.push(c);
  }
  return res;
}

const MESES_CORTOS = MONTH_NAMES.map((m) => m.slice(0, 3));

/** Fechas de una línea: dd/mm/aaaa, dd-mm-aa, "10 de marzo de 2026", "10 mar 2026". */
export function fechasDe(linea: string): DateISO[] {
  const res: DateISO[] = [];
  const numericas = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/g;
  let m: RegExpExecArray | null;
  while ((m = numericas.exec(linea))) {
    const anio = (m[3] ?? '').length === 2 ? `20${m[3]}` : m[3];
    const iso = `${anio}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
    if (isValidISODate(iso)) res.push(iso);
  }
  const t = normalizar(linea);
  const conMes = /\b(\d{1,2})(?: de)? ([a-z]{3,10})(?: de)? (\d{4})\b/g;
  while ((m = conMes.exec(t))) {
    const nombre = (m[2] ?? '').slice(0, 3);
    const mes = MESES_CORTOS.indexOf(nombre as (typeof MESES_CORTOS)[number]);
    if (mes === -1) continue;
    const iso = `${m[3]}-${String(mes + 1).padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
    if (isValidISODate(iso)) res.push(iso);
  }
  return res;
}

function detectarTipo(t: string): TipoDocumento {
  if (/pago (de )?(tu |del )?(resumen|tarjeta)|pago de resumen/.test(t)) return 'pago-tarjeta';
  if (/transferencia|transferiste|enviaste|\bcvu\b|\bcbu\b|destinatario/.test(t)) return 'transferencia';
  if (/comprobante de pago|pago exitoso|pagaste|pago realizado|operacion aprobada|pago aprobado|constancia de pago/.test(t)) return 'comprobante-pago';
  if (/factura|vencimiento|\bvto\b|\bvence\b|periodo de facturacion|total a pagar|numero de cliente|nro de cliente/.test(t)) return 'factura';
  if (/ticket|consumidor final|\biva\b|\bcuit\b|\bcaja\b|articulos|cant\b|efectivo|vuelto/.test(t)) return 'ticket';
  return 'desconocido';
}

/** Líneas que tienen importes que NO son el total. */
const NO_ES_TOTAL = /sub ?total|saldo|vuelto|su pago|pago con|recibido|descuento|\biva\b|impuesto|percepcion|propina|limite|disponible|total de (items|articulos|unidades)|cant/;

function buscarTotal(lineas: string[]): { total: Cents | null; dudoso: boolean; aviso: string | null } {
  const normal = lineas.map(normalizar);
  const candidatos: { valor: Cents; peso: number; indice: number }[] = [];

  normal.forEach((l, i) => {
    let peso = 0;
    if (/total a pagar|importe total|total final|monto total/.test(l)) peso = 3;
    else if (/\btotal\b/.test(l) && !NO_ES_TOTAL.test(l)) peso = 2;
    else if (/\b(monto|importe|pagaste|transferiste|enviaste)\b/.test(l) && !NO_ES_TOTAL.test(l)) peso = 1;
    if (peso === 0) return;
    // El importe va en la misma línea o, si el lector lo cortó, en la siguiente.
    let valores = importesDe(lineas[i] ?? '');
    if (valores.length === 0) valores = importesDe(lineas[i + 1] ?? '');
    const valor = valores[valores.length - 1];
    if (valor !== undefined) candidatos.push({ valor, peso, indice: i });
  });

  if (candidatos.length > 0) {
    const mejorPeso = Math.max(...candidatos.map((c) => c.peso));
    const mejores = candidatos.filter((c) => c.peso === mejorPeso);
    // Si hay varias líneas de total, cuenta la última: suele ser el total final.
    const elegido = mejores[mejores.length - 1];
    const distintos = new Set(mejores.map((c) => c.valor)).size > 1;
    return {
      total: elegido?.valor ?? null,
      dudoso: distintos,
      aviso: distintos ? 'Encontré más de un total. Revisá cuál es el que pagaste.' : null,
    };
  }

  const soloSubtotal = normal.some((l) => /sub ?total/.test(l));
  const soloSaldo = normal.some((l) => /saldo/.test(l));
  // Sin línea de total: si en todo el texto hay UN solo importe que no es
  // saldo ni subtotal, se propone, pero marcado como dudoso.
  // Una etiqueta sola en su línea ("Saldo disponible") excluye también la
  // línea que sigue, que es donde el lector suele dejar su número.
  const excluida = (i: number) =>
    NO_ES_TOTAL.test(normal[i] ?? '') ||
    (i > 0 && NO_ES_TOTAL.test(normal[i - 1] ?? '') && importesDe(lineas[i - 1] ?? '').length === 0);
  const sueltos = lineas.filter((_, i) => !excluida(i)).flatMap((l) => importesDe(l, true));
  const unicos = [...new Set(sueltos)];
  if (unicos.length === 1 && unicos[0] !== undefined) {
    return { total: unicos[0], dudoso: true, aviso: 'No encontré la palabra "total": confirmá el importe.' };
  }
  if (soloSaldo) return { total: null, dudoso: true, aviso: 'Veo un saldo, pero un saldo no es un gasto. Escribí el importe si lo sabés.' };
  if (soloSubtotal) return { total: null, dudoso: true, aviso: 'Veo un subtotal pero no el total. Escribí el total.' };
  return { total: null, dudoso: true, aviso: 'No encontré el total. Podés escribirlo mirando la imagen.' };
}

const GENERICAS = /ticket|factura|comprobante|fecha|hora|cuit|iva|consumidor|original|duplicado|caja|nro|numero|domicilio|direccion|tel|www|http|inicio de actividades|ingresos brutos|punto de venta|^[\W\d]*$/;

function buscarComercio(lineas: string[], tipo: TipoDocumento): string {
  const normal = lineas.map(normalizar);
  if (tipo === 'transferencia' || tipo === 'comprobante-pago') {
    for (let i = 0; i < normal.length; i++) {
      const l = normal[i] ?? '';
      const m = /^(para|destinatario|a nombre de|beneficiario|comercio|pagaste a|le transferiste a|enviaste a)\b:?\s*(.*)$/.exec(l);
      if (m) {
        const resto = (lineas[i] ?? '').split(/:\s*|\b(?:para|destinatario|beneficiario|comercio)\b\s*/i).pop()?.trim() ?? '';
        const valor = resto && normalizar(resto) !== m[1] ? resto : (lineas[i + 1] ?? '').trim();
        if (valor) return limpiarNombre(valor);
      }
    }
  }
  for (let i = 0; i < Math.min(lineas.length, 6); i++) {
    const l = normal[i] ?? '';
    if (l.length < 3 || GENERICAS.test(l)) continue;
    if (!/[a-z]{3}/.test(l)) continue;
    return limpiarNombre(lineas[i] ?? '');
  }
  return '';
}

function limpiarNombre(s: string): string {
  const t = s.replace(/[^\p{L}\p{N} .&'-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  // Los tickets vienen en mayúsculas; se deja con mayúscula solo la primera.
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

function buscarMedio(t: string, tipo: TipoDocumento): MedioPago | null {
  if (tipo === 'transferencia') return 'transferencia';
  if (/mercado ?pago|uala|naranja x|personal pay|modo\b/.test(t)) return 'billetera';
  if (/credito|cuotas?\b|amex|american express/.test(t)) return 'credito';
  if (/debito|maestro/.test(t)) return 'debito';
  if (/efectivo|vuelto/.test(t)) return 'efectivo';
  return null;
}

/** Proporción de caracteres que parecen texto: sirve para decir "ilegible" sin inventar. */
function pareceTexto(texto: string): boolean {
  const limpio = texto.replace(/\s/g, '');
  if (limpio.length < 15) return false;
  const utiles = (limpio.match(/[\p{L}\p{N}$.,:/]/gu) ?? []).length;
  return utiles / limpio.length > 0.7 && /[a-zA-Z]{3}/.test(texto);
}

export function extraer(texto: string, hoy: DateISO): Propuesta {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter((l) => l !== '');
  const t = normalizar(texto);
  const vacia: Propuesta = {
    legible: false,
    tipoDocumento: 'desconocido',
    destino: 'gasto',
    total: null,
    moneda: 'ARS',
    fecha: null,
    vencimiento: null,
    comercio: '',
    medioPago: null,
    categoria: '',
    cuota: null,
    dudosos: ['total', 'fecha', 'comercio'],
    avisos: ['No pude leer esta imagen. Podés recortarla, sacar otra o completar a mano.'],
  };
  if (!pareceTexto(texto)) return vacia;

  const tipoDocumento = detectarTipo(t);
  const dudosos = new Set<Campo>();
  const avisos: string[] = [];

  const { total, dudoso, aviso } = buscarTotal(lineas);
  if (dudoso) dudosos.add('total');
  if (aviso) avisos.push(aviso);

  const moneda: Moneda = /us\$|u\$s|\busd\b|dolares/i.test(texto) ? 'USD' : 'ARS';
  if (moneda === 'USD' && /\$\s?\d/.test(texto.replace(/us\$|u\$s/gi, ''))) {
    dudosos.add('moneda');
    avisos.push('Aparecen pesos y dólares. Confirmá la moneda.');
  }

  let vencimiento: DateISO | null = null;
  let fecha: DateISO | null = null;
  const normal = lineas.map(normalizar);
  for (const [i, l] of lineas.entries()) {
    const fechas = fechasDe(l);
    if (fechas.length === 0) continue;
    const n = normal[i] ?? '';
    if (/venc|\bvto\b|vence/.test(n)) {
      vencimiento ??= fechas[fechas.length - 1] ?? null;
    } else if (!/periodo|desde|hasta|emision anterior|proximo/.test(n)) {
      fecha ??= fechas[0] ?? null;
    }
  }
  if (!fecha) dudosos.add('fecha');
  else if (fecha > hoy) {
    dudosos.add('fecha');
    avisos.push('La fecha que leí es futura. Revisala.');
  }

  const cuotaM = /cuota\s*(\d{1,2})\s*(?:de|\/)\s*(\d{1,2})/.exec(t);
  const cuota = cuotaM ? { numero: Number(cuotaM[1]), de: Number(cuotaM[2]) } : null;
  if (cuota) avisos.push(`Parece la cuota ${cuota.numero} de ${cuota.de}: el importe es el de la cuota, no el precio total.`);

  let destino: Destino = 'gasto';
  if (tipoDocumento === 'factura') {
    destino = 'compromiso';
    avisos.push('Parece una factura: la guardo como algo a pagar, no como un gasto hecho.');
    if (!vencimiento) dudosos.add('vencimiento');
  } else if (tipoDocumento === 'pago-tarjeta') {
    destino = 'pago-tarjeta';
    avisos.push('Parece el pago de la tarjeta: no es una compra nueva, así que no se cuenta como gasto.');
  } else if (tipoDocumento === 'transferencia') {
    dudosos.add('tipo');
    avisos.push('Es una transferencia. Si fue a otra cuenta tuya, no es un gasto: elegí "Entre mis cuentas".');
  }

  const comercio = buscarComercio(lineas, tipoDocumento);
  if (!comercio) dudosos.add('comercio');

  return {
    legible: true,
    tipoDocumento,
    destino,
    total,
    moneda,
    fecha,
    vencimiento,
    comercio,
    medioPago: buscarMedio(t, tipoDocumento),
    categoria: categoriaPara(comercio) || categoriaPara(texto),
    cuota,
    dudosos: [...dudosos],
    avisos,
  };
}
