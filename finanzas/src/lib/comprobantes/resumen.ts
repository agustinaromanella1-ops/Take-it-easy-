import type { Cents, Cuenta, DateISO, Movimiento } from '../../types';
import { normalizar } from '../finanzas/duplicados';
import { cargosYAbonos, deudaAlCierre } from '../finanzas/tarjeta';
import { addMonthsISO, conDia, daysBetween } from '../dates';
import { fechasDe, importesDe } from './extraer';

/**
 * El resumen de una tarjeta: leerlo y compararlo con lo anotado.
 *
 * Sirve una foto o, mejor, el texto copiado del PDF del banco. Se buscan el
 * cierre, el vencimiento, el total a pagar, el mínimo y los consumos con sus
 * cuotas. Los intereses, impuestos y comisiones se separan: son costos que se
 * conocen recién con el resumen.
 *
 * Nada se guarda solo: la pantalla muestra la diferencia y la persona elige
 * qué agregar.
 */

export interface LineaResumen {
  fecha: DateISO | null;
  descripcion: string;
  importe: Cents;
  cuota: { numero: number; de: number } | null;
  tipo: 'consumo' | 'cargo';
}

export interface ResumenLeido {
  cierre: DateISO | null;
  vencimiento: DateISO | null;
  total: Cents | null;
  minimo: Cents | null;
  lineas: LineaResumen[];
  /** Hay importes en dólares: se muestran aparte y no se mezclan. */
  hayDolares: boolean;
}

const CARGO = /interes|iva|impuesto|percepcion|sellos|comision|cargo|seguro de vida|mantenimiento|renovacion|punitorio/;
const NO_CONSUMO = /su pago|pago recibido|pago en|saldo anterior|saldo actual|total a pagar|pago minimo|limite|tasa|t\.?n\.?a|t\.?e\.?m|c\.?f\.?t/;

function cuotaDe(t: string): { numero: number; de: number } | null {
  const m = /\bc(?:uota)?\.?\s?(\d{1,2})\s?(?:\/|de)\s?(\d{1,2})\b/.exec(t) ?? /(?:^|\s)(\d{2})\/(\d{2})(?!\/|\d)/.exec(t);
  if (!m) return null;
  const numero = Number(m[1]);
  const de = Number(m[2]);
  return numero >= 1 && de >= numero && de <= 72 && de > 1 ? { numero, de } : null;
}

