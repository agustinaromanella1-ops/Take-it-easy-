/**
 * Modelo de datos de Pipí Cucú.
 *
 * Dos decisiones de diseño que atraviesan todo el modelo:
 *
 * 1. El dinero se guarda SIEMPRE como entero en centavos (`number`). Usar
 *    decimales para plata provoca errores de redondeo acumulados: 0.1 + 0.2
 *    no da 0.3 en punto flotante. Ver `lib/money.ts`.
 *
 * 2. Las fechas de agenda se guardan como `"YYYY-MM-DD"` + `"HH:mm"` en hora
 *    local, no como timestamps UTC. Un turno de las 15:00 del martes es a las
 *    15:00 del martes, independientemente de la zona horaria del dispositivo.
 *    Ver `lib/dates.ts`.
 */

/** Fecha local en formato `YYYY-MM-DD`. */
export type DateISO = string;

/** Hora local en formato `HH:mm` (24 h). */
export type TimeHM = string;

/** Monto entero en centavos. Nunca un decimal. */
export type Cents = number;

export type PatientStatus = 'activo' | 'inactivo';

/** Cada cuánto se ve al paciente. Define la repetición sugerida al agendar. */
export type Frequency = 'semanal' | 'quincenal' | 'mensual' | 'puntual';

/** De dónde viene el paciente. Cambia cómo se lee la agenda de un vistazo. */
export type PatientKind = 'particular' | 'institucion' | 'evaluacion';

export interface Patient {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** Honorario habitual por sesión, en centavos. Se usa como valor por defecto al agendar. */
  defaultFee: Cents;
  status: PatientStatus;
  /** Índice dentro de `PATIENT_COLORS`. Identifica al paciente de un vistazo en la agenda. */
  colorIndex: number;
  frequency: Frequency;
  kind: PatientKind;
  /** DNI del paciente. Va en la factura cuando no hay número de afiliado. */
  document: string;
  /** Número de afiliado a la obra social o prepaga. */
  memberNumber: string;
  /** Nombre de la obra social o prepaga, si corresponde. */
  insurer: string;
  /** Fecha del último cambio de honorario. Se actualiza sola al editar la
   *  tarifa, para saber cuándo toca revisarla sin llevar la cuenta a mano. */
  lastRaise: DateISO | null;
  notes: string;
  createdAt: string;
}

/**
 * Estado de una sesión.
 *
 * `programada`  -> todavía no ocurrió.
 * `realizada`   -> el paciente asistió; genera deuda por el honorario.
 * `ausente`     -> el paciente faltó sin avisar; genera deuda si la política del
 *                  consultorio es cobrar la ausencia (`chargeable`).
 * `cancelada`   -> cancelada con aviso; no genera deuda.
 */
export type SessionStatus = 'programada' | 'realizada' | 'ausente' | 'cancelada';

export interface Session {
  id: string;
  patientId: string;
  date: DateISO;
  time: TimeHM;
  /** Duración en minutos. Se usa para detectar superposiciones en la agenda. */
  durationMin: number;
  status: SessionStatus;
  /** Honorario de ESTA sesión en centavos. Se copia del paciente al crearla,
   *  pero queda congelado: subir la tarifa no debe reescribir el pasado. */
  fee: Cents;
  /** Solo aplica a `ausente`: si esa ausencia se cobra o no. */
  chargeable: boolean;
  notes: string;
}

export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'otro';

export interface Payment {
  id: string;
  patientId: string;
  date: DateISO;
  amount: Cents;
  method: PaymentMethod;
  notes: string;
}

/**
 * Lo que la usuaria carga en la calculadora de tarifa. Se guarda para no tener
 * que volver a escribirlo cada vez que quiere recalcular.
 */
export interface RateInputs {
  /** Lo que quiere llevarse por mes, ya limpio de impuestos y gastos. */
  targetIncome: Cents;
  /** Gastos fijos del consultorio por mes: alquiler, supervisión, matrícula. */
  fixedCosts: Cents;
  /** Sesiones que puede dar por semana. */
  sessionsPerWeek: number;
  /** Porcentaje que se va en impuestos y aportes (0-99). */
  taxPercent: number;
  /** Porcentaje de sesiones que espera perder por ausencias y cancelaciones (0-99). */
  noShowPercent: number;
}

export interface Settings {
  /** Profesión que aparece en el texto de la factura: "sesión de {profesión}". */
  profession: string;
  /** Símbolo de moneda a mostrar. El cálculo es agnóstico a la moneda. */
  currency: string;
  /** Duración por defecto de una sesión nueva, en minutos. */
  defaultDurationMin: number;
  /** Si las ausencias sin aviso se cobran por defecto. */
  chargeNoShowByDefault: boolean;
  /** Cuánto se propone facturar por mes. Cero significa sin meta definida. */
  monthlyGoal: Cents;
  /** Minutos de antelación de la alarma al mandar un turno al calendario. */
  reminderMinutes: number;
  rateInputs: RateInputs;
}

export interface AppData {
  /** Versión del esquema persistido. Habilita migraciones sin perder datos. */
  version: number;
  patients: Patient[];
  sessions: Session[];
  payments: Payment[];
  settings: Settings;
}
