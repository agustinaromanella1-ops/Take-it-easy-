import type { AppData, Cents, DateISO, Patient } from '../types';
import { monthKey } from './dates';
import { isBillable } from '../store/selectors';

/**
 * Lo que queda después de lo que retiene la institución.
 *
 * Trabajar para una institución casi nunca es cobrar el honorario entero: se
 * queda un porcentaje. Sin esto, todos los números de la app hablaban de plata
 * que en parte nunca llega, y la pregunta de si un mes alcanzó no se podía
 * contestar sin hacer la cuenta aparte.
 *
 * **El porcentaje NO toca lo que el paciente debe.** La sesión factura lo que
 * factura y el saldo es ese: descontarlo del honorario sería cobrarle de menos
 * a quien paga. Lo de acá es siempre una cuenta derivada, al lado de la otra.
 *
 * El redondeo va al centavo sobre lo retenido, y lo neto se calcula restando.
 * Al revés —redondeando las dos puntas por separado— las dos partes podrían no
 * sumar el total, y un centavo que no cierra en una pantalla de plata es una
 * pregunta que nadie puede contestar.
 */

export interface Reparto {
  /** Lo que factura, sin tocar. */
  bruto: Cents;
  /** Lo que se queda la institución. */
  retenido: Cents;
  /** Lo que queda para el profesional. Siempre `bruto - retenido`. */
  neto: Cents;
}

export function repartir(bruto: Cents, porcentaje: number): Reparto {
  const pct = Math.min(99, Math.max(0, Math.round(porcentaje)));
  if (pct === 0) return { bruto, retenido: 0, neto: bruto };
  const retenido = Math.round((bruto * pct) / 100);
  return { bruto, retenido, neto: bruto - retenido };
}

/** Si vale la pena mostrar la cuenta: sin ninguna retención, sobra. */
export function hayRetenciones(data: AppData): boolean {
  return data.patients.some((p) => p.institutionPercent > 0);
}

function sumar(a: Reparto, b: Reparto): Reparto {
  return { bruto: a.bruto + b.bruto, retenido: a.retenido + b.retenido, neto: a.neto + b.neto };
}

const VACIO: Reparto = { bruto: 0, retenido: 0, neto: 0 };

/**
 * El reparto de lo facturado en un mes.
 *
 * Suma sesión por sesión y no sobre el total del mes: cada paciente puede
 * tener su propio porcentaje, así que un promedio no sería el número real.
 */
export function repartoDelMes(data: AppData, mes: string): Reparto {
  const pctPorPaciente = new Map(data.patients.map((p) => [p.id, p.institutionPercent]));
  let total = VACIO;
  for (const s of data.sessions) {
    if (!isBillable(s) || monthKey(s.date) !== mes) continue;
    total = sumar(total, repartir(s.fee, pctPorPaciente.get(s.patientId) ?? 0));
  }
  return total;
}

/** El reparto de todo lo que facturó un paciente, o de un importe suyo. */
export function repartoDePaciente(paciente: Patient, bruto: Cents): Reparto {
  return repartir(bruto, paciente.institutionPercent);
}

/**
 * Lo facturado de un paciente en un día, para la ficha y los listados que ya
 * recorren sus sesiones.
 */
export function brutoDelPacienteEn(data: AppData, patientId: string, desde: DateISO, hasta: DateISO): Cents {
  let total = 0;
  for (const s of data.sessions) {
    if (s.patientId !== patientId || !isBillable(s)) continue;
    if (s.date < desde || s.date > hasta) continue;
    total += s.fee;
  }
  return total;
}

/**
 * Cuánto se quedan las instituciones en promedio, de 0 a 99.
 *
 * No es el promedio de los porcentajes cargados: es cuánto se retiene de cada
 * peso facturado. Promediar los porcentajes diría lo mismo de quien tiene un
 * solo paciente de institución que de quien tiene veinte, y la pregunta es
 * cuánto se le va de la plata que entra.
 *
 * Se mira una ventana reciente y no todo el historial: lo que importa es la
 * mezcla de pacientes de ahora. Un convenio que se cortó hace dos años no
 * tiene que seguir encareciendo la tarifa que se sugiere hoy.
 */
export function retencionPromedio(data: AppData, desde: DateISO): number {
  const pctPorPaciente = new Map(data.patients.map((p) => [p.id, p.institutionPercent]));
  let bruto = 0;
  let retenido = 0;
  for (const s of data.sessions) {
    if (!isBillable(s) || s.date < desde) continue;
    const r = repartir(s.fee, pctPorPaciente.get(s.patientId) ?? 0);
    bruto += r.bruto;
    retenido += r.retenido;
  }
  if (bruto <= 0) return 0;
  // Con 99 la tarifa tendería a infinito; el tope lo deja en algo mostrable.
  return Math.min(99, (retenido / bruto) * 100);
}