export function leerResumen(texto: string): ResumenLeido {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const res: ResumenLeido = { cierre: null, vencimiento: null, total: null, minimo: null, lineas: [], hayDolares: /u\$s|usd|dolares/i.test(texto) };

  for (const linea of lineas) {
    const t = normalizar(linea);
    const fechas = fechasDe(linea);
    // En pesos: si hay un importe en dólares en la misma línea, va después.
    const pesos = importesDe(linea.split(/u\$s|usd/i)[0] ?? linea);
    const ultimo = pesos[pesos.length - 1];

    if (/cierre/.test(t) && !/proximo|anterior/.test(t) && fechas[0]) {
      res.cierre ??= fechas[0];
      if (/venc/.test(t) && fechas[1]) res.vencimiento ??= fechas[1];
      continue;
    }
    if (/venc|\bvto\b/.test(t) && !/proximo|anterior/.test(t) && fechas[0]) {
      res.vencimiento ??= fechas[fechas.length - 1] ?? null;
      continue;
    }
    if (/saldo actual|total a pagar|saldo a pagar|saldo total/.test(t) && ultimo !== undefined) {
      res.total ??= ultimo;
      continue;
    }
    if (/pago minimo|minimo a pagar/.test(t) && ultimo !== undefined) {
      res.minimo ??= ultimo;
      continue;
    }
    if (NO_CONSUMO.test(t) || ultimo === undefined || /u\$s|usd/i.test(linea)) continue;

    // Un consumo: empieza con fecha, tiene descripción y termina con importe.
    const conFecha = /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(linea) || /^\d{1,2}[ -][a-z]{3}[a-z]*[ -]\d{2,4}/i.test(linea);
    if (!conFecha && !CARGO.test(t)) continue;
    const descripcion = linea
      .replace(/^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/, '')
      .replace(/^\d{1,2}[ -][a-zA-Z]{3,}[ -]\d{2,4}/, '')
      .replace(/-?\$?\s*[\d.]+,\d{2}\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();
    res.lineas.push({
      fecha: fechas[0] ?? null,
      descripcion: descripcion.slice(0, 50),
      importe: ultimo,
      cuota: cuotaDe(descripcion.toLowerCase()),
      tipo: CARGO.test(t) ? 'cargo' : 'consumo',
    });
  }
  return res;
}

export interface Conciliacion {
  /** Según lo anotado en la app, lo que se debía al cierre. */
  segunApp: Cents;
  /** Resumen menos app: positivo = el banco dice que debés más. */
  diferencia: Cents;
  /** Consumos del resumen que no aparecen entre lo anotado. */
  faltantes: LineaResumen[];
  cargos: LineaResumen[];
  /** El resumen cerró antes de cargar la tarjeta: no hay con qué comparar. */
  anteriorALaTarjeta: boolean;
}

/**
 * Compara el resumen con lo anotado. Un consumo del resumen "está" si hay un
 * cargo de la app en el mismo cierre por el mismo importe (con un peso de
 * tolerancia, por redondeo de cuotas).
 */
export function conciliar(tarjeta: Cuenta, movimientos: readonly Movimiento[], leido: ResumenLeido): (Conciliacion & { cierre: DateISO }) | null {
  if (!leido.cierre || leido.total === null) return null;
  // El banco a veces corre el cierre un par de días (feriados, fines de
  // semana): se toma el cierre de la app más cercano al del resumen.
  const dia = tarjeta.diaCierre ?? Number(leido.cierre.slice(8));
  const candidatos = [-1, 0, 1].map((k) => conDia(addMonthsISO(`${leido.cierre!.slice(0, 7)}-01`, k), dia));
  const cierre = candidatos.reduce((a, b) => (Math.abs(daysBetween(b, leido.cierre!)) < Math.abs(daysBetween(a, leido.cierre!)) ? b : a));
  if (leido.cierre < tarjeta.fechaSaldo) {
    return { cierre: leido.cierre, segunApp: 0, diferencia: 0, faltantes: [], cargos: [], anteriorALaTarjeta: true };
  }
  const segunApp = deudaAlCierre(tarjeta, movimientos, cierre);
  const delCierre = cargosYAbonos(tarjeta, movimientos).cargos.filter((c) => c.cierre === cierre);
  const usados = new Set<number>();
  const faltantes: LineaResumen[] = [];
  for (const l of leido.lineas.filter((x) => x.tipo === 'consumo')) {
    const i = delCierre.findIndex((c, j) => !usados.has(j) && Math.abs(c.importe - l.importe) <= 100);
    if (i === -1) faltantes.push(l);
    else usados.add(i);
  }
  return {
    cierre,
    segunApp,
    diferencia: leido.total - segunApp,
    faltantes,
    cargos: leido.lineas.filter((x) => x.tipo === 'cargo'),
    anteriorALaTarjeta: false,
  };
}

/**
 * Cómo se anota un consumo que faltaba. Si es la cuota k de N, se anotan las
 * cuotas que quedan (de k a N) como una compra que empieza en este resumen:
 * así las próximas caen solas en los resúmenes que vienen.
 */
export function consumoComoCompra(
  l: LineaResumen,
  cierre: DateISO,
  desde: DateISO,
): { importe: Cents; cuotas: number; fecha: DateISO; nota: string } {
  if (l.cuota) {
    const restantes = l.cuota.de - l.cuota.numero + 1;
    return {
      importe: l.importe * restantes,
      cuotas: restantes,
      fecha: cierre,
      nota: `Cuotas ${l.cuota.numero} a ${l.cuota.de}, tomadas del resumen`,
    };
  }
  // Con una fecha anterior a la del saldo de la tarjeta, el saldo lo daría por
  // incluido y el consumo no contaría: en ese caso va con la fecha del cierre.
  const fecha = l.fecha && l.fecha <= cierre && l.fecha >= desde ? l.fecha : cierre;
  return { importe: l.importe, cuotas: 1, fecha, nota: 'Tomado del resumen' };
}
