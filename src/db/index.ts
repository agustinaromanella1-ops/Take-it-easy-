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
  // v2 — plantillas reutilizables y preferencias
  `
  CREATE TABLE IF NOT EXISTS templates (
    id        TEXT PRIMARY KEY NOT NULL,
    name      TEXT NOT NULL,
    body      TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
  // v3 — mensajes a grupos. Lo que ya existía es de contactos, que es el
  // valor por defecto, así que la migración no toca ninguna fila.
  `
  ALTER TABLE messages ADD COLUMN recipientKind TEXT NOT NULL DEFAULT 'contacto';
  `,
  // v4 — distinguir lo programado de lo que se viene pateando.
  `
  ALTER TABLE messages ADD COLUMN postponedAt TEXT;
  `,
  // v5 — desde qué WhatsApp sale cada mensaje. Null significa "lo que diga
  // Ajustes", así que las filas que ya existían no cambian de comportamiento.
  `
  ALTER TABLE messages ADD COLUMN whatsappApp TEXT;
  `,
  // v6 a v9 — archivo adjunto. Se guarda el NOMBRE del archivo dentro de la
  // carpeta de adjuntos, no la ruta: en iOS la carpeta de la app cambia de
  // nombre en cada actualización y una ruta absoluta guardada hoy apunta a
  // la nada mañana.
  //
  // Van en cuatro pasos y no en uno solo con las cuatro sentencias porque
  // execAsync no las envuelve en una transacción: cortándose en la tercera,
  // el paso quedaría sin marcar y al reintentarlo la primera fallaría con
  // "duplicate column name". Eso es exactamente lo que la marca por paso
  // viene a evitar.
  'ALTER TABLE messages ADD COLUMN attachmentFile TEXT;',
  'ALTER TABLE messages ADD COLUMN attachmentName TEXT;',
  'ALTER TABLE messages ADD COLUMN attachmentMime TEXT;',
  'ALTER TABLE messages ADD COLUMN attachmentBytes INTEGER;',
];

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let version = row?.user_version ?? 0;

  // La marca se guarda después de CADA migración, no al final. Las de la v3
  // en adelante son ALTER TABLE, que no se pueden repetir: si el proceso se
  // corta entre dos, al arrancar de nuevo el bucle reintentaría una columna
  // que ya existe, fallaría con "duplicate column name", y como getDb()
  // memoriza la promesa rechazada, toda la base quedaría inaccesible para
  // siempre. Con la marca por paso, cada arranque retoma donde quedó.
  for (let i = version; i < MIGRATIONS.length; i += 1) {
    const sql = MIGRATIONS[i];
    if (!sql) continue;
    await db.execAsync(sql);
    version = i + 1;
    await db.execAsync(`PRAGMA user_version = ${version}`);
  }
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
