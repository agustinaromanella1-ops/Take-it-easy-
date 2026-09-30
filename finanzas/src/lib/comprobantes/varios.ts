import type { Cents, DateISO, Moneda } from '../../types';
import { addDays, isValidISODate, MONTH_NAMES } from '../dates';
import { parseMoney } from '../money';
import { normalizar } from '../finanzas/duplicados';
import { categoriaPara } from '../texto/categorias';

/**
 * Una captura con varios movimientos: la lista de actividad de una billetera
 * o del home banking.
 *
 * Suelen venir así, con la fecha como título y cada movimiento con su signo:
 *
 *     Hoy
 *     Supermercado Día          - $ 8.500
 *     Transferencia recibida    + $ 20.000
 *     Ayer
 *     Uber
 *     - $ 4.500
 *
 * Solo se toman importes con signo de pesos (o de dólares): un número suelto
 * en la descripción puede ser cualquier cosa. Los saldos y totales se
 * ignoran. Si falta el signo, se marca como dudoso en vez de adivinar.
 */

export interface ItemCaptura {
  fecha: DateISO | null;
  descripcion: string;
  importe: Cents;
  moneda: Moneda;
  tipo: 'gasto' | 'ingreso' | 'devolucion';
  /** No venía con + o −: el tipo es una suposición y se pregunta. */
  signoDudoso: boolean;
  categoria: string;
}

const RE_IMPORTE = /([+\-−–]?)\s*(us\$|u\$s|usd|\$)\s*(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)/i;
const IGNORAR = /saldo|disponible|total|limite|tu dinero|rendimiento|resumen|invertido|reservado/;
const DIAS = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const MESES = MONTH_NAMES.map((m) => normalizar(m).slice(0, 3));

/** Si la línea es un título de fecha ("Hoy", "Ayer", "Lunes 14 de septiembre", "14 sep"), la fecha. */
function fechaDeTitulo(linea: string, hoy: DateISO): DateISO | null {
  const t = normalizar(linea);
  if (t === '' || t.length > 40) return null;
  if (/^hoy\b/.test(t)) return hoy;
  if (/^ayer\b/.test(t)) return addDays(hoy, -1);
  const sinDia = DIAS.reduce((s, d) => s.replace(new RegExp(`^${d}\\s*`), ''), t);
  let m = /^(\d{1,2})(?: de)? ([a-z]{3,10})(?: de)?(?: (\d{4}))?$/.exec(sinDia);
  if (m) {
    const mes = MESES.indexOf((m[2] ?? '').slice(0, 3));
    if (mes === -1) return null;
    return armar(m[3] ?? hoy.slice(0, 4), mes + 1, Number(m[1]), hoy, !m[3]);
  }
  m = /^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?$/.exec(linea.trim());
  if (m) {
    const anio = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : hoy.slice(0, 4);
    return armar(anio, Number(m[2]), Number(m[1]), hoy, !m[3]);
  }
  return null;
}

function armar(anio: string, mes: number, dia: number, hoy: DateISO, sinAnio: boolean): DateISO | null {
  const iso = `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (!isValidISODate(iso)) return null;
  // Sin año, una fecha futura es del año pasado.
  return sinAnio && iso > hoy ? `${Number(anio) - 1}${iso.slice(4)}` : iso;
}

function limpiarDescripcion(s: string): string {
  return s
    .replace(/\b\d{1,2}:\d{2}\b/g, ' ')
    .replace(/[|•·>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 50);
}

export function extraerVarios(texto: string, hoy: DateISO): ItemCaptura[] {
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const items: ItemCaptura[] = [];
  let fecha: DateISO | null = null;
  let descripcionPendiente = '';

  for (const linea of lineas) {
    const titulo = fechaDeTitulo(linea, hoy);
    if (titulo) {
      fecha = titulo;
      descripcionPendiente = '';
      continue;
    }
    const n = normalizar(linea);
    const m = RE_IMPORTE.exec(linea);
    if (!m) {
      if (!IGNORAR.test(n) && /[a-z]{3}/.test(n)) descripcionPendiente = limpiarDescripcion(linea);
      continue;
    }
    if (IGNORAR.test(n)) {
      descripcionPendiente = '';
      continue;
    }
    const importe = parseMoney(m[3] ?? '');
    if (importe === null || importe <= 0) continue;
    const antes = limpiarDescripcion(linea.slice(0, m.index));
    const descripcion = /[a-zA-Z]{3}/.test(antes) ? antes : descripcionPendiente;
    const contexto = normalizar(`${descripcion} ${linea}`);
    const signo = m[1] ?? '';
    let tipo: ItemCaptura['tipo'];
    let signoDudoso = false;
    if (/reintegro|devolucion|reembolso|cashback/.test(contexto)) tipo = 'devolucion';
    else if (signo === '+') tipo = 'ingreso';
    else if (signo !== '') tipo = 'gasto';
    else if (/recibi|recibida|te transfir|ingreso|cobr|deposit|acredit/.test(contexto)) tipo = 'ingreso';
    else {
      tipo = 'gasto';
      signoDudoso = true;
    }
    items.push({
      fecha,
      descripcion,
      importe,
      moneda: /us\$|u\$s|usd/i.test(m[2] ?? '') ? 'USD' : 'ARS',
      tipo,
      signoDudoso,
      categoria: tipo === 'gasto' ? categoriaPara(descripcion) : '',
    });
    descripcionPendiente = '';
  }
  return items;
}
