import type { AppData, Cents, Patient, Payment, Session } from '../types';
import { monthKey } from './dates';
import { isBillable } from '../store/selectors';

/**
 * Cobranza mes por mes: qué facturó cada mes y cuánto de eso ya entró.
 *
 * ── Por qué no alcanza con restar ──────────────────────────────────────────
 *
 * Lo que había antes era "facturado del mes menos cobrado del mes". Las dos
 * cifras son ciertas por separado pero no se pueden restar, porque no hablan
 * de lo mismo: una cuenta sesiones del mes, la otra plata que entró en el mes.
 * Quien cobra las sesiones de octubre en noviembre —que es lo normal— veía ese
 * pago bajándole lo pendiente de NOVIEMBRE, un mes que todavía no cobró, y
 * octubre quedaba eternamente impago. Con el signo al revés pasa lo mismo:
 * quien paga el mes por adelantado deja noviembre en cero y diciembre con todo
 * por cobrar.
 *
 * ── Cómo se imputa ─────────────────────────────────────────────────────────
 *
 * Cada pago se asigna a las sesiones que salda, y recién ahí se suma por mes:
 *
 * 1. **El pago atado a su sesión va a esa sesión**, aunque haya sesiones más
 *    viejas sin pagar. Para eso existe `Payment.sessionId`: lo ponen el cobro
 *    del inicio y el del cierre del día, que saben exactamente qué están
 *    saldando. Si el importe sobra, el resto cae en la bolsa de abajo.
 * 2. **Lo que queda se imputa de la sesión más vieja a la más nueva**, que es
 *    como se lleva una cuenta corriente. Es la misma regla que usa
 *    `pendientes.ts` para decidir qué deuda es vieja: quien paga todos los
 *    meses y debe el último no tiene una deuda de hace un año.
 *
 * No se usa `cobroDeSesion.ts` acá: esa resuelve "qué cobro saldó ESTA sesión"
 * para poder desmarcarla, y para eso acepta una coincidencia por paciente, día
 * e importe. Repartir una cuenta corriente entre meses es otra pregunta, y
 * contestarla por coincidencia dejaría plata sin imputar en cuanto alguien
 * pague dos sesiones juntas.
 *
 * Un pago que sobra —alguien que pagó de más— no se imputa a ningún mes. El
 * saldo acumulado de `patientBalances` sí lo tiene en cuenta, y es el que hay
 * que mirar para saber cuánto debe alguien en total.
 */

export interface CobranzaDePaciente {
  patient: Patient;
  /** Lo que facturaron las sesiones de ESE mes. */
  facturado: Cents;
  /** De eso, lo que ya entró, venga el pago del mes que venga. */
  cobrado: Cents;
  /** Lo que falta cobrar de ese mes. Nunca negativo. */
  pendiente: Cents;
}

/** Cuánto se imputó a cada sesión, por id. */
export function imputarPagos(sesiones: Session[], pagos: Payment[]): Map<string, Cents> {
  const facturables = sesiones.filter(isBillable).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const porId = new Map(facturables.map((s) => [s.id, s]));
  const imputado = new Map<string, Cents>(facturables.map((s) => [s.id, 0]));

  /** Lo que todavía no tiene dueño: pagos sueltos y los sobrantes de los atados. */
  let bolsa = 0;

  for (const pago of pagos) {
    const sesion = pago.sessionId ? porId.get(pago.sessionId) : undefined;
    if (!sesion) {
      bolsa += pago.amount;
      continue;
    }
    const yaPuesto = imputado.get(sesion.id) ?? 0;
    const cabe = Math.max(0, sesion.fee - yaPuesto);
    const pone = Math.min(cabe, pago.amount);
    imputado.set(sesion.id, yaPuesto + pone);
    bolsa += pago.amount - pone;
  }

  for (const s of facturables) {
    if (bolsa <= 0) break;
    const yaPuesto = imputado.get(s.id) ?? 0;
    const cabe = Math.max(0, s.fee - yaPuesto);
    const pone = Math.min(cabe, bolsa);
    imputado.set(s.id, yaPuesto + pone);
    bolsa -= pone;
  }

  return imputado;
}

/**
 * La cobranza de un mes, paciente por paciente.
 *
 * Solo aparece quien facturó algo ESE mes: alguien que no tuvo sesiones en
 * noviembre no es un renglón de noviembre, por más que deba de antes. Lo que
 * debe de antes se ve en su propio mes, que es de lo que se trata.
 */
export function cobranzaDelMes(data: AppData, mes: string): CobranzaDePaciente[] {
  const pagosPorPaciente = new Map<string, Payment[]>();
  for (const p of data.payments) {
    const suyos = pagosPorPaciente.get(p.patientId);
    if (suyos) suyos.push(p);
    else pagosPorPaciente.set(p.patientId, [p]);
  }

  const sesionesPorPaciente = new Map<string, Session[]>();
  for (const s of data.sessions) {
    const suyas = sesionesPorPaciente.get(s.patientId);
    if (suyas) suyas.push(s);
    else sesionesPorPaciente.set(s.patientId, [s]);
  }

  const filas: CobranzaDePaciente[] = [];
  for (const patient of data.patients) {
    const suyas = sesionesPorPaciente.get(patient.id) ?? [];
    const delMes = suyas.filter((s) => isBillable(s) && monthKey(s.date) === mes);
    if (delMes.length === 0) continue;

    const imputado = imputarPagos(suyas, pagosPorPaciente.get(patient.id) ?? []);
    let facturado = 0;
    let cobrado = 0;
    for (const s of delMes) {
      facturado += s.fee;
      cobrado += imputado.get(s.id) ?? 0;
    }
    filas.push({ patient, facturado, cobrado, pendiente: Math.max(0, facturado - cobrado) });
  }

  // Primero quien más debe de ese mes; a igual deuda, quien más facturó.
  return filas.sort((a, b) => b.pendiente - a.pendiente || b.facturado - a.facturado);
}

