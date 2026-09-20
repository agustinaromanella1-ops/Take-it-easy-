import type { AppData, Cents, DateISO, Patient, Session } from '../types';
import { addDays, daysBetween, timeToMinutes, toISODate } from './dates';
import { patientBalances } from '../store/selectors';

/**
 * Lo que quedó abierto, en un solo lugar y ordenado por lo que cuesta
 * olvidarlo.
 *
 * La app ya mostraba cada cosa en su pantalla: las sesiones sin cerrar en el
 * inicio, las deudas en finanzas, los turnos en la agenda. Repartido así hay
 * que acordarse de ir a mirar los tres lugares, y acordarse de mirar es
 * exactamente lo que no conviene pedir.
 *
 * La otra mitad de la idea está en la pantalla: de esta lista se muestra UNA
 * cosa con su botón, y el resto plegado. Una lista larga arriba de todo pide
 * elegir por dónde empezar, y elegir cansa más que hacer.
 */
/**
 * Cada cosa abierta lleva `peso` —qué tipo de cosa es— y `desdeDias` —cuánto
 * hace—. El orden sale de los dos: primero el tipo que más cuesta olvidar, y
 * dentro de cada tipo lo más viejo. Antes la antigüedad iba empaquetada dentro
 * del peso con un tope, y dos deudas más viejas que el tope quedaban empatadas:
 * desempataba la clave, que es el id generado al azar.
 */
export type Pendiente =
  /** Una sesión que ya pasó y sigue marcada como programada. */
  | { clave: string; tipo: 'cerrar'; peso: number; desdeDias: number; sesion: Session; paciente: Patient | null }
  /** Un paciente que viene seguido y no tiene próximo turno. */
  | { clave: string; tipo: 'agendar'; peso: number; paciente: Patient; desdeDias: number }
  /** Plata de sesiones viejas que todavía no entró. */
  | { clave: string; tipo: 'cobrar'; peso: number; paciente: Patient; monto: Cents; desdeDias: number };

/**
 * Desde cuándo una deuda deja de ser "el mes en curso" y pasa a ser algo para
 * mirar. Cobrar a fin de mes es normal; que se vaya a dos meses, no.
 */
const DIAS_PARA_MIRAR_UNA_DEUDA = 45;

/** Cada cuánto se espera ver a alguien, según su frecuencia. */
const ESPERA_DIAS: Partial<Record<Patient['frequency'], number>> = {
  semanal: 7,
  quincenal: 14,
  mensual: 30,
};

/**
 * `minutos` son los minutos transcurridos del día. Solo hace falta para no
 * dar por terminada una sesión de ayer que todavía está pasando —de 23:00 a
 * 01:00—; por omisión se toma el día de ayer como cerrado, que es lo que vale
 * en cualquier otro momento.
 */
