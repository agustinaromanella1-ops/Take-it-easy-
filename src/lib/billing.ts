import type { Cents, Patient, Session } from '../types';
import { formatMoney } from './money';
import { fromISODate, MONTH_NAMES } from './dates';
import { isBillable } from '../store/selectors';

/**
 * Arma el texto para facturar las sesiones de un paciente en un período.
 *
 * La idea es copiar y pegar en el sistema de facturación, así que el texto sale
 * listo y no hay que completar nada a mano.
 */

export interface BillingLine {
  patient: Patient;
  sessions: Session[];
  /** Fechas de las sesiones facturables, ordenadas. */
  dates: string[];
  total: Cents;
  /** Honorario por sesión, si todas valen lo mismo. `null` si hay varios precios. */
  unitFee: Cents | null;
}

/**
 * Sesiones facturables de un paciente dentro del rango, con sus totales.
 *
 * Solo entran las que generan deuda: una cancelada o una ausencia sin cargo no
 * se factura, y colarlas haría que el importe no cierre con lo que el paciente
 * efectivamente debe.
 */
export function billingLine(patient: Patient, sessions: Session[], from: string, to: string): BillingLine {
  const billable = sessions
    .filter((s) => s.patientId === patient.id && s.date >= from && s.date <= to && isBillable(s))
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date < b.date ? -1 : 1));

  const fees = new Set(billable.map((s) => s.fee));
  return {
    patient,
    sessions: billable,
    dates: billable.map((s) => s.date),
    total: billable.reduce((n, s) => n + s.fee, 0),
    unitFee: fees.size === 1 ? [...fees][0]! : null,
  };
}

/**
 * Lista de días en prosa: "3, 10 y 17 de marzo".
 *
 * Agrupa por mes para no repetirlo en cada fecha, que es como se escribe a mano.
 * Con un solo día devuelve "el 3 de marzo".
 */
export function formatDateList(dates: string[]): string {
  if (dates.length === 0) return '';

  const byMonth = new Map<string, number[]>();
  for (const date of [...dates].sort()) {
    const key = date.slice(0, 7);
    const list = byMonth.get(key);
    if (list) list.push(Number(date.slice(8)));
    else byMonth.set(key, [Number(date.slice(8))]);
  }

  const chunks = [...byMonth.entries()].map(([key, days]) => {
    const month = MONTH_NAMES[Number(key.slice(5, 7)) - 1] ?? '';
    return `${joinWithAnd(days.map(String))} de ${month}`;
  });

  return joinWithAnd(chunks);
}

/** "a, b y c" — la coma seriada no se usa en español. */
function joinWithAnd(parts: string[]): string {
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0]!;
  return `${parts.slice(0, -1).join(', ')} y ${parts[parts.length - 1]}`;
}

export interface BillingTextOptions {
  profession: string;
  currency: string;
}

/**
 * Texto sugerido para la factura.
 *
 * Los datos que faltan se omiten en lugar de dejar un hueco: una factura que
 * dice "DNI:" sin número se ve peor que una que no lo menciona.
 */
export function billingText(line: BillingLine, options: BillingTextOptions): string {
  const { patient, dates, total, unitFee } = line;
  const { profession, currency } = options;

  if (dates.length === 0) {
    return `No hay sesiones facturables de ${patient.name} en el período elegido.`;
  }

  const parts: string[] = [
    `Honorarios por sesión de ${profession} del paciente ${patient.name}`,
  ];

  // El número de afiliado es lo que pide la obra social; el DNI sirve cuando no
  // hay obra social de por medio. Si están los dos, se informan los dos.
  const ids: string[] = [];
  if (patient.memberNumber.trim() !== '') {
    ids.push(`N.º de afiliado ${patient.memberNumber.trim()}`);
  }
  if (patient.document.trim() !== '') {
    ids.push(`DNI ${patient.document.trim()}`);
  }
  if (ids.length > 0) parts.push(joinWithAnd(ids));

  const plural = dates.length === 1 ? 'el día' : 'los días';
  parts.push(`${plural} ${formatDateList(dates)}`);

  let text = `${parts.join(', ')}.`;

  if (unitFee !== null) {
    text += ` Valor de la sesión: ${formatMoney(unitFee, currency)}.`;
    if (dates.length > 1) {
      text += ` Total: ${formatMoney(total, currency)} (${dates.length} sesiones).`;
    }
  } else {
    // Con honorarios distintos en el período, el "valor de la sesión" no existe
    // como dato único: se detalla sesión por sesión para que cierre.
    const detail = line.sessions
      .map((s) => `${fromISODate(s.date).getDate()}/${s.date.slice(5, 7)}: ${formatMoney(s.fee, currency)}`)
      .join(', ');
    text += ` Valor de cada sesión: ${detail}. Total: ${formatMoney(total, currency)}.`;
  }

  return text;
}
