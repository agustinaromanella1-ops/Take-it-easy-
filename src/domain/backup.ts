import type { ScheduledMessage } from './types';
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

const isMessage = (value: unknown): value is ScheduledMessage => {
  if (typeof value !== 'object' || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m['id'] === 'string' &&
    typeof m['phoneE164'] === 'string' &&
    typeof m['body'] === 'string' &&
    typeof m['timezone'] === 'string' &&
    typeof m['status'] === 'string'
  );
};

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
    messages,
    templates,
  };
}
