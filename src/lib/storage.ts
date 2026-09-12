import type { AppData, Frequency, Patient, PatientKind, Payment, Session, Settings } from '../types';
import { PATIENT_COLORS } from './palette';
import { isValidISODate, isValidTime } from './dates';

export const STORAGE_KEY = 'pipicucu:data';

/**
 * Claves que usó la app con sus nombres anteriores, de la más reciente a la más
 * vieja.
 *
 * Renombrar la app no puede borrarle los datos a quien ya la venía usando: si
 * no aparece nada bajo la clave actual, se leen las anteriores en este orden.
 * Importa que vaya de nueva a vieja: alguien que pasó por las dos versiones
 * tiene datos en ambas, y los de la más reciente son los buenos.
 *
 * Las claves viejas no se borran —quedan como respaldo— porque a partir del
 * primer guardado la app escribe siempre en la nueva.
 */
const LEGACY_KEYS = ['encuadre:data', 'psicofinance:data'] as const;
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  currency: '$',
  defaultDurationMin: 50,
  chargeNoShowByDefault: true,
  profession: 'psicología',
  monthlyGoal: 0,
  reminderMinutes: 30,
  rateInputs: {
    targetIncome: 0,
    fixedCosts: 0,
    sessionsPerWeek: 20,
    taxPercent: 0,
    noShowPercent: 10,
  },
};

export function emptyData(): AppData {
  return {
    version: SCHEMA_VERSION,
    patients: [],
    sessions: [],
    payments: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/* --- Helpers de validación -------------------------------------------------
 * Lo que vuelve de localStorage es texto que pudo ser editado a mano, quedar de
 * una versión vieja de la app o corromperse. Se valida campo por campo y se
 * descarta lo inválido en vez de confiar en un `as AppData`, que haría que la
 * app explote más tarde y lejos de la causa real.
 */

const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

const int = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

const FREQUENCIES = new Set<Frequency>(['semanal', 'quincenal', 'mensual', 'puntual']);
const KINDS = new Set<PatientKind>(['particular', 'institucion', 'evaluacion']);

/** Acota un número al rango dado, devolviendo el valor por defecto si no es finito. */
function clamp(v: unknown, min: number, max: number, fallback: number): number {
  const n = int(v, fallback);
  return Math.min(max, Math.max(min, n));
}

function parsePatient(raw: unknown): Patient | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const name = str(raw.name).trim();
  if (!id || !name) return null;
  return {
    id,
    name,
    email: str(raw.email),
    phone: str(raw.phone),
    defaultFee: Math.max(0, int(raw.defaultFee, 0)),
    status: raw.status === 'inactivo' ? 'inactivo' : 'activo',
    colorIndex: clamp(raw.colorIndex, 0, PATIENT_COLORS.length - 1, 0),
    frequency: FREQUENCIES.has(str(raw.frequency) as Frequency) ? (raw.frequency as Frequency) : 'semanal',
    kind: KINDS.has(str(raw.kind) as PatientKind) ? (raw.kind as PatientKind) : 'particular',
    document: str(raw.document),
    memberNumber: str(raw.memberNumber),
    insurer: str(raw.insurer),
    lastRaise: isValidISODate(str(raw.lastRaise)) ? str(raw.lastRaise) : null,
    notes: str(raw.notes),
    createdAt: str(raw.createdAt, new Date().toISOString()),
  };
}

const SESSION_STATUSES = new Set(['programada', 'realizada', 'ausente', 'cancelada']);

function parseSession(raw: unknown, patientIds: Set<string>): Session | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const patientId = str(raw.patientId);
  const date = str(raw.date);
  const time = str(raw.time);
  // Una sesión huérfana (paciente borrado) rompería todos los reportes: se descarta.
  if (!id || !patientIds.has(patientId)) return null;
  if (!isValidISODate(date) || !isValidTime(time)) return null;
  const status = SESSION_STATUSES.has(str(raw.status)) ? (raw.status as Session['status']) : 'programada';
  return {
    id,
    patientId,
    date,
    time,
    durationMin: Math.max(5, int(raw.durationMin, DEFAULT_SETTINGS.defaultDurationMin)),
    status,
    fee: Math.max(0, int(raw.fee, 0)),
    chargeable: bool(raw.chargeable, true),
    notes: str(raw.notes),
  };
}

