import * as SQLite from 'expo-sqlite';

const DB_NAME = 'listo-para-enviar.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const MIGRATIONS: string[] = [
  // v1 — tabla inicial
  `
  CREATE TABLE IF NOT EXISTS messages (
    id             TEXT PRIMARY KEY NOT NULL,
    contactName    TEXT,
    phoneE164      TEXT NOT NULL,
    body           TEXT NOT NULL,
    scheduledAt    TEXT,
    localAt        TEXT,
    timezone       TEXT NOT NULL,
    status         TEXT NOT NULL,
    createdAt      TEXT NOT NULL,
    firedAt        TEXT,
    sentAt         TEXT,
    recurrenceRule TEXT,
    notes          TEXT,
    notificationId TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_messages_status_scheduled
    ON messages(status, scheduledAt);
  `,
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;

  for (let i = version; i < MIGRATIONS.length; i += 1) {
    const sql = MIGRATIONS[i];
    if (!sql) continue;
    await db.execAsync(sql);
    version = i + 1;
  }

  await db.execAsync(`PRAGMA user_version = ${version}`);
}

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      await db.execAsync('PRAGMA journal_mode = WAL');
      await migrate(db);
      return db;
    })();
  }
  return dbPromise;
}

/** Id local. No necesita fuerza criptográfica: nunca sale del dispositivo. */
export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
