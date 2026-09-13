import { getDb, newId } from './index';
import { deviceTimezone, wallToUtc } from '../domain/time';
import type {
  MessageStatus,
  NewMessageInput,
  ScheduledMessage,
} from '../domain/types';

const COLUMNS = `id, contactName, phoneE164, body, scheduledAt, localAt,
  timezone, status, createdAt, firedAt, sentAt, recurrenceRule, notes,
  notificationId`;

type Row = ScheduledMessage;

export async function listAll(): Promise<ScheduledMessage[]> {
  const db = await getDb();
  return db.getAllAsync<Row>(
    `SELECT ${COLUMNS} FROM messages ORDER BY scheduledAt IS NULL, scheduledAt ASC, createdAt DESC`,
  );
}

export async function getById(id: string): Promise<ScheduledMessage | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<Row>(
    `SELECT ${COLUMNS} FROM messages WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function create(
  input: NewMessageInput,
): Promise<ScheduledMessage> {
  const db = await getDb();
  const timezone = input.timezone ?? deviceTimezone();
  const localAt = input.localAt ?? null;

  const message: ScheduledMessage = {
    id: newId(),
    contactName: input.contactName ?? null,
    phoneE164: input.phoneE164,
    body: input.body,
    localAt,
    scheduledAt: localAt ? wallToUtc(localAt, timezone).toISOString() : null,
    timezone,
    status: localAt ? 'scheduled' : 'draft',
    createdAt: new Date().toISOString(),
    firedAt: null,
    sentAt: null,
    recurrenceRule: null,
    notes: input.notes ?? null,
    notificationId: null,
  };

  await db.runAsync(
    `INSERT INTO messages (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.contactName,
      message.phoneE164,
      message.body,
      message.scheduledAt,
      message.localAt,
      message.timezone,
      message.status,
      message.createdAt,
      message.firedAt,
      message.sentAt,
      message.recurrenceRule,
      message.notes,
      message.notificationId,
    ],
  );

  return message;
}

type Patch = Partial<
  Pick<
    ScheduledMessage,
    | 'contactName'
    | 'phoneE164'
    | 'body'
    | 'localAt'
    | 'scheduledAt'
    | 'timezone'
    | 'status'
    | 'firedAt'
    | 'sentAt'
    | 'notes'
    | 'notificationId'
  >
>;

export async function update(id: string, patch: Patch): Promise<void> {
  const keys = Object.keys(patch) as (keyof Patch)[];
  if (keys.length === 0) return;

  const db = await getDb();
  const assignments = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k] ?? null);
  await db.runAsync(`UPDATE messages SET ${assignments} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

/**
 * Cambia el momento de envío. Recalcula el instante UTC desde la hora de pared
 * para que "las 9" sigan siendo las 9 aunque cambie el huso, y deja el mensaje
 * como programado de nuevo (sirve tanto para reprogramar como para posponer).
 */
export async function reschedule(
  id: string,
  localAt: string,
  timezone: string,
): Promise<void> {
  await update(id, {
    localAt,
    timezone,
    scheduledAt: wallToUtc(localAt, timezone).toISOString(),
    status: 'scheduled',
    firedAt: null,
  });
}

export async function setStatus(
  id: string,
  status: MessageStatus,
): Promise<void> {
  const patch: Patch = { status };
  if (status === 'sent') patch.sentAt = new Date().toISOString();
  if (status === 'fired') patch.firedAt = new Date().toISOString();
  await update(id, patch);
}

export async function remove(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM messages WHERE id = ?', [id]);
}

/** Vuelve a insertar un mensaje tal cual, para el "deshacer" del borrado. */
export async function restore(message: ScheduledMessage): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO messages (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.contactName,
      message.phoneE164,
      message.body,
      message.scheduledAt,
      message.localAt,
      message.timezone,
      message.status,
      message.createdAt,
      message.firedAt,
      message.sentAt,
      message.recurrenceRule,
      message.notes,
      message.notificationId,
    ],
  );
}