const PAYMENT_METHODS = new Set(['efectivo', 'transferencia', 'tarjeta', 'otro']);

function parsePayment(raw: unknown, patientIds: Set<string>): Payment | null {
  if (!isRecord(raw)) return null;
  const id = str(raw.id);
  const patientId = str(raw.patientId);
  const date = str(raw.date);
  if (!id || !patientIds.has(patientId) || !isValidISODate(date)) return null;
  const amount = int(raw.amount, 0);
  if (amount <= 0) return null;
  return {
    id,
    patientId,
    date,
    amount,
    method: PAYMENT_METHODS.has(str(raw.method)) ? (raw.method as Payment['method']) : 'efectivo',
    notes: str(raw.notes),
  };
}

/** Normaliza cualquier entrada a un `AppData` consistente. Nunca lanza. */
export function parseAppData(raw: unknown): AppData {
  if (!isRecord(raw)) return emptyData();

  const patients = Array.isArray(raw.patients)
    ? raw.patients.map(parsePatient).filter((p): p is Patient => p !== null)
    : [];
  const patientIds = new Set(patients.map((p) => p.id));

  const sessions = Array.isArray(raw.sessions)
    ? raw.sessions.map((s) => parseSession(s, patientIds)).filter((s): s is Session => s !== null)
    : [];
  const payments = Array.isArray(raw.payments)
    ? raw.payments.map((p) => parsePayment(p, patientIds)).filter((p): p is Payment => p !== null)
    : [];

  const rawSettings = isRecord(raw.settings) ? raw.settings : {};
  return {
    version: SCHEMA_VERSION,
    patients,
    sessions,
    payments,
    settings: parseSettings(rawSettings),
  };
}

function parseSettings(raw: Record<string, unknown>): Settings {
  const rawRate = isRecord(raw.rateInputs) ? raw.rateInputs : {};
  const d = DEFAULT_SETTINGS;
  return {
    currency: str(raw.currency, d.currency) || d.currency,
    defaultDurationMin: clamp(raw.defaultDurationMin, 5, 480, d.defaultDurationMin),
    chargeNoShowByDefault: bool(raw.chargeNoShowByDefault, d.chargeNoShowByDefault),
    profession: str(raw.profession, d.profession) || d.profession,
    monthlyGoal: Math.max(0, int(raw.monthlyGoal, d.monthlyGoal)),
    reminderMinutes: clamp(raw.reminderMinutes, 0, 1440, d.reminderMinutes),
    rateInputs: {
      targetIncome: Math.max(0, int(rawRate.targetIncome, d.rateInputs.targetIncome)),
      fixedCosts: Math.max(0, int(rawRate.fixedCosts, d.rateInputs.fixedCosts)),
      sessionsPerWeek: clamp(rawRate.sessionsPerWeek, 1, 100, d.rateInputs.sessionsPerWeek),
      taxPercent: clamp(rawRate.taxPercent, 0, 99, d.rateInputs.taxPercent),
      noShowPercent: clamp(rawRate.noShowPercent, 0, 99, d.rateInputs.noShowPercent),
    },
  };
}

/** Lee la clave actual y, si está vacía, las de versiones anteriores. */
function readRaw(): string | null {
  const current = localStorage.getItem(STORAGE_KEY);
  if (current !== null) return current;
  for (const key of LEGACY_KEYS) {
    const legacy = localStorage.getItem(key);
    if (legacy !== null) return legacy;
  }
  return null;
}

export function loadData(): AppData {
  try {
    const raw = readRaw();
    if (!raw) return emptyData();
    return parseAppData(JSON.parse(raw));
  } catch {
    // Modo incógnito, storage deshabilitado o JSON corrupto: se arranca vacío
    // en vez de dejar la app en pantalla blanca.
    return emptyData();
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