/** Los totales del mes, para poder decirlos en una línea. */
export function totalesDelMes(filas: CobranzaDePaciente[]): {
  facturado: Cents;
  cobrado: Cents;
  pendiente: Cents;
} {
  let facturado = 0;
  let cobrado = 0;
  let pendiente = 0;
  for (const f of filas) {
    facturado += f.facturado;
    cobrado += f.cobrado;
    pendiente += f.pendiente;
  }
  return { facturado, cobrado, pendiente };
}

/**
 * Lo que un paciente pagó de más y no está imputado a ninguna sesión.
 *
 * Es la diferencia entre lo que entró y lo que se pudo asignar. Sale de la
 * misma imputación, así que no puede contradecirla.
 */
export function sobranteNoImputado(sesiones: Session[], pagos: Payment[]): Cents {
  const imputado = imputarPagos(sesiones, pagos);
  let asignado = 0;
  for (const monto of imputado.values()) asignado += monto;
  let entró = 0;
  for (const p of pagos) entró += p.amount;
  return Math.max(0, entró - asignado);
}

/** Un mes en la cuenta de alguien. */
export interface MesDeCuenta {
  /** "YYYY-MM". */
  mes: string;
  /** Sesiones facturables de ese mes. */
  sesiones: number;
  facturado: Cents;
  cobrado: Cents;
  pendiente: Cents;
}

export interface CuentaDePaciente {
  patient: Patient;
  /** Del mes más nuevo al más viejo: lo último es lo que se está mirando. */
  meses: MesDeCuenta[];
  facturado: Cents;
  cobrado: Cents;
  /** Lo que debe en total. Nunca negativo: lo pagado de más va en `aFavor`. */
  debe: Cents;
  /** Plata que entró y todavía no tiene sesión que saldar. */
  aFavor: Cents;
}

/**
 * La cuenta de cada paciente, mes por mes.
 *
 * Contesta la pregunta que el monitoreo no contesta: cuando entra un depósito,
 * de qué mes era. Mirando una sola persona y sus meses en fila se ve de dónde
 * viene lo que pagó y qué le quedó abierto, que es lo que hay que saber para
 * reclamar sin equivocarse de mes.
 *
 * Un mes aparece si tuvo sesiones facturables. Un mes sin sesiones no es un
 * renglón vacío: es un mes en que no se atendió, y escribirlo sería ruido.
 */
export function cuentasPorPaciente(data: AppData): CuentaDePaciente[] {
  const pagosPorPaciente = new Map<string, Payment[]>();
  for (const p of data.payments) {
    const suyos = pagosPorPaciente.get(p.patientId);
    if (suyos) suyos.push(p);
    else pagosPorPaciente.set(p.patientId, [p]);
  }

  const sesionesPorPaciente = new Map<string, Session[]>();
  for (const s of data.sessions) {
    const suyas = sesionesPorPaciente.get(s.patientId);
    if (suyas) suyas.push(s);
    else sesionesPorPaciente.set(s.patientId, [s]);
  }

  const cuentas: CuentaDePaciente[] = [];
  for (const patient of data.patients) {
    const suyas = sesionesPorPaciente.get(patient.id) ?? [];
    const pagos = pagosPorPaciente.get(patient.id) ?? [];
    const imputado = imputarPagos(suyas, pagos);

    const porMes = new Map<string, MesDeCuenta>();
    for (const s of suyas) {
      if (!isBillable(s)) continue;
      const clave = monthKey(s.date);
      let m = porMes.get(clave);
      if (!m) {
        m = { mes: clave, sesiones: 0, facturado: 0, cobrado: 0, pendiente: 0 };
        porMes.set(clave, m);
      }
      m.sesiones += 1;
      m.facturado += s.fee;
      m.cobrado += imputado.get(s.id) ?? 0;
    }

    const meses = [...porMes.values()].sort((a, b) => b.mes.localeCompare(a.mes));
    let facturado = 0;
    let cobrado = 0;
    for (const m of meses) {
      m.pendiente = Math.max(0, m.facturado - m.cobrado);
      facturado += m.facturado;
      cobrado += m.cobrado;
    }

    if (meses.length === 0 && pagos.length === 0) continue;

    cuentas.push({
      patient,
      meses,
      facturado,
      cobrado,
      debe: Math.max(0, facturado - cobrado),
      aFavor: sobranteNoImputado(suyas, pagos),
    });
  }

  /*
   * Primero quien más debe.
   *
   * Es una lista para reclamar, no un padrón: ordenarla por nombre obligaría a
   * recorrerla entera para encontrar a quién hay que escribirle. A igual deuda
   * va el nombre, para que el orden no dependa de cómo vinieron los datos.
   */
  return cuentas.sort((a, b) => b.debe - a.debe || a.patient.name.localeCompare(b.patient.name, 'es'));
}