export function pendientes(data: AppData, hoy: DateISO, minutos = 24 * 60): Pendiente[] {
  const porId = new Map(data.patients.map((p) => [p.id, p]));
  const lista: Pendiente[] = [];
  const ayer = addDays(hoy, -1);

  // 1. Sesiones sin cerrar. Van primero porque hasta cerrarlas no existen para
  //    la facturación: es trabajo hecho que la app todavía no cuenta.
  for (const s of data.sessions) {
    if (s.status !== 'programada' || s.date >= hoy) continue;
    // Una sesión de anoche que sigue corriendo no "quedó sin marcar": está
    // pasando. Decirle lo contrario a alguien que está atendiendo es peor que
    // no decir nada.
    if (s.date === ayer && timeToMinutes(s.time) + s.durationMin - 24 * 60 > minutos) continue;
    lista.push({
      clave: `cerrar:${s.id}`,
      tipo: 'cerrar',
      peso: 300,
      desdeDias: daysBetween(s.date, hoy),
      sesion: s,
      paciente: porId.get(s.patientId) ?? null,
    });
  }

  const saldos = patientBalances(data);

  for (const p of data.patients) {
    if (p.status !== 'activo') continue;
    const saldo = saldos.get(p.id);

    // 2. Pacientes que vienen seguido y se quedaron sin próximo turno. Es el
    //    olvido más caro de todos: no deja rastro en ninguna pantalla.
    const espera = ESPERA_DIAS[p.frequency];
    if (espera !== undefined) {
      const tieneProximo = data.sessions.some(
        (s) => s.patientId === p.id && s.status === 'programada' && s.date >= hoy,
      );
      const ultima = saldo?.lastSessionDate ?? null;
      const desdeDias = ultima ? daysBetween(ultima, hoy) : daysBetween(fechaLocalDe(p.createdAt), hoy);
      // Recién cuando pasó la espera propia de su frecuencia: agendar con dos
      // semanas de anticipación no es una tarea pendiente, es una elección.
      if (!tieneProximo && desdeDias >= espera) {
        lista.push({ clave: `agendar:${p.id}`, tipo: 'agendar', peso: 200, paciente: p, desdeDias });
      }
    }

    // 3. Deuda vieja. La del mes en curso no se nombra: cobrar a fin de mes es
    //    lo normal y avisarlo antes sería ruido.
    if (saldo && saldo.balance > 0 && saldo.lastSessionDate) {
      const desdeDias = diasDeLaDeudaMasVieja(data, p.id, hoy);
      if (desdeDias >= DIAS_PARA_MIRAR_UNA_DEUDA) {
        lista.push({
          clave: `cobrar:${p.id}`,
          tipo: 'cobrar',
          peso: 100,
          paciente: p,
          monto: saldo.balance,
          desdeDias,
        });
      }
    }
  }

  // Primero el tipo que más cuesta olvidar; dentro de cada tipo, lo más viejo.
  // `clave` solo desempata dos cosas igual de viejas, para que el orden no
  // dependa de cómo vinieron los datos. Importa más de lo que parece: la
  // pantalla muestra UNA sola tarjeta, así que esto decide lo único que se ve.
  return lista.sort(
    (a, b) => b.peso - a.peso || b.desdeDias - a.desdeDias || a.clave.localeCompare(b.clave),
  );
}

/**
 * Antigüedad de la sesión más vieja que todavía no está paga.
 *
 * Los pagos se imputan a las sesiones de la más vieja a la más nueva, que es
 * como se lleva una cuenta corriente: quien paga todos los meses y debe el
 * último no tiene una deuda vieja, por más que sea paciente desde hace años.
 * Mirar solo la sesión más antigua diría lo contrario y el aviso sería falso.
 */
function diasDeLaDeudaMasVieja(data: AppData, patientId: string, hoy: DateISO): number {
  const facturables = data.sessions
    .filter((s) => s.patientId === patientId && esFacturable(s))
    .sort((a, b) => a.date.localeCompare(b.date));

  let bolsa = data.payments
    .filter((p) => p.patientId === patientId)
    .reduce((t, p) => t + p.amount, 0);

  for (const s of facturables) {
    if (bolsa >= s.fee) {
      bolsa -= s.fee;
      continue;
    }
    return daysBetween(s.date, hoy);
  }
  return 0;
}

/**
 * La fecha local de un sello.
 *
 * `createdAt` es un ISO completo en UTC. Cortarlo con `slice(0, 10)` da la
 * fecha UTC: en Argentina, alguien cargado un jueves a las 22:00 queda con
 * fecha del viernes y la cuenta de días sale un día corta. Es la trampa de las
 * fechas de CLAUDE.md, entrando por la puerta del sello en vez de la del
 * `new Date('2026-03-10')`.
 */
function fechaLocalDe(sello: string): DateISO {
  if (sello.length === 10) return sello;
  const d = new Date(sello);
  return Number.isNaN(d.getTime()) ? sello.slice(0, 10) : toISODate(d);
}

/** Las mismas reglas que usa el saldo: realizada siempre, ausente si se cobra. */
function esFacturable(s: Session): boolean {
  if (s.status === 'realizada') return true;
  return s.status === 'ausente' && s.chargeable;
}
