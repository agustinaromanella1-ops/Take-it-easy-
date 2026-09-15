import { db } from './db';

export async function leerPreferencia<T>(clave: string): Promise<T | undefined> {
  return (await db.preferencias.get(clave))?.valor as T | undefined;
}

export async function guardarPreferencia(clave: string, valor: unknown): Promise<void> {
  await db.preferencias.put({ clave, valor });
}

/** Volver a ver el instructivo: se olvidan las pistas y la bienvenida. */
export async function olvidarInstructivo(): Promise<void> {
  const claves = await db.preferencias.toCollection().primaryKeys();
  await db.preferencias.bulkDelete(
    claves.filter((c) => c === 'intro-vista' || c.startsWith('pista:')),
  );
}
