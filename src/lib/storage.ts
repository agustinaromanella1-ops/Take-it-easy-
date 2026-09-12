import type { AppData, Patient, Payment, Session, Settings } from '../types';
import { isValidISODate, isValidTime } from './dates';

export const STORAGE_KEY = 'psicofinance:data';
export const SCHEMA_VERSION = 1;

export const DEFAULT_SETTINGS: Settings = {
  currency: '$',
  defaultDurationMin: 50,
  chargeNoShowByDefault: true,
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
    settings: {
      currency: str(rawSettings.currency, DEFAULT_SETTINGS.currency) || DEFAULT_SETTINGS.currency,
      defaultDurationMin: Math.max(5, int(rawSettings.defaultDurationMin, DEFAULT_SETTINGS.defaultDurationMin)),
      chargeNoShowByDefault: bool(rawSettings.chargeNoShowByDefault, DEFAULT_SETTINGS.chargeNoShowByDefault),
    },
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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
