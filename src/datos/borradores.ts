import { db } from './db';

export async function leerBorrador<T>(clave: string): Promise<T | undefined> {
  const guardado = await db.borradores.get(clave);
  return guardado?.contenido as T | undefined;
}

export async function guardarBorrador(clave: string, contenido: unknown): Promise<void> {
  await db.borradores.put({ clave, contenido, guardadoEn: Date.now() });
}

export async function borrarBorrador(clave: string): Promise<void> {
  await db.borradores.delete(clave);
}
