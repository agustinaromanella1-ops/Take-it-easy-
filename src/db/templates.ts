import { getDb, newId } from './index';
import type { Template } from '../domain/templates';

export async function listTemplates(): Promise<Template[]> {
  const db = await getDb();
  return db.getAllAsync<Template>(
    'SELECT id, name, body, createdAt FROM templates ORDER BY name COLLATE NOCASE ASC',
  );
}

export async function createTemplate(
  name: string,
  body: string,
): Promise<Template> {
  const db = await getDb();
  const template: Template = {
    id: newId(),
    name,
    body,
    createdAt: new Date().toISOString(),
  };
  await db.runAsync(
    'INSERT INTO templates (id, name, body, createdAt) VALUES (?, ?, ?, ?)',
    [template.id, template.name, template.body, template.createdAt],
  );
  return template;
}

export async function updateTemplate(
  id: string,
  patch: { name?: string; body?: string },
): Promise<void> {
  const db = await getDb();
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  if (keys.length === 0) return;
  await db.runAsync(
    `UPDATE templates SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`,
    [...keys.map((k) => patch[k] ?? null), id],
  );
}

export async function removeTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM templates WHERE id = ?', [id]);
}

export async function replaceAllTemplates(
  templates: Template[],
): Promise<void> {
  const db = await getDb();
  for (const t of templates) {
    await db.runAsync(
      'INSERT OR REPLACE INTO templates (id, name, body, createdAt) VALUES (?, ?, ?, ?)',
      [t.id, t.name, t.body, t.createdAt],
    );
  }
}
