import type { MessageStatus, ScheduledMessage } from './types';
import type { Template } from './templates';

export const BACKUP_VERSION = 1;

export interface BackupFile {
  version: number;
  exportedAt: string;
  messages: ScheduledMessage[];
  templates: Template[];
}

export function serializeBackup(
  messages: ScheduledMessage[],
  templates: Template[],
): string {
  const payload: BackupFile = {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    messages,
    templates,
  };
  return JSON.stringify(payload, null, 2);
}

export class BackupError extends Error {}

const ESTADOS: MessageStatus[] = [
  'draft',
  'scheduled',
  'fired',
  'sent',
  'skipped',
];

const texto = (v: unknown): v is string => typeof v === 'string';
/** Las columnas que aceptan null tienen que ser null, no faltar: un
 *  `undefined` no es un valor que SQLite sepa ligar y rompe la inserción. */
const opcional = (v: unknown): v is string | null | undefined =>
  v === null || v === undefined || typeof v === 'string';

const isMessage = (value: unknown): value is ScheduledMessage => {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;

  const obligatorios =
    texto(m['id']) &&
    // Un grupo no tiene número: la columna existe pero va vacía.
    texto(m['phoneE164']) &&
    texto(m['body']) &&
    texto(m['timezone']) &&
    texto(m['createdAt']) &&
    texto(m['status']) &&
    (ESTADOS as string[]).includes(m['status'] as string);

  if (!obligatorios) return false;

  const nulables = (
    ['contactName', 'localAt', 'scheduledAt', 'firedAt', 'sentAt', 'postponedAt', 'recurrenceRule', 'notes', 'notificationId', 'attachmentFile', 'attachmentName', 'attachmentMime'] as const
  ).every((k) => opcional(m[k]));

  if (!nulables) return false;

  const bytes = m['attachmentBytes'];
  if (bytes !== null && bytes !== undefined && typeof bytes !== 'number') {
    return false;
  }

  // Un mensaje con fecha pendiente pero sin localAt no cae en ninguna lista:
  // lo cuenta el contador de pendientes y no lo dibuja ninguna pantalla, así
  // que no se puede abrir ni cancelar nunca más.
  // Un grupo se identifica solo por su nombre; sin nombre no se sabría a
  // quién iba y la tarjeta quedaría sin título.
  const kind = m['recipientKind'] ?? 'contacto';
  if (kind !== 'contacto' && kind !== 'grupo') return false;
  if (kind === 'grupo' && !texto(m['contactName'])) return false;
  if (kind === 'contacto' && m['phoneE164'] === '') return false;

  const conFecha = m['status'] === 'scheduled' || m['status'] === 'fired';
  return !conFecha || texto(m['localAt']);
};

/** Completa con null lo que el archivo no traiga, para poder insertarlo. */
const normalizar = (m: ScheduledMessage): ScheduledMessage => ({
  ...m,
  recipientKind: m.recipientKind ?? 'contacto',
  contactName: m.contactName ?? null,
  localAt: m.localAt ?? null,
  scheduledAt: m.scheduledAt ?? null,
  firedAt: m.firedAt ?? null,
  sentAt: m.sentAt ?? null,
  postponedAt: m.postponedAt ?? null,
  whatsappApp:
    m.whatsappApp === 'normal' || m.whatsappApp === 'business'
      ? m.whatsappApp
      : null,
  recurrenceRule: m.recurrenceRule ?? null,
  notes: m.notes ?? null,
  notificationId: null,
  // El backup lleva el NOMBRE del adjunto, no el archivo: meter fotos y PDFs
  // adentro del JSON lo volvería de cientos de megas. Quien importa se
  // encarga de comprobar si el archivo sigue estando en este teléfono; si no
  // está, limpia estas columnas y avisa cuántos mensajes se quedaron sin él.
  attachmentFile: m.attachmentFile ?? null,
  attachmentName: m.attachmentName ?? null,
  attachmentMime: m.attachmentMime ?? null,
  attachmentBytes:
    typeof m.attachmentBytes === 'number' ? m.attachmentBytes : null,
});

const isTemplate = (value: unknown): value is Template => {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return typeof t['id'] === 'string' && typeof t['body'] === 'string';
};

/**
 * Valida la forma del archivo antes de tocar la base. Un backup corrupto o de
 * otra app tiene que fallar con un mensaje entendible, no a mitad de la
 * importación con la mitad de los datos adentro.
 */
export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError('El archivo no es un backup válido.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new BackupError('El archivo no es un backup válido.');
  }

  const file = parsed as Record<string, unknown>;

  if (typeof file['version'] !== 'number') {
    throw new BackupError('El archivo no es un backup de esta app.');
  }
  if (file['version'] > BACKUP_VERSION) {
    throw new BackupError(
      'Ese backup lo hizo una versión más nueva de la app. Actualizala para poder importarlo.',
    );
  }

  const messages = Array.isArray(file['messages']) ? file['messages'] : [];
  const templates = Array.isArray(file['templates']) ? file['templates'] : [];

  if (!messages.every(isMessage)) {
    throw new BackupError('Hay mensajes con un formato que no reconocemos.');
  }
  if (!templates.every(isTemplate)) {
    throw new BackupError('Hay plantillas con un formato que no reconocemos.');
  }

  return {
    version: file['version'],
    exportedAt:
      typeof file['exportedAt'] === 'string' ? file['exportedAt'] : '',
    messages: messages.map(normalizar),
    templates,
  };
}
